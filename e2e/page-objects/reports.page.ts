import type { Page } from "@playwright/test";

export class StsReportsPage {
  constructor(private readonly page: Page) {}

  async gotoDirector(): Promise<void> {
    await this.page.goto("/director/reports");
  }

  async gotoProvince(): Promise<void> {
    await this.page.goto("/province/reports");
  }

  heading() {
    return this.page.locator("h1").first();
  }

  generateButton() {
    return this.page.locator("#generate-report-btn").first();
  }

  exportPdfButton() {
    return this.page.locator("#export-pdf-btn").first();
  }

  exportExcelButton() {
    return this.page.locator("#export-excel-btn").first();
  }

  reportTypeTrigger() {
    return this.page.locator("button#report-type, select#report-type").first();
  }

  academicYearTrigger() {
    return this.page.locator("button#academic-year, select#academic-year").first();
  }

  previewTable() {
    return this.page.locator("table").first();
  }

  previewRows() {
    return this.page.locator("tbody tr");
  }
}
