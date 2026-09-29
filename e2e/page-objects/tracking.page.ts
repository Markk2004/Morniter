import type { Page } from "@playwright/test";

export class StsTrackingPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/teacher/tracking");
  }

  heading() {
    return this.page.locator("h1").first();
  }

  searchInput() {
    return this.page.getByPlaceholder(/ค้นหาชื่อ, รหัส/i);
  }

  riskFilterTrigger() {
    return this.page.locator("#risk-filter");
  }

  async filterByRisk(riskLabel: "ทุกระดับความเสี่ยง" | "เสี่ยงสูง" | "เสี่ยงปานกลาง" | "ปกติ"): Promise<void> {
    await this.riskFilterTrigger().click();
    await this.page.waitForTimeout(400);
    await this.page.getByRole("option", { name: new RegExp(riskLabel, "i") }).first().click();
  }

  studentRow(name: string) {
    return this.page.locator("button", { hasText: name });
  }
}
