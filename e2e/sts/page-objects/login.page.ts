import type { Page } from "@playwright/test";

export class StsLoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  usernameInput() {
    return this.page.locator("#login-username");
  }

  passwordInput() {
    return this.page.locator("#login-password");
  }

  submitButton() {
    return this.page.locator("#login-submit");
  }

  alertMessage() {
    return this.page.locator('[role="alert"]:not(#__next-route-announcer__)');
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput().fill(username);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
  }
}
