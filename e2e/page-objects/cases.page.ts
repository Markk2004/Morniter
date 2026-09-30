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
    return this.page.locator("a[href='/teacher/cases/create'], a:has-text('เปิดเคสใหม่'), a:has-text('บันทึกเคสใหม่')").first();
  }

  searchInput() {
    return this.page.getByPlaceholder(/ค้นหา/i);
  }

  studentSelect() {
    return this.page.locator("select#student, select[name='studentId'], [role='combobox']").first();
  }

  async fillForm(opts: {
    studentName?: string;
    title: string;
    description: string;
    severity?: "low" | "medium" | "high";
  }): Promise<void> {
    // 1. Select student
    const studentEl = this.studentSelect();
    if ((await studentEl.count()) > 0) {
      const tagName = await studentEl.evaluate((el) => el.tagName.toLowerCase());
      if (tagName === "select") {
        const options = await studentEl.locator("option").all();
        if (options.length > 1) {
          const val = await options[1].getAttribute("value");
          if (val) await studentEl.selectOption(val);
        }
      } else {
        await studentEl.click();
        await this.page.waitForTimeout(300);
        if (opts.studentName) {
          const matchOpt = this.page.getByRole("option", { name: new RegExp(opts.studentName, "i") });
          if ((await matchOpt.count()) > 0) {
            await matchOpt.first().click();
          } else {
            const allOpts = this.page.getByRole("option");
            if ((await allOpts.count()) > 1) {
              await allOpts.nth(1).click();
            } else {
              await allOpts.first().click();
            }
          }
        } else {
          const allOpts = this.page.getByRole("option");
          if ((await allOpts.count()) > 1) {
            await allOpts.nth(1).click();
          } else {
            await allOpts.first().click();
          }
        }
      }
    }

    // 2. Fill title and description (ProjectSTS uses TextareaField for both)
    const titleEl = this.page.locator("textarea#title, input#title").first();
    await titleEl.fill(opts.title);

    const descEl = this.page.locator("textarea#description, input#description").first();
    await descEl.fill(opts.description);

    // 3. Severity if present in UI
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
    await this.page.getByRole("button", { name: /เปิดเคส|บันทึกเปิดเคส|บันทึกข้อมูล/i }).first().click();
  }
}

