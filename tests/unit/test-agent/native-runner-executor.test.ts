import { describe, expect, it, vi } from "vitest";
import { runNativeExecutionGroup } from "../../../agent/src/native-runner-executor";
import type { NativeExecutionGroup } from "../../../agent/src/native-runner-plan";

describe("Native Runner Executor", () => {
  it("executes a group, tags logs with runner name, and returns NativeGroupResult", async () => {
    const lines: string[] = [];
    const group: NativeExecutionGroup = {
      runner: "node-test",
      executionProfileId: "frontend-node",
      command: process.execPath,
      args: ["-e", 'console.log("hello from test"); process.exit(0);'],
      cwd: process.cwd(),
      env: { NODE_ENV: "test" },
      testIds: ["node-test-1"],
      relativePaths: ["frontend/tests/auth.test.mjs"],
      timeoutSeconds: 30,
    };

    const result = await runNativeExecutionGroup(group, {
      onLines: (stream, batch) => {
        lines.push(...batch);
      },
    });

    expect(result.status).toBe("passed");
    expect(result.runner).toBe("node-test");
    expect(result.exitCode).toBe(0);
    expect(lines.some((l) => l.includes("[NODE]") && l.includes("hello from test"))).toBe(true);
  });

  it("handles non-zero exit codes with failed status", async () => {
    const group: NativeExecutionGroup = {
      runner: "jest",
      executionProfileId: "backend-jest",
      command: process.execPath,
      args: ["-e", 'console.error("syntax error in spec"); process.exit(1);'],
      cwd: process.cwd(),
      env: { NODE_ENV: "test" },
      testIds: ["jest-fail-1"],
      relativePaths: ["backend/src/fail.spec.ts"],
      timeoutSeconds: 30,
    };

    const result = await runNativeExecutionGroup(group, {
      onLines: vi.fn(),
    });

    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(1);
  });

  it("cancels execution cleanly when AbortSignal triggers", async () => {
    const controller = new AbortController();
    const group: NativeExecutionGroup = {
      runner: "jest-e2e",
      executionProfileId: "backend-jest-e2e",
      command: process.execPath,
      args: ["-e", 'setTimeout(() => {}, 10000);'],
      cwd: process.cwd(),
      env: { NODE_ENV: "test" },
      testIds: ["jest-e2e-hang"],
      relativePaths: ["backend/test/hang.e2e-spec.ts"],
      timeoutSeconds: 30,
    };

    setTimeout(() => controller.abort(), 200);
    const result = await runNativeExecutionGroup(group, {
      onLines: vi.fn(),
    }, controller.signal);

    expect(result.status).toBe("cancelled");
  });
});
