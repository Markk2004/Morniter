import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  STS_FUNCTION_TEMPLATES,
  STS_SUB_TEMPLATES,
} from "@/lib/playwright-runner/function-templates";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("All Workspace Templates Playwright Dry-Run Verification", () => {
  const allTemplates = {
    ...STS_FUNCTION_TEMPLATES,
    ...STS_SUB_TEMPLATES,
  };

  const tempDir = path.resolve(process.cwd(), "e2e/__workspace__/verify-syntax");

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  for (const [key, tpl] of Object.entries(allTemplates)) {
    it(`parses and lists tests for ${key} (${tpl.name}) cleanly via Playwright`, () => {
      const specPath = path.join(tempDir, `${key.toLowerCase()}.spec.ts`);
      fs.writeFileSync(specPath, tpl.code, "utf8");

      const relPath = path.relative(process.cwd(), specPath).replace(/\\/g, "/");

      try {
        const output = execSync(
          `npx playwright test --config=playwright.sts.config.ts "${relPath}" --list`,
          {
            cwd: process.cwd(),
            encoding: "utf8",
            timeout: 20000,
          },
        );

        // Ensure tests were discovered and no errors were raised
        expect(output).toContain("Total:");
        expect(output).not.toContain("Error:");
      } catch (err: unknown) {
        const error = err as { stdout?: string; stderr?: string; message?: string };
        throw new Error(
          `Template ${key} failed Playwright dry-run syntax check:\n${error.stdout || ""}\n${error.stderr || ""}\n${error.message || ""}`,
        );
      }
    });
  }
});
