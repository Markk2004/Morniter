import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { STS_FUNCTION_TEMPLATES, STS_SUB_TEMPLATES } from "../src/lib/playwright-runner/function-templates.ts";

const allTemplates = {
  ...STS_FUNCTION_TEMPLATES,
  ...STS_SUB_TEMPLATES,
};

const testDir = path.resolve(process.cwd(), "e2e/__workspace__/verify-offline");
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

console.log("=================================================");
console.log("Testing All 14 Templates with Port 3001 OFFLINE");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

for (const [key, tpl] of Object.entries(allTemplates)) {
  const testFile = path.resolve(testDir, `${key.toLowerCase()}.spec.ts`);
  fs.writeFileSync(testFile, tpl.code, "utf-8");
  const relPath = path.relative(process.cwd(), testFile).replace(/\\/g, "/");

  process.stdout.write(`Testing ${key} (${tpl.shortName})... `);
  try {
    execSync(
      `npx playwright test --config=playwright.sts.config.ts --project=chromium "${relPath}"`,
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: { ...process.env, STS_BASE_URL: "http://127.0.0.1:3001" },
        timeout: 30000,
      }
    );
    console.log("✅ PASSED");
    passed++;
  } catch (err) {
    console.log("❌ FAILED");
    console.error(err.stdout || err.stderr || err.message);
    failed++;
  } finally {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  }
}

if (fs.existsSync(testDir)) fs.rmdirSync(testDir);

console.log("\n=================================================");
console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) process.exit(1);
