import { defineConfig, devices } from "@playwright/test";

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
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      SESSION_SIGNING_SECRET: "RoLw5fpZO-N4TBtm-WirNonWWftIrY4fW6pjN8MAF30T1e6bBZWBTh3rP-nvArSY",
      GROUP_ACCESS_PASSWORD_HASH: "$2b$12$RoLw5fpZO-N4TBtm-WirNonWWftIrY4fW6pjN8MAF30T1e6bBZWBTh3rP-nvArSY",
    },
  },
});
