import { createProgressParser } from "./progress/index.js";
import { LogBatcher } from "./log-batcher.js";
import { runPreset } from "./executor.js";
import { resolvePreset, buildCatalogFromConfig } from "./config.js";
import {
  buildPlaywrightCatalogFromConfig,
  detectBrowserCapabilities,
} from "./playwright-catalog.js";
import { loadAutomationMap } from "./automation-map.js";
import { discoverProjectTests } from "./project-test-discovery.js";
import { buildNativeExecutionPlan } from "./native-runner-plan.js";
import { runNativeExecutionGroup } from "./native-runner-executor.js";
import {
  preparePlaywrightExecution,
  runPlaywrightExecution,
} from "./playwright-executor.js";
import { executeRecipeMutation } from "./recipe-mutator.js";
import { recoverRecipeTransactions } from "./mutation-transaction.js";
import { resolveAndAssertSafeTestTarget } from "./test-target-policy.js";
import type { AgentConfig, PlaywrightJob, NativeGroupResult, BrowserExecutionResult } from "./types.js";
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

  // Emit immediate system start line so terminal updates immediately
  logBatcher.push("system", ["[SYSTEM] Starting test execution..."]);

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
    const project = config.projects.find((p) => p.id === job.projectId);
    if (!project || !project.playwright) {
      throw new Error(`Project '${job.projectId}' does not have Playwright configured on this agent.`);
    }

    const pw = project.playwright;

    // Check if project has an automation map and we can build a native multi-runner plan
    let nativePlan: import("./native-runner-plan.js").NativeExecutionGroup[] | null = null;
    let automationMap: import("./types.js").AutomationMap | null = null;

    if (pw.automationMap) {
      automationMap = await loadAutomationMap(pw.workspaceRoot, pw.automationMap);
    }

    // Target safety check for workspace executions using explicit job.risk metadata
    if (job.source === "workspace" && job.code && automationMap) {
      const risk = job.risk ?? "read-only";
      if (risk === "mutating" && automationMap.testTarget?.allowMutating === false) {
        throw new Error("Execution rejected: target does not allow mutating execution");
      }

      const urlMatches = job.code.match(/(?:goto\s*\(\s*["']([^"']+)["']|https?:\/\/[^\s"'`)]+)/g) || [];
      const cleanUrls = urlMatches.map((m) => m.replace(/^goto\s*\(\s*["']/, "").replace(/["']$/, ""));
      for (const url of cleanUrls) {
        resolveAndAssertSafeTestTarget(
          url,
          automationMap.testTarget,
          risk,
          automationMap.productionHostDenylist || [],
        );
      }
    }

    if (job.source === "project-test" && pw.automationMap && job.testIds && job.testIds.length > 0) {
      const map = automationMap || (await loadAutomationMap(pw.workspaceRoot, pw.automationMap));
      const discovery = await discoverProjectTests(pw.workspaceRoot, map);
      const hasNativeTests = job.testIds.some((id) => discovery.tests.some((t) => t.id === id));
      if (hasNativeTests) {
        nativePlan = buildNativeExecutionPlan({
          workspaceRoot: pw.workspaceRoot,
          map,
          selectedTestIds: job.testIds,
          discoveredTests: discovery.tests,
          browsers: job.browsers,
          mode: job.mode,
          envAllowlist: pw.envAllowlist,
          timeoutSeconds: pw.maxTimeoutSeconds,
        });
      }
    }

    if (nativePlan && nativePlan.length > 0) {
      const runnerResults: NativeGroupResult[] = [];
      let aggregateStatus: "passed" | "failed" | "cancelled" | "timed_out" = "passed";
      const startedAt = new Date().toISOString();

      for (const group of nativePlan) {
        if (abortController.signal.aborted) {
          aggregateStatus = "cancelled";
          break;
        }

        const groupResult = await runNativeExecutionGroup(
          group,
          {
            onLines: (stream, lines) => {
              logBatcher.push(stream, lines);
            },
          },
          abortController.signal,
        );

        runnerResults.push(groupResult);

        if (groupResult.status !== "passed") {
          aggregateStatus = groupResult.status;
          break;
        }
      }

      const finishedAt = new Date().toISOString();
      const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

      const browserResults: BrowserExecutionResult[] = job.browsers.map((b) => ({
        browser: b,
        status: aggregateStatus === "passed" ? "passed" : "failed",
        passed: aggregateStatus === "passed" ? runnerResults.length : 0,
        failed: aggregateStatus === "passed" ? 0 : 1,
        skipped: 0,
        durationMs,
      }));

      try {
        await logBatcher.drain();
      } catch (drainErr) {
        console.error("[Monitor Local Agent] Log drain warning before completion:", drainErr);
      }

      await client.completePlaywright(job.id, {
        status: aggregateStatus,
        browserResults,
        runnerResults,
        startedAt,
        finishedAt,
        durationMs,
        truncated: false,
      });
      return;
    }

    // Standard Playwright execution (workspace code or pure Playwright specs)
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

    try {
      await logBatcher.drain();
    } catch (drainErr) {
      console.error("[Monitor Local Agent] Log drain warning before completion:", drainErr);
    }
    await client.completePlaywright(job.id, result);
  } catch (err) {
    const nowStr = new Date().toISOString();
    const errMsg = err instanceof Error ? err.message : "Test execution failed";
    try {
      await logBatcher.drain();
    } catch (drainErr) {
      console.error("[Monitor Local Agent] Log drain warning during error handler:", drainErr);
    }
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

import { SingleInstanceGuard } from "./single-instance.js";

export async function runAgent(config: AgentConfig): Promise<void> {
  const guard = new SingleInstanceGuard(config.agentId);
  guard.acquire();

  const client = new AgentClient(config.serverUrl, config.agentToken, config.agentId);
  const catalog = buildCatalogFromConfig(config);
  const pollIntervalMs = (config.pollIntervalSeconds ?? 5) * 1000;
  const catalogRefreshMs = Math.max(30_000, pollIntervalMs * 6);
  let cachedPlaywrightCatalog: Awaited<ReturnType<typeof buildPlaywrightCatalogFromConfig>> | undefined;
  let nextCatalogRefreshAt = 0;
  let lastPublishedPlaywrightCatalogVersion: string | undefined;

  // Startup crash recovery for recipe mutations across all Playwright workspaces
  for (const project of config.projects) {
    if (project.playwright?.workspaceRoot) {
      try {
        await recoverRecipeTransactions(project.playwright.workspaceRoot);
      } catch (err) {
        throw new Error(
          `Startup recovery failed for project '${project.id}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

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

        // 3. Poll Recipe Mutation queue
        const mutation = await client.pollMutation();
        if (mutation) {
          console.log(`[Monitor Local Agent] Claimed recipe mutation ${mutation.id} for project ${mutation.projectId}`);
          const result = await executeRecipeMutation(config, mutation);
          await client.completeMutation(mutation.id, mutation.leaseToken || "", result);
          cachedPlaywrightCatalog = undefined; // invalidate cached catalog
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
