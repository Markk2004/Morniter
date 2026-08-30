import { test, expect } from "@playwright/test";

test.describe("Multi-Runner Automation and Recipe Builder E2E", () => {
  test("renders Test Explorer with runner filter chips and Recipe Builder trigger", async ({ page }) => {
    await page.goto("/test-runner");

    // Test explorer is present
    await expect(page.getByTestId("test-explorer-section")).toBeVisible({ timeout: 10000 });

    // Filter chips present
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();

    // Code Workspace has Create Draft trigger
    await expect(page.getByRole("button", { name: /Create Draft/i })).toBeVisible();

    // Click Create Draft -> Recipe Builder panel opens
    await page.getByRole("button", { name: /Create Draft/i }).click();
    await expect(page.getByTestId("recipe-builder-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Recipe Builder/i })).toBeVisible();

    // Close Recipe Builder
    await page.getByRole("button", { name: /Close/i }).click();
    await expect(page.getByTestId("recipe-builder-panel")).not.toBeVisible();
  });
});
