import { describe, expect, it } from "vitest";
import { runPreset } from "../../../agent/src/executor";

describe("Agent Executor", () => {
  it.runIf(process.platform === "win32")("runs npm.cmd without spawn EINVAL on Windows", async () => {
    const result = await runPreset({
      projectId: "monitor",
      presetId: "npm-version",
      name: "npm version",
      description: "",
      command: "npm",
      args: ["--version"],
      cwd: process.cwd(),
      env: {},
      timeoutSeconds: 20,
      metadata: { category: "automated", srsIds: [], risk: "safe", databaseTarget: "none" },
    });

    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
  });

  it("kills a running process when aborted via AbortSignal", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    const result = await runPreset(
      {
        projectId: "test",
        presetId: "sleep",
        name: "Long Sleep",
        description: "",
        command: "node",
        args: ["-e", "setTimeout(() => {}, 10000)"],
        cwd: process.cwd(),
        env: {},
        timeoutSeconds: 30,
        metadata: { category: "automated", srsIds: [], risk: "safe", databaseTarget: "none" },
      },
      undefined,
      controller.signal,
    );

    expect(result.status).toBe("cancelled");
  });

  it("kills a running process when preset timeout expires", async () => {
    const result = await runPreset({
      projectId: "test",
      presetId: "timeout",
      name: "Timeout Sleep",
      description: "",
      command: "node",
      args: ["-e", "setTimeout(() => {}, 10000)"],
      cwd: process.cwd(),
      env: {},
      timeoutSeconds: 1, // 1 second timeout
      metadata: { category: "automated", srsIds: [], risk: "safe", databaseTarget: "none" },
    });

    expect(result.status).toBe("timed_out");
  });
});
