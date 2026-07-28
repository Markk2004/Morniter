import { describe, expect, it } from "vitest";
import { CreateJobSchema, PollRequestSchema } from "@/lib/test-runner/schemas";

describe("Test Runner Zod Schemas", () => {
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
});
