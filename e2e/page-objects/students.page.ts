import type { Page } from "@playwright/test";

export class StsStudentsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/teacher/students");
  }

  heading() {
    return this.page.getByRole("heading", { name: /นักเรียนในชั้น/i });
  }

  searchInput() {
    return this.page.getByPlaceholder(/ค้นหาชื่อ, รหัส/i);
  }

  studentCards() {
    return this.page.locator("a[href*='/teacher/students/']");
  }

  async search(query: string): Promise<void> {
    await this.searchInput().fill(query);
  }

  async selectStudentByName(name: string): Promise<void> {
    const card = this.page.locator("a[href*='/teacher/students/']", { hasText: name });
    await card.first().click();
  }
}
