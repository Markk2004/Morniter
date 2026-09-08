import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { defineConfig, devices } from "@playwright/test";

function loadEnvFile(relPath: string) {
  try {
    const full = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(full)) return;
    const lines = fs.readFileSync(full, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {}
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const e2ePassword = process.env.E2E_GROUP_PASSWORD;
const runAuthenticatedE2E = process.env.PLAYWRIGHT_AUTH_E2E === "1";

if (runAuthenticatedE2E && !e2ePassword) {
  throw new Error("E2E_GROUP_PASSWORD is required when PLAYWRIGHT_AUTH_E2E=1");
}

const e2ePasswordHash =
  runAuthenticatedE2E && e2ePassword
    ? bcrypt.hashSync(e2ePassword, 4)
    : (process.env.GROUP_ACCESS_PASSWORD_HASH ||
      bcrypt.hashSync("disabled-authenticated-e2e-password", 4));

const E2E_SESSION_SECRET =
  "e2e-only-session-signing-secret-with-at-least-48-characters";

process.env.SESSION_SIGNING_SECRET ??= E2E_SESSION_SECRET;
process.env.GROUP_ACCESS_PASSWORD_HASH = e2ePasswordHash;
process.env.E2E_GROUP_PASSWORD_HASH = e2ePasswordHash;
process.env.PLAYWRIGHT_AUTH_E2E ??= "0";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
