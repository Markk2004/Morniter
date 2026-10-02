import fs from "node:fs/promises";
import path from "node:path";
import { spawnProcessCommand, terminateProcessTree, terminateProcessOnPort } from "./process-adapter.js";
import { resolveExecutable } from "./config.js";
import { resolveInsideRoot, scanPlaywrightTests } from "./playwright-catalog.js";
import { redactText } from "./redact.js";
import type {
  AgentConfig,
  PlaywrightJob,
  PlaywrightExecutionResult,
  BrowserExecutionResult,
} from "./types.js";

const BLOCKED_ENV_KEYS = new Set([
  "TEST_RUNNER_AGENT_TOKEN",
  "UPSTASH_REDIS_REST_TOKEN",
  "SESSION_SIGNING_SECRET",
  "GROUP_ACCESS_PASSWORD_HASH",
  "TEST_RUNNER_PASSWORD_HASH",
]);

export function buildSafeTestEnv(
  envAllowlist: string[] = [],
  sourceEnv: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  const safeEnv: Record<string, string> = {
    PATH: sourceEnv.PATH ?? "",
    NODE_ENV: "test",
  };

  if (sourceEnv.PLAYWRIGHT_BROWSERS_PATH) {
    safeEnv.PLAYWRIGHT_BROWSERS_PATH = sourceEnv.PLAYWRIGHT_BROWSERS_PATH;
  }
  if (sourceEnv.SYSTEMROOT) {
    safeEnv.SYSTEMROOT = sourceEnv.SYSTEMROOT;
  }

  for (const key of envAllowlist) {
    if (BLOCKED_ENV_KEYS.has(key)) {
      continue;
    }
    const val = sourceEnv[key];
    if (val !== undefined) {
      safeEnv[key] = val;
    }
  }

  return safeEnv;
}

export interface PreparedPlaywrightRun {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeoutSeconds: number;
  interactive: boolean;
  cleanup: () => Promise<void>;
}

export async function preparePlaywrightExecution(
  config: AgentConfig,
  job: PlaywrightJob,
): Promise<PreparedPlaywrightRun> {
  const project = config.projects.find((p) => p.id === job.projectId);
  if (!project || !project.playwright) {
    throw new Error(`Project '${job.projectId}' does not have Playwright configured on this agent.`);
  }

  const pw = project.playwright;
  const workspaceRoot = path.resolve(pw.workspaceRoot);

  if (job.mode === "interactive") {
    if (job.source !== "project-test") {
      throw new Error("Interactive UI requires project tests.");
    }
    if (job.browsers.length !== 1) {
      throw new Error("Interactive UI requires exactly one browser.");
    }
  }

  // Validate browsers
  const allowedBrowsers =
    pw.allowedBrowsers && pw.allowedBrowsers.length > 0
      ? pw.allowedBrowsers
      : ["chromium", "firefox", "webkit", "msedge"];
  for (const b of job.browsers) {
    if (!allowedBrowsers.includes(b)) {
      throw new Error(`Browser '${b}' is not allowed for project '${job.projectId}' on this agent.`);
    }
  }

  // Validate headed mode
  if (job.mode === "headed" && pw.allowHeaded === false) {
    throw new Error(`Headed mode is disabled for project '${job.projectId}' on this agent.`);
  }

  const testRoot = pw.testRoot || "e2e";
  const testRootPath = resolveInsideRoot(workspaceRoot, testRoot);
  let configPath = pw.config ? resolveInsideRoot(workspaceRoot, pw.config) : undefined;
  if (!configPath) {
    const stsConfigCandidate = resolveInsideRoot(workspaceRoot, "playwright.sts.config.ts");
    try {
      await fs.access(stsConfigCandidate);
      if (job.projectId.toLowerCase().includes("sts") || testRoot.toLowerCase().includes("sts")) {
        configPath = stsConfigCandidate;
      }
    } catch {
      // not available
    }
  }
  const executionCwd = configPath ? path.dirname(configPath) : workspaceRoot;
  let specPaths: string[] = [];
  let cleanup = async () => {};

  if (job.source === "project-test") {
    if (!job.testIds || job.testIds.length === 0) {
      throw new Error("No testIds provided for project-test execution.");
    }

    const allTests = await scanPlaywrightTests(workspaceRoot, testRoot);
    const resolvedFiles = new Set<string>();

    for (const testId of job.testIds) {
      const match = allTests.find((t) => t.id === testId);
      if (!match) {
        throw new Error(`TestId '${testId}' could not be resolved in project '${job.projectId}'.`);
      }
      const fullPath = resolveInsideRoot(workspaceRoot, match.relativePath);
      resolvedFiles.add(fullPath);
    }

    specPaths = Array.from(resolvedFiles).map((fullPath) =>
      path.relative(executionCwd, fullPath).replace(/\\/g, "/"),
    );
  } else if (job.source === "workspace") {
    if (pw.allowWorkspaceExecution === false) {
      throw new Error(`Workspace code execution is disabled for project '${job.projectId}'.`);
    }
    if (!job.code || job.code.trim().length === 0) {
      throw new Error("Workspace code is empty.");
    }

    const workspaceDir = resolveInsideRoot(testRootPath, "__workspace__");
    await fs.mkdir(workspaceDir, { recursive: true });

    // Link helper directories so relative imports (page-objects, fixtures) resolve seamlessly
    for (const name of ["page-objects", "fixtures"]) {
      const dest = path.join(workspaceDir, name);
      try {
        await fs.access(dest);
      } catch {
        for (const candidateRoot of [
          testRootPath,
          path.join(testRootPath, "sts"),
          path.join(workspaceRoot, "e2e"),
          path.join(workspaceRoot, "e2e", "sts"),
        ]) {
          const src = path.join(candidateRoot, name);
          try {
            const stat = await fs.stat(src);
            if (stat.isDirectory()) {
              const linkType = process.platform === "win32" ? "junction" : "dir";
              await fs.symlink(src, dest, linkType);
              break;
            }
          } catch {
            // continue searching
          }
        }
      }
    }

    const specFile = path.join(workspaceDir, `${job.id}.spec.ts`);
    await fs.writeFile(specFile, job.code, "utf-8");

    specPaths = [path.relative(executionCwd, specFile).replace(/\\/g, "/")];

    cleanup = async () => {
      try {
        await fs.unlink(specFile);
      } catch {
        // ignore
      }
    };
  }

  const executable = resolveExecutable("npx");
  const args = ["-y", "playwright", "test", ...specPaths];

  if (configPath) {
    args.push("--config", configPath);
  }

  for (const b of job.browsers) {
    args.push(`--project=${b}`);
  }

  if (job.mode === "interactive") {
    args.push("--ui", "--ui-host=127.0.0.1", "--ui-port=0");
  } else if (job.mode === "headed") {
    args.push("--headed");
  }

  const safeEnv = buildSafeTestEnv(pw.envAllowlist);
  const timeoutSeconds = job.mode === "interactive" ? 1800 : (pw.maxTimeoutSeconds || 600);

  return {
    command: executable,
    args,
    cwd: executionCwd,
    env: safeEnv,
    timeoutSeconds,
    interactive: job.mode === "interactive",
    cleanup,
  };
}

async function harvestArtifacts(
  workspaceRoot: string,
  jobId: string,
): Promise<NonNullable<PlaywrightExecutionResult["artifacts"]>> {
  const artifacts: NonNullable<PlaywrightExecutionResult["artifacts"]> = [];
  const resultsDir = path.join(workspaceRoot, "test-results");
  try {
    const entries = await fs.readdir(resultsDir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(entry.parentPath || resultsDir, entry.name);
        const stat = await fs.stat(fullPath);
        const ext = path.extname(entry.name).toLowerCase();
        let type: "trace" | "screenshot" | "video" | "report" = "report";
        if (ext === ".zip" || entry.name.includes("trace")) {
          type = "trace";
        } else if (ext === ".png" || ext === ".jpg") {
          type = "screenshot";
        } else if (ext === ".webm" || ext === ".mp4") {
          type = "video";
        }

        artifacts.push({
          id: `art-${jobId}-${artifacts.length + 1}`,
          jobId,
          type,
          filename: entry.name,
          size: stat.size,
          createdAt: new Date().toISOString(),
        });
      }
    }
  } catch {
    // ignore if test-results directory does not exist
  }
  return artifacts;
}

export async function runPlaywrightExecution(
  prepared: PreparedPlaywrightRun,
  job: PlaywrightJob,
  callbacks: {
    onLines: (stream: "stdout" | "stderr" | "system", lines: string[]) => void;
    onStarted?: (pid: number) => void;
  },
  signal?: AbortSignal,
): Promise<PlaywrightExecutionResult> {
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();

  const browserResults: BrowserExecutionResult[] = job.browsers.map((b) => ({
    browser: b,
    status: "running",
    passed: 0,
    failed: 0,
    skipped: 0,
  }));

  let child: ReturnType<typeof spawnProcessCommand>;
  try {
    child = spawnProcessCommand(prepared.command, prepared.args, prepared.cwd, prepared.env);
  } catch (err) {
    await prepared.cleanup();
    const finishedAt = new Date().toISOString();
    const errMsg = err instanceof Error ? err.message : "Failed to spawn Playwright process";
    callbacks.onLines("stderr", [errMsg]);
    if (prepared.interactive) {
      callbacks.onLines("system", ["[UI] Session closed: process_error"]);
      return {
        status: "session_closed",
        sessionCloseReason: "process_error",
        browserResults: job.browsers.map((b) => ({
          browser: b,
          status: "session_closed",
          passed: 0,
          failed: 0,
          skipped: 0,
        })),
        startedAt,
        finishedAt,
        durationMs: 0,
        truncated: false,
        error: errMsg,
      };
    }
    return {
      status: "failed",
      browserResults: job.browsers.map((b) => ({
        browser: b,
        status: "failed",
        passed: 0,
        failed: 1,
        skipped: 0,
      })),
      startedAt,
      finishedAt,
      durationMs: 0,
      truncated: false,
      error: errMsg,
    };
  }

  if (child.pid && callbacks.onStarted) {
    callbacks.onStarted(child.pid);
  }

  let isFinished = false;
  let timeoutTimer: NodeJS.Timeout | undefined;
  let abortListener: (() => void) | undefined;
  let uiReadyReported = false;
  let uiPort: number | null = null;

  const allOutputLines: string[] = [];

  return new Promise<PlaywrightExecutionResult>((resolve) => {
    async function finish(
      finalStatus: PlaywrightExecutionResult["status"],
      errMessage?: string,
      shouldKill = false,
      explicitCloseReason?: import("./types.js").PlaywrightSessionCloseReason,
      testExecutionSummary?: import("./types.js").TestExecutionSummary,
    ) {
      if (isFinished) return;
      isFinished = true;

      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (abortListener && signal) {
        signal.removeEventListener("abort", abortListener);
      }

      if (shouldKill && child.pid) {
        const pid = child.pid;
        try {
          terminateProcessTree(pid);
        } catch {
          // ignore
        }
        try {
          child.kill();
        } catch {
          // ignore
        }
      }

      if (prepared.interactive && uiPort) {
        try {
          terminateProcessOnPort(uiPort);
        } catch {
          // ignore
        }
      }

      await prepared.cleanup();

      const finishedAtDate = new Date();
      const finishedAt = finishedAtDate.toISOString();
      const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();

      if (prepared.interactive) {
        const effectiveReason: import("./types.js").PlaywrightSessionCloseReason =
          explicitCloseReason ??
          (finalStatus === "cancelled"
            ? "operator_stopped"
            : finalStatus === "timed_out"
              ? "timeout"
              : finalStatus === "failed"
                ? "process_error"
                : "user_closed");

        browserResults.forEach((br) => {
          br.status = "session_closed";
          br.durationMs = durationMs;
        });

        callbacks.onLines("system", [`[UI] Session closed: ${effectiveReason}`]);

        resolve({
          status: "session_closed",
          sessionCloseReason: effectiveReason,
          browserResults,
          startedAt,
          finishedAt,
          durationMs,
          truncated: false,
          error: errMessage,
        });
        return;
      }

      browserResults.forEach((br) => {
        br.status = finalStatus === "passed" ? "passed" : finalStatus === "cancelled" ? "cancelled" : "failed";
        br.durationMs = durationMs;
      });

      const artifacts = finalStatus === "cancelled" ? [] : await harvestArtifacts(prepared.cwd, job.id);

      resolve({
        status: finalStatus,
        browserResults,
        artifacts: artifacts.length > 0 ? artifacts : undefined,
        testExecutionSummary,
        startedAt,
        finishedAt,
        durationMs,
        truncated: false,
        error: errMessage,
      });
    }

    if (signal) {
      if (signal.aborted) {
        finish(prepared.interactive ? "session_closed" : "cancelled", "Execution cancelled by caller", true, "operator_stopped");
        return;
      }
      abortListener = () => finish(prepared.interactive ? "session_closed" : "cancelled", "Execution cancelled by caller", true, "operator_stopped");
      signal.addEventListener("abort", abortListener);
    }

    if (prepared.timeoutSeconds > 0) {
      timeoutTimer = setTimeout(() => {
        finish(prepared.interactive ? "session_closed" : "timed_out", `Execution timed out after ${prepared.timeoutSeconds} seconds`, true, "timeout");
      }, prepared.timeoutSeconds * 1000);
    }

    function processStream(stream: "stdout" | "stderr", data: Buffer) {
      if (isFinished) return;
      const text = data.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
      const redacted = lines.map((l) => redactText(l));
      allOutputLines.push(...redacted);

      if (prepared.interactive) {
        for (const line of redacted) {
          const match = line.match(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)/i);
          if (match) {
            uiPort = parseInt(match[1], 10);
          }
          if (/https?:\/\/(?:127\.0\.0\.1|localhost):\d+/i.test(line) || /listening on/i.test(line)) {
            if (!uiReadyReported) {
              uiReadyReported = true;
              callbacks.onLines("system", ["[UI] Local Playwright UI ready"]);
            }
          }
        }
        return;
      }

      for (const clean of redacted) {
        if (clean.includes("passed") || clean.includes("✓")) {
          browserResults.forEach((br) => {
            br.passed += 1;
          });
        } else if (clean.includes("failed") || clean.includes("✗") || clean.includes("Error:")) {
          browserResults.forEach((br) => {
            br.failed += 1;
          });
        }
      }

      if (redacted.length > 0) {
        callbacks.onLines(stream, redacted);
      }
    }

    if (child.stdout) {
      child.stdout.on("data", (data: Buffer) => processStream("stdout", data));
    }
    if (child.stderr) {
      child.stderr.on("data", (data: Buffer) => processStream("stderr", data));
    }

    child.on("error", (err: Error) => {
      if (!prepared.interactive) {
        processStream("stderr", Buffer.from(err.message));
      }
      finish(prepared.interactive ? "session_closed" : "failed", err.message, true, "process_error");
    });

    child.on("close", (code: number | null) => {
      if (prepared.interactive) {
        finish("session_closed", undefined, true, "user_closed");
      } else {
        const finalStatus = code === 0 ? "passed" : "failed";
        const { summary, summaryLines } = buildExecutionSummary(job, allOutputLines, browserResults, finalStatus);
        callbacks.onLines("system", summaryLines);
        finish(finalStatus, undefined, false, undefined, summary);
      }
    });
  });
}

export function buildExecutionSummary(
  job: PlaywrightJob,
  rawLines: string[],
  browserResults: BrowserExecutionResult[],
  finalStatus: "passed" | "failed" | "cancelled" | "timed_out",
): { summary: import("./types.js").TestExecutionSummary; summaryLines: string[] } {
  const cases: import("./types.js").TestCaseResultItem[] = [];
  const seenIds = new Set<string>();

  let detectedUatId: string | undefined;
  let detectedUatTitle: string | undefined;
  let totalDuration: string | undefined;
  let activeFailedCase: import("./types.js").TestCaseResultItem | null = null;

  for (const raw of rawLines) {
    const line = raw.replace(/\r$/, "").trim();
    if (!line) continue;

    const durMatch = line.match(/(?:passed|failed|flaky|skipped).*?\(([\d.]+[m]?s)\)/i);
    if (durMatch && !totalDuration) {
      totalDuration = durMatch[1];
    }

    if (!detectedUatTitle) {
      const uatMatch = line.match(/(FN-STS-\d+(?:\s*\([^)]+\))?(?::\s*[^›\n\r]+)?)/i);
      if (uatMatch) {
        detectedUatTitle = uatMatch[1].trim();
        const idMatch = detectedUatTitle.match(/(FN-STS-\d+)/i);
        if (idMatch) detectedUatId = idMatch[1].toUpperCase();
      }
    }

    const testLineMatch = line.match(
      /^(?:ok|x|✓|✗|✖)\s+\d+\s+\[([^\]]+)\]\s+›\s+(.*)$/i,
    );

    if (testLineMatch) {
      const isPass = line.startsWith("ok") || line.startsWith("✓");
      const fullPath = testLineMatch[2];

      let duration: string | undefined;
      let pathWithoutDuration = fullPath;
      const durEndMatch = fullPath.match(/\s+\(([\d.]+[m]?s)\)\s*$/);
      if (durEndMatch) {
        duration = durEndMatch[1];
        pathWithoutDuration = fullPath.slice(0, durEndMatch.index).trim();
      }

      const segments = pathWithoutDuration.split("›").map((s) => s.trim());
      const lastSegment = segments[segments.length - 1] || pathWithoutDuration;

      for (const seg of segments) {
        if (!detectedUatTitle && /FN-STS-\d+/i.test(seg)) {
          detectedUatTitle = seg;
          const m = seg.match(/(FN-STS-\d+)/i);
          if (m) detectedUatId = m[1].toUpperCase();
        }
      }

      let caseId = `TC-${cases.length + 1}`;
      let caseTitle = lastSegment;

      const tcPrefixMatch = lastSegment.match(/^(TC-[A-Za-z0-9_-]+)(?::\s*|\s*-\s*)(.*)$/);
      if (tcPrefixMatch) {
        caseId = tcPrefixMatch[1].trim();
        caseTitle = tcPrefixMatch[2].trim() || caseId;
      } else {
        const anyIdMatch = lastSegment.match(/^([A-Z0-9_-]+): (.*)$/);
        if (anyIdMatch && anyIdMatch[1].length <= 25) {
          caseId = anyIdMatch[1].trim();
          caseTitle = anyIdMatch[2].trim();
        }
      }

      const caseKey = `${caseId}:${caseTitle}`;
      if (!seenIds.has(caseKey)) {
        seenIds.add(caseKey);
        const item: import("./types.js").TestCaseResultItem = {
          id: caseId,
          title: caseTitle,
          status: isPass ? "passed" : "failed",
          duration,
        };
        cases.push(item);
        if (!isPass) {
          activeFailedCase = item;
        }
      }
      continue;
    }

    if (activeFailedCase) {
      if (line.startsWith("Error:") || line.startsWith("Expected pattern:") || line.startsWith("Received string:")) {
        if (!activeFailedCase.error) {
          activeFailedCase.error = line;
        } else if (activeFailedCase.error.length < 180 && !activeFailedCase.error.includes(line)) {
          activeFailedCase.error += ` | ${line}`;
        }
      } else if (/^\d+\)\s+\[/.test(line)) {
        const match = line.match(/(TC-[A-Za-z0-9_-]+)/);
        if (match) {
          const target = cases.find((c) => c.id === match[1]);
          if (target) activeFailedCase = target;
        }
      }
    }
  }

  let uatTitle = detectedUatTitle;
  let uatId = detectedUatId;
  if (!uatTitle && job.code) {
    const codeMatch = job.code.match(/\/\/\s*🧪\s*(?:ชุดทดสอบระบบ\s*ProjectSTS:\s*)?(FN-STS-\d+.*?)(?:\r?\n|$)/i);
    if (codeMatch) {
      uatTitle = codeMatch[1].trim();
      const idMatch = uatTitle.match(/(FN-STS-\d+)/i);
      if (idMatch) uatId = idMatch[1].toUpperCase();
    }
  }

  if (cases.length === 0) {
    if (job.code) {
      const testMatches = Array.from(job.code.matchAll(/test\s*\(\s*["'`](.*?)["'`]/g));
      for (const m of testMatches) {
        const fullTitle = m[1].trim();
        let caseId = `TC-${cases.length + 1}`;
        let caseTitle = fullTitle;
        const tcPrefixMatch = fullTitle.match(/^(TC-[A-Za-z0-9_-]+)(?::\s*|\s*-\s*)(.*)$/);
        if (tcPrefixMatch) {
          caseId = tcPrefixMatch[1].trim();
          caseTitle = tcPrefixMatch[2].trim() || caseId;
        }
        cases.push({
          id: caseId,
          title: caseTitle,
          status: finalStatus === "passed" ? "passed" : "failed",
          duration: totalDuration,
        });
      }
    }
  }

  if (cases.length === 0 && job.testIds && job.testIds.length > 0) {
    for (const tid of job.testIds) {
      cases.push({
        id: tid,
        title: tid,
        status: finalStatus === "passed" ? "passed" : "failed",
        duration: totalDuration,
      });
    }
  }

  if (cases.length === 0) {
    cases.push({
      id: "TC-RUN-01",
      title: uatTitle || "Workspace Playwright Execution",
      status: finalStatus === "passed" ? "passed" : "failed",
      duration: totalDuration,
    });
  }

  const passed = cases.filter((c) => c.status === "passed").length;
  const failed = cases.filter((c) => c.status === "failed").length;
  const skipped = cases.filter((c) => c.status === "skipped").length;

  const summary: import("./types.js").TestExecutionSummary = {
    uatId,
    uatTitle: uatTitle || "Playwright Test Execution",
    total: cases.length,
    passed,
    failed,
    skipped,
    duration: totalDuration,
    cases,
  };

  const border = "=".repeat(78);
  const divider = "─".repeat(78);
  const browsers = job.browsers && job.browsers.length > 0 ? job.browsers.join(", ") : "chromium";
  const duration = totalDuration || "N/A";

  const summaryLines: string[] = [
    border,
    "🎯 TEST EXECUTION & UAT SUMMARY / สรุปผลการทดสอบระบบ",
    border,
    `📋 UAT Module : ${summary.uatTitle || summary.uatId || "General Test Execution"}`,
    `🌐 Browser(s)  : ${browsers}`,
    `⏱️ Total Time  : ${duration}`,
    `📊 Overview    : ${summary.total} Total | ผ่าน (Passed): ${passed} | ไม่ผ่าน (Failed): ${failed}`,
  ];

  if (cases.length > 0) {
    summaryLines.push("");
    summaryLines.push("[ รายละเอียดผลการทดสอบแต่ละ Test Case (Breakdown) ]");
    summaryLines.push(divider);
    for (const c of cases) {
      const isPass = c.status === "passed";
      const icon = isPass ? "✅" : "❌";
      const tag = isPass ? "[PASS]" : "[FAIL]";
      const timeStr = c.duration ? ` (${c.duration})` : "";
      const idStr = c.id ? `${c.id}: ` : "";
      summaryLines.push(`  ${tag} ${icon} ${idStr}${c.title}${timeStr}`);
      if (c.error && !isPass) {
        summaryLines.push(`         ⚠️ ${c.error}`);
      }
    }
    summaryLines.push(divider);
  }

  if (failed === 0 && passed > 0) {
    summaryLines.push("🚦 FINAL RESULT: ALL TESTS PASSED ✅ (ผ่านทุกกรณีทดสอบ)");
  } else if (failed > 0) {
    summaryLines.push(`🚦 FINAL RESULT: FAILED ❌ (พบข้อผิดพลาด ${failed} จาก ${summary.total} เคส)`);
  } else {
    summaryLines.push("🚦 FINAL RESULT: COMPLETED ℹ️");
  }
  summaryLines.push(border);

  return { summary, summaryLines };
}
