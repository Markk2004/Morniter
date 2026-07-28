import { describe, expect, it } from "vitest";
import { runPreset } from "../../../agent/src/executor";
import type { ResolvedPreset } from "../../../agent/src/types";

describe("Safe Process Executor", () => {
  it("executes Node process cleanly with shell: false and captures stdout", async () => {
    const preset: ResolvedPreset = {
      projectId: "test-proj",
      presetId: "node-ver",
      name: "Node Version Check",
      description: "Checks node version",
      command: process.execPath,
      args: ["-e", 'console.log("HELLO_LOCAL_AGENT")'],
      cwd: process.cwd(),
      env: {},
      timeoutSeconds: 10,
    };

    const lines: string[] = [];
    const result = await runPreset(preset, {
      onLines: (stream, batch) => {
        if (stream === "stdout") {
          lines.push(...batch);
        }
      },
    });

    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(lines.join("\n")).toContain("HELLO_LOCAL_AGENT");
  });

  it("handles non-zero exit code as failed status", async () => {
    const preset: ResolvedPreset = {
      projectId: "test-proj",
      presetId: "node-fail",
      name: "Failing Node script",
      description: "Fails with exit code 2",
      command: process.execPath,
      args: ["-e", "process.exit(2)"],
      cwd: process.cwd(),
      env: {},
      timeoutSeconds: 10,
    };

    const result = await runPreset(preset, {
      onLines: () => {},
    });

    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(2);
  });
});
