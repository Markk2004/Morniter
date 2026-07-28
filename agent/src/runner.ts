import { AgentClient } from "./client.js";
import { resolvePreset } from "./config.js";
import { runPreset } from "./executor.js";
import type { AgentConfig, TestProjectCatalog } from "./types.js";

const ACTIVE_POLL_INTERVAL_MS = 5000;
const IDLE_POLL_INTERVAL_MS = 30000;

export function buildCatalogFromConfig(config: AgentConfig): TestProjectCatalog {
  return {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    projects: config.projects.map((project) => ({
      id: project.id,
      name: project.name,
      presets: project.presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        commandPreview: `${preset.command} ${(preset.args || []).join(" ")}`.trim(),
        timeoutSeconds: preset.timeoutSeconds ?? 300,
      })),
    })),
  };
}

export async function runAgent(config: AgentConfig, signal?: AbortSignal): Promise<void> {
  const client = new AgentClient(config.serverUrl, config.agentToken);
  const catalog = buildCatalogFromConfig(config);

  console.log(`[Morniter Local Agent] Initialized agentId="${config.agentId}" server="${config.serverUrl}"`);

  let nextPollInterval = IDLE_POLL_INTERVAL_MS;

  while (!signal?.aborted) {
    try {
      const pollResult = await client.poll(config.agentId, catalog.version, catalog);

      if (pollResult && pollResult.job) {
        const job = pollResult.job;
        console.log(`[Morniter Local Agent] Claimed job ${job.id} (${job.projectId}/${job.presetId})`);

        let sequence = 0;
        try {
          const resolved = resolvePreset(config, job.projectId, job.presetId);
          const execAbortController = new AbortController();

          const result = await runPreset(
            resolved,
            {
              onLines: (stream, lines) => {
                client
                  .appendLogs(job.id, sequence, stream, lines)
                  .catch((err) =>
                    console.error(`[Morniter Local Agent] Failed to send logs: ${err.message}`),
                  );
                sequence += lines.length;
              },
            },
            execAbortController.signal,
          );

          await client.complete(job.id, result);
          console.log(`[Morniter Local Agent] Completed job ${job.id} with status "${result.status}"`);
        } catch (execErr) {
          const errMsg = execErr instanceof Error ? execErr.message : "Execution failed";
          console.error(`[Morniter Local Agent] Job ${job.id} error: ${errMsg}`);
          await client.complete(job.id, { status: "failed", error: errMsg });
        }

        nextPollInterval = ACTIVE_POLL_INTERVAL_MS;
      } else {
        nextPollInterval = IDLE_POLL_INTERVAL_MS;
      }
    } catch (pollErr) {
      const errMsg = pollErr instanceof Error ? pollErr.message : "Polling error";
      console.error(`[Morniter Local Agent] ${errMsg}. Retrying in 30s...`);
      nextPollInterval = IDLE_POLL_INTERVAL_MS;
    }

    await new Promise((res) => setTimeout(res, nextPollInterval));
  }
}
