import { createProgressParser } from "./progress";
import { LogBatcher } from "./log-batcher";
import { runPreset } from "./executor";
import { resolvePreset, buildCatalogFromConfig } from "./config";
import type { AgentConfig } from "./types";
import { AgentClient } from "./client";

export { buildCatalogFromConfig };

export async function executeClaimedJob(
  config: AgentConfig,
  job: import("./types").TestJob,
  client: AgentClient,
): Promise<void> {
  const preset = resolvePreset(config, job.projectId, job.presetId);
  if (!preset) {
    await client.complete(job.id, {
      status: "failed",
      exitCode: 1,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 0,
      truncated: false,
      error: `Preset ${job.presetId} not found in agent configuration`,
    });
    return;
  }

  const parser = createProgressParser(preset.name || preset.command);
  const logBatcher = new LogBatcher(async (seqStart, entries, progress) => {
    await client.appendLogs(job.id, seqStart, entries, progress);
  });

  const abortController = new AbortController();

  let heartbeatTimer: NodeJS.Timeout | null = null;
  let heartbeatStopped = false;

  const scheduleHeartbeat = () => {
    if (heartbeatStopped) return;
    heartbeatTimer = setTimeout(async () => {
      try {
        const hb = await client.heartbeat(job.id, parser.consume("stdout", []));
        if (hb.cancelRequested) {
          abortController.abort();
        }
      } catch {
        // Ignore transient heartbeat failures
      } finally {
        scheduleHeartbeat();
      }
    }, 5000);
  };

  scheduleHeartbeat();

  try {
    const result = await runPreset(
      preset,
      {
        onLines: (stream: "stdout" | "stderr" | "system", lines: string[]) => {
          if (stream === "stdout" || stream === "stderr") {
            const progress = parser.consume(stream, lines);
            logBatcher.push(stream, lines, progress);
          } else {
            logBatcher.push(stream, lines);
          }
        },
      },
      abortController.signal,
    );

    // Drain pending logs before completion
    await logBatcher.drain();
    await client.complete(job.id, result);
  } finally {
    heartbeatStopped = true;
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
  }
}

export async function runAgent(config: AgentConfig): Promise<void> {
  const client = new AgentClient(config.serverUrl, config.agentToken, config.agentId);
  const catalog = buildCatalogFromConfig(config);
  const pollIntervalMs = (config.pollIntervalSeconds ?? 5) * 1000;

  console.log(`[Morniter Local Agent] Agent "${config.agentId}" started polling ${config.serverUrl}`);

  while (true) {
    try {
      const job = await client.poll("1.0.0", catalog);
      if (job) {
        console.log(`[Morniter Local Agent] Claimed job ${job.id} (${job.projectId}:${job.presetId})`);
        await executeClaimedJob(config, job, client);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Polling error";
      console.error(`[Morniter Local Agent] Poll error: ${msg}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}
