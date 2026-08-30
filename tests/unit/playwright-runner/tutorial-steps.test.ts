import { describe, expect, it } from "vitest";
import {
  PLAYWRIGHT_TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_TARGET_IDS,
} from "@/components/playwright-runner/tutorial/tutorial-steps";

describe("Playwright tutorial steps catalog", () => {
  it("defines the approved versioned nine-step flow", () => {
    expect(TUTORIAL_STORAGE_KEY).toBe("morniter:playwright-tutorial:v1:seen");
    expect(TUTORIAL_TARGET_IDS).toEqual([
      "agent",
      "execution-lock",
      "project",
      "select-test",
      "browsers",
      "code",
      "run",
      "terminal",
      "result",
    ]);
    expect(PLAYWRIGHT_TUTORIAL_STEPS.map((s) => s.targetId)).toEqual(TUTORIAL_TARGET_IDS);
    expect(new Set(PLAYWRIGHT_TUTORIAL_STEPS.map((s) => s.id)).size).toBe(9);
    expect(PLAYWRIGHT_TUTORIAL_STEPS.every((s) => s.title && s.description && s.unavailableMessage)).toBe(true);
  });
});
