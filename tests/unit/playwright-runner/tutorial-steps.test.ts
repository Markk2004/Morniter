import { describe, expect, it } from "vitest";
import {
  PLAYWRIGHT_TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_TARGET_IDS,
} from "@/components/playwright-runner/tutorial/tutorial-steps";

describe("Playwright tutorial steps catalog", () => {
  it("defines the approved versioned nine-step flow with visual metadata", () => {
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

    const icons = new Set(PLAYWRIGHT_TUTORIAL_STEPS.map((step) => step.icon));
    const visuals = new Set(PLAYWRIGHT_TUTORIAL_STEPS.map((step) => step.visual));

    expect(PLAYWRIGHT_TUTORIAL_STEPS).toHaveLength(9);
    expect(icons.size).toBe(9);
    expect(visuals.size).toBe(9);
    expect(PLAYWRIGHT_TUTORIAL_STEPS.every((step) => step.chapter && step.chapter.length > 0)).toBe(true);
    expect(PLAYWRIGHT_TUTORIAL_STEPS.every((step) => ["เตรียมระบบ", "เลือกการทดสอบ", "รันและตรวจผล"].includes(step.chapter))).toBe(true);
  });

  it("enforces static style guards (no gradients, no backdrop blur, no external image URLs)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const tutorialDir = path.resolve(process.cwd(), "src/components/playwright-runner/tutorial");
    const files = await fs.readdir(tutorialDir);

    for (const file of files) {
      if (file.endsWith(".tsx") || file.endsWith(".ts") || file.endsWith(".css")) {
        const content = await fs.readFile(path.join(tutorialDir, file), "utf8");
        expect(content, `File ${file} should not contain gradient classes`).not.toMatch(/\bbg-gradient|gradient-to|\btext-gradient/i);
        expect(content, `File ${file} should not contain backdrop-blur`).not.toMatch(/backdrop-blur/i);
        expect(content, `File ${file} should not contain external image URLs`).not.toMatch(/https?:\/\/[^\s"'`)]+\.(png|jpg|jpeg|svg|webp)/i);
      }
    }
  });
});
