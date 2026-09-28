import type { Page } from "@playwright/test";

export class StsUsersPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/admin/users");
  }

  heading() {
    return this.page.locator("h1").first();
  }

  addUserButton() {
    return this.page.locator("#add-user-btn");
  }

  searchInput() {
    return this.page.getByPlaceholder(/ค้นหา/i);
  }

  kpiActiveButton() {
    return this.page.getByRole("button", { name: /ใช้งานได้/i });
  }

  kpiSuspendedButton() {
    return this.page.getByRole("button", { name: /ถูกระงับ/i });
  }

  tableRows() {
    return this.page.locator("tbody tr");
  }

  modal() {
    return this.page.locator("dialog");
  }

  modalTitle() {
    return this.modal().locator("h2, h3").first();
  }

  fullNameInput() {
    return this.modal().locator("input#form-full_name");
  }

  usernameInput() {
    return this.modal().locator("input#form-username");
  }

  passwordInput() {
    return this.modal().locator("input#form-password");
  }

  submitButton() {
    return this.modal().getByRole("button", { name: "เพิ่มผู้ใช้" });
  }

  cancelButton() {
    return this.modal().getByRole("button", { name: "ยกเลิก" });
  }
}
