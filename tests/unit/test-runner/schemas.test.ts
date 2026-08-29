import { describe, expect, it } from "vitest";
import {
  AgentHeartbeatSchema,
  AppendLogBatchSchema,
  CompleteJobSchema,
  CreateJobSchema,
  PollRequestSchema,
  TestProgressSchema,
  TestPresetSchema,
  TestProjectSchema,
  TestProjectCatalogSchema,
} from "@/lib/test-runner/schemas";

describe("Legacy Test Runner Zod Schemas", () => {
  it("keeps the preset-runner API contract available", () => {
    expect(
      PollRequestSchema.safeParse({
        agentId: "windows-local-agent-1",
        catalogVersion: "1.0.0",
      }).success,
    ).toBe(true);
    expect(CreateJobSchema).toBeDefined();
    expect(AppendLogBatchSchema).toBeDefined();
    expect(AgentHeartbeatSchema).toBeDefined();
    expect(CompleteJobSchema).toBeDefined();
    expect(TestPresetSchema).toBeDefined();
    expect(TestProjectSchema).toBeDefined();
    expect(TestProjectCatalogSchema).toBeDefined();
  });

  it("parses valid CreateJobSchema containing only projectId and presetId", () => {
    const valid = CreateJobSchema.parse({
      projectId: "student-tracking",
      presetId: "cypress-e2e",
    });

    expect(valid).toEqual({
      projectId: "student-tracking",
      presetId: "cypress-e2e",
    });
  });

  it("rejects CreateJobSchema when extra unknown fields or arbitrary commands are passed", () => {
    expect(() =>
      CreateJobSchema.parse({
        projectId: "student-tracking",
        presetId: "cypress-e2e",
        command: "npx arbitrary-package",
      }),
    ).toThrow();
  });

  it("validates ID formats restricting to /^[a-z0-9][a-z0-9-]{0,63}$/", () => {
    expect(() =>
      CreateJobSchema.parse({
        projectId: "INVALID_PROJECT",
        presetId: "cypress-e2e",
      }),
    ).toThrow();
  });

  it("validates PollRequestSchema from agent", () => {
    const validPoll = PollRequestSchema.parse({
      agentId: "agent-win-1",
      catalogVersion: "1.0.0",
    });
    expect(validPoll.agentId).toBe("agent-win-1");
  });

  it("validates TestProgressSchema for framework progress parsing", () => {
    const validProgress = TestProgressSchema.parse({
      framework: "jest",
      completed: 129,
      total: 258,
      percentage: 50,
      currentLabel: "tests/unit/a.test.ts",
      updatedAt: new Date().toISOString(),
    });
    expect(validProgress.percentage).toBe(50);
  });

  it("validates AppendLogBatchSchema with max 100 entries", () => {
    const validBatch = AppendLogBatchSchema.parse({
      sequenceStart: 0,
      entries: [
        { stream: "stdout", message: "Hello world" },
        { stream: "stderr", message: "Warning line" },
      ],
    });
    expect(validBatch.entries).toHaveLength(2);
  });

  it("validates CompleteJobSchema with status and exit code", () => {
    const validComplete = CompleteJobSchema.parse({
      status: "passed",
      exitCode: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
    expect(validComplete.status).toBe("passed");
  });
});
