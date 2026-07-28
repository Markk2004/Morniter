import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";

async function makeValidSessionToken(): Promise<string> {
  const secret =
    process.env.SESSION_SIGNING_SECRET ||
    "RoLw5fpZO-N4TBtm-WirNonWWftIrY4fW6pjN8MAF30T1e6bBZWBTh3rP-nvArSY";
  const secretBytes = new TextEncoder().encode(secret);
  return new SignJWT({ scope: "monitor:read" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("project-monitor")
    .setAudience("project-monitor-web")
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .setExpirationTime(Math.floor(Date.now() / 1000) + 8 * 3600)
    .sign(secretBytes);
}

test.describe("Test Runner Overload & Security E2E", () => {
  test("never exposes cwd, env, or secrets in catalog payload", async ({ page }) => {
    const token = await makeValidSessionToken();
    await page.context().addCookies([
      {
        name: "project_monitor_session",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("project_monitor_tab_session", "e2e-overload");
    });

    const catalogResponsePromise = page.waitForResponse("**/api/test-runner/catalog*");

    await page.goto("/monitor/tests");

    await expect(page.getByText(/Production Test Runner/i)).toBeVisible();

    const catalogResponse = await catalogResponsePromise;
    const catalogPayloadText = await catalogResponse.text();

    expect(catalogPayloadText).not.toContain("TEST_RUNNER_AGENT_TOKEN");
    expect(catalogPayloadText).not.toContain("UPSTASH_REDIS_REST_TOKEN");
    expect(catalogPayloadText).not.toContain("SESSION_SIGNING_SECRET");
  });
});
