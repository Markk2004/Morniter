import type { Page } from "@playwright/test";

export class StsDashboardPage {
  constructor(private readonly page: Page) {}

  heading() {
    return this.page.locator("h1, h2").first();
  }

  metricCards() {
    return this.page.locator(".card, [data-testid*='metric']");
  }

  navLink(name: string | RegExp) {
    return this.page.getByRole("link", { name });
  }

  async navigateTo(linkName: string | RegExp): Promise<void> {
    await this.navLink(linkName).first().click();
  }
}
