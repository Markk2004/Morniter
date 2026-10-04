import type { Page } from "@playwright/test";

export class StsAttendancePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/teacher/attendance");
  }

  heading() {
    return this.page.locator("h1").first();
  }

  statusButtons() {
    return this.page.locator("button:has-text('มา'), button:has-text('ขาด'), button:has-text('สาย')");
  }

  saveButton() {
    return this.page.getByRole("button", { name: /บันทึก|แก้ไขการเช็[คก]ชื่อ/i }).first();
  }
}
