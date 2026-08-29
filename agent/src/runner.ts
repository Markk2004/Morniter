import { createProgressParser } from "./progress/index.js";
import { LogBatcher } from "./log-batcher.js";
import { runPreset } from "./executor.js";
import { resolvePreset, buildCatalogFromConfig } from "./config.js";
import {
  buildPlaywrightCatalogFromConfig,
  detectBrowserCapabilities,
} from "./playwright-catalog.js";
import {
  preparePlaywrightExecution,
  runPlaywrightExecution,
} from "./playwright-executor.js";
import type { AgentConfig, PlaywrightJob } from "./types.js";
import { AgentClient } from "./client.js";

export { buildCatalogFromConfig };

export async function executeClaimedJob(
  config: AgentConfig,
  job: import("./types.js").TestJob,
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

export async function executeClaimedPlaywrightJob(
  config: AgentConfig,
  job: PlaywrightJob,
  client: AgentClient,
): Promise<void> {
  const logBatcher = new LogBatcher(async (seqStart, entries) => {
    await client.appendPlaywrightLogs(job.id, seqStart, entries);
  });

  const abortController = new AbortController();
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let heartbeatStopped = false;

  const scheduleHeartbeat = () => {
    if (heartbeatStopped) return;
    heartbeatTimer = setTimeout(async () => {
      try {
        const hb = await client.heartbeatPlaywright(job.id);
        if (hb.cancelRequested) {
          abortController.abort();
        }
      } catch {
        // Ignore transient heartbeat error
      } finally {
        scheduleHeartbeat();
      }
    }, 5000);
  };

  scheduleHeartbeat();

  try {
    const prepared = await preparePlaywrightExecution(config, job);
    const result = await runPlaywrightExecution(
      prepared,
      job,
      {
        onLines: (stream, lines) => {
          logBatcher.push(stream, lines);
        },
      },
      abortController.signal,
    );

    await logBatcher.drain();
    await client.completePlaywright(job.id, result);
  } catch (err) {
    const nowStr = new Date().toISOString();
    const errMsg = err instanceof Error ? err.message : "Playwright execution failed";
    await logBatcher.drain();
    await client.completePlaywright(job.id, {
      status: "failed",
      browserResults: job.browsers.map((b) => ({
        browser: b,
        status: "failed",
        passed: 0,
        failed: 1,
        skipped: 0,
      })),
      startedAt: nowStr,
      finishedAt: nowStr,
      durationMs: 0,
      truncated: false,
      error: errMsg,
    });
  } finally {
    heartbeatStopped = true;
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
  }
}

export async function runAgent(config: AgentConfig): Promise<void> {
  const client = new AgentClient(config.serverUrl, config.agentToken, config.agentId);
  const catalog = buildCatalogFromConfig(config);
  const pollIntervalMs = (config.pollIntervalSeconds ?? 5) * 1000;
  const catalogRefreshMs = Math.max(30_000, pollIntervalMs * 6);
  let cachedPlaywrightCatalog: Awaited<ReturnType<typeof buildPlaywrightCatalogFromConfig>> | undefined;
  let nextCatalogRefreshAt = 0;
  let lastPublishedPlaywrightCatalogVersion: string | undefined;

  console.log(`[Monitor Local Agent] Agent "${config.agentId}" started polling ${config.serverUrl}`);

  while (true) {
    try {
      // 1. Poll legacy preset queue if presets configured
      const hasPresets = config.projects.some((p) => p.presets && p.presets.length > 0);
      if (hasPresets) {
        const job = await client.poll("1.0.0", catalog);
        if (job) {
          console.log(`[Monitor Local Agent] Claimed legacy job ${job.id} (${job.projectId}:${job.presetId})`);
          await executeClaimedJob(config, job, client);
          continue;
        }
      }

      // 2. Poll Playwright queue if playwright configured
      const hasPlaywright = config.projects.some((p) => p.playwright && p.playwright.enabled !== false);
      if (hasPlaywright) {
        const now = Date.now();
        if (!cachedPlaywrightCatalog || now >= nextCatalogRefreshAt) {
          cachedPlaywrightCatalog = await buildPlaywrightCatalogFromConfig(config);
          nextCatalogRefreshAt = now + catalogRefreshMs;
        }
        const capabilities = detectBrowserCapabilities(config);
        const pwCatalog = cachedPlaywrightCatalog;
        const catalogChanged = pwCatalog.version !== lastPublishedPlaywrightCatalogVersion;
        const pwJob = await client.pollPlaywright(pwCatalog.version, catalogChanged ? pwCatalog : undefined, capabilities);
        if (catalogChanged) lastPublishedPlaywrightCatalogVersion = pwCatalog.version;
        if (pwJob) {
          console.log(`[Monitor Local Agent] Claimed Playwright job ${pwJob.id} (${pwJob.projectId}:${pwJob.source})`);
          await executeClaimedPlaywrightJob(config, pwJob, client);
          continue;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Polling error";
      console.error(`[Monitor Local Agent] Poll error: ${msg}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}
