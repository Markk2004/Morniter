import { test, expect } from "@playwright/test";
import { StsLoginPage } from "../page-objects/login.page";
import { StsStudentsPage } from "../page-objects/students.page";
import { setupStsApiMocks } from "../fixtures/mock-api";
import { DEMO_CREDENTIALS } from "../fixtures/auth-data";

test.describe("FN-STS-03: Students & Classrooms Suite", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await setupStsApiMocks(page);

    // Login as teacher first
    const loginPage = new StsLoginPage(page);
    const creds = DEMO_CREDENTIALS.teacher;
    await loginPage.goto();
    await loginPage.login(creds.username, creds.password);
    await expect(page).toHaveURL(creds.expectedPath, { timeout: 15_000 });
  });

  test("TC-STS-STU-001: Teacher views classroom student directory", async ({ page }) => {
    const studentsPage = new StsStudentsPage(page);

    await studentsPage.goto();
    await page.bringToFront();

    await expect(page).toHaveURL(/\/teacher\/students/);
    await expect(studentsPage.heading()).toBeVisible();

    // Verify student cards are displayed
    const cards = studentsPage.studentCards();
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(3000);
  });

  test("TC-STS-STU-002: Teacher searches student by name", async ({ page }) => {
    const studentsPage = new StsStudentsPage(page);

    await studentsPage.goto();
    await page.bringToFront();

    // Filter by specific student
    await studentsPage.search("กิตติพงษ์");

    await expect(page.getByText("กิตติพงษ์ สุขเกษม")).toBeVisible();
    await expect(page.getByText("ชาญชัย มีสุข")).not.toBeVisible();

    await page.waitForTimeout(3000);
  });

  test("TC-STS-STU-003: Clicking student navigates to individual profile", async ({ page }) => {
    const studentsPage = new StsStudentsPage(page);

    await studentsPage.goto();
    await page.bringToFront();

    await studentsPage.selectStudentByName("กิตติพงษ์ สุขเกษม");

    await expect(page).toHaveURL(/\/teacher\/students\/101/, { timeout: 20_000 });
    await expect(page.getByText("กิตติพงษ์ สุขเกษม").first()).toBeVisible();

    await page.waitForTimeout(3000);
  });
});
