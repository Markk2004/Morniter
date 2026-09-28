import type { Page } from "@playwright/test";

export class StsCasesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/teacher/cases");
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto("/teacher/cases/create");
  }

  heading() {
    return this.page.locator("h1").first();
  }

  createButton() {
    return this.page.getByRole("link", { name: /บันทึกเคสใหม่|เปิดเคสใหม่/i }).first();
  }

  searchInput() {
    return this.page.getByPlaceholder(/ค้นหา/i);
  }

  studentCombobox() {
    return this.page.locator("button#student, [role='combobox']").first();
  }

  async fillForm(opts: {
    studentName?: string;
    title: string;
    description: string;
    severity?: "low" | "medium" | "high";
  }): Promise<void> {
    // 1. Select student
    await this.studentCombobox().click();
    await this.page.waitForTimeout(400);

    if (opts.studentName) {
      await this.page.getByRole("option", { name: new RegExp(opts.studentName, "i") }).first().click();
    } else {
      const options = this.page.getByRole("option");
      const count = await options.count();
      if (count > 1) {
        await options.nth(1).click();
      } else {
        await options.first().click();
      }
    }

    // 2. Fill title and description
    await this.page.locator("input#title").fill(opts.title);
    await this.page.locator("textarea#description").fill(opts.description);

    // 3. Severity if provided
    if (opts.severity) {
      const severityTrigger = this.page.locator("button#severity");
      if (await severityTrigger.isVisible()) {
        await severityTrigger.click();
        await this.page.waitForTimeout(300);
        const sevRegex =
          opts.severity === "high"
            ? /สูง/
            : opts.severity === "medium"
            ? /ปานกลาง/
            : /ต่ำ/;
        await this.page.getByRole("option", { name: sevRegex }).first().click();
      }
    }
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: /บันทึกเปิดเคส|บันทึกข้อมูล/i }).click();
  }
}
