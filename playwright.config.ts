import bcrypt from "bcryptjs";
import { defineConfig, devices } from "@playwright/test";

const e2ePassword = process.env.E2E_GROUP_PASSWORD;
const runAuthenticatedE2E = process.env.PLAYWRIGHT_AUTH_E2E === "1";

if (runAuthenticatedE2E && !e2ePassword) {
  throw new Error("E2E_GROUP_PASSWORD is required when PLAYWRIGHT_AUTH_E2E=1");
}

const e2ePasswordHash = bcrypt.hashSync(
  e2ePassword ?? "disabled-authenticated-e2e-password",
  4,
);

const E2E_SESSION_SECRET =
  "e2e-only-session-signing-secret-with-at-least-48-characters";

export default defineConfig({
  testDir: "./e2e",
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
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    env: {
      SESSION_SIGNING_SECRET:
        process.env.SESSION_SIGNING_SECRET ?? E2E_SESSION_SECRET,
      GROUP_ACCESS_PASSWORD_HASH: e2ePasswordHash,
    },
  },
});
