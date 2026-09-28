import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-09: AI Insights & Benchmark Evaluation Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    // Login as school-admin
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS["school-admin"];
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  test("TC-STS-AI-001: School Admin visits AI Evaluation page and inspects benchmark controls", async ({ page }) => {
    await page.goto("/admin/ai-evaluation");
    await page.bringToFront();

    await expect(page).toHaveURL(/\/admin\/ai-evaluation/);
    await expect(page.locator("h1")).toContainText("การประเมินและทดสอบระบบ AI");

    // Check input and run button
    await expect(page.getByPlaceholder(/ระบุ Run ID/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /เริ่มการประเมิน Benchmark/i })).toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-AI-002: School Admin triggers AI benchmark run and verifies evaluation metrics", async ({ page }) => {
    await page.goto("/admin/ai-evaluation");
    await page.bringToFront();

    // Fill Run ID
    await page.getByPlaceholder(/ระบุ Run ID/i).fill("run-zero-shot-001");

    // Click run benchmark
    await page.getByRole("button", { name: /เริ่มการประเมิน Benchmark/i }).click();

    // Verify summary block renders with results
    await expect(page.getByText("run-zero-shot-001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("COMPLETED")).toBeVisible();
    await expect(page.getByText("จำนวนเคสทั้งหมด").first()).toBeVisible();
    await expect(page.getByText("ประมวลผลสำเร็จ").first()).toBeVisible();

    await page.waitForTimeout(3000);
  });
});
