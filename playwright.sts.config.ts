import { defineConfig, devices } from "@playwright/test";

const STS_BASE_URL = process.env.STS_BASE_URL || "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "sts/**/*.spec.ts",
    "sts/**/*.test.ts",
    "workspace/**/*.spec.ts",
    "workspace/**/*.test.ts",
    "__workspace__/**/*.spec.ts",
    "__workspace__/**/*.test.ts",
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-sts", open: "never" }],
  ],
  use: {
    baseURL: STS_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { slowMo: 500 },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: { slowMo: 500 },
      },
    },
    {
      name: "msedge",
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
        launchOptions: { slowMo: 500 },
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        launchOptions: { slowMo: 500 },
      },
    },
  ],
});
