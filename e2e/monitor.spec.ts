import { test, expect } from "@playwright/test";

test.describe("Project Monitor E2E Flow", () => {
  test("redirects unauthenticated visitor from /monitor to /login", async ({ page }) => {
    await page.goto("/monitor");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/group password/i)).toBeVisible();
  });

  test("shows generic error on wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/group password/i).fill("wrong-password-123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
