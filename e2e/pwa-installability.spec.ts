import { test, expect } from "@playwright/test";

test.describe("PWA Installability & Desktop Assets", () => {
  test("serves valid Web App Manifest with standalone display and icons", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("manifest+json");

    const manifest = await res.json();
    expect(manifest.name).toBe("Project Monitor");
    expect(manifest.short_name).toBe("Monitor");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/monitor");
    expect(manifest.scope).toBe("/");
    expect(manifest.background_color).toBe("#0a0d14");
    expect(manifest.theme_color).toBe("#0a0d14");

    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const icon192 = manifest.icons.find((i: { sizes: string }) => i.sizes === "192x192");
    const icon512 = manifest.icons.find((i: { sizes: string }) => i.sizes === "512x512");
    expect(icon192).toBeDefined();
    expect(icon512).toBeDefined();
    expect(icon192.src).toBe("/icons/icon-192.png");
    expect(icon512.src).toBe("/icons/icon-512.png");
  });

  test("serves all PWA icons, favicon, and apple-touch-icon with HTTP 200", async ({ request }) => {
    const assets = [
      { path: "/icons/icon-192.png", expectedType: "image/png" },
      { path: "/icons/icon-512.png", expectedType: "image/png" },
      { path: "/icons/icon-180.png", expectedType: "image/png" },
      { path: "/favicon.ico", expectedType: "image/" },
    ];

    for (const asset of assets) {
      const res = await request.get(asset.path);
      expect(res.status(), `Asset ${asset.path} must return 200`).toBe(200);
      expect(res.headers()["content-type"]).toContain(asset.expectedType);
      const buffer = await res.body();
      expect(buffer.length, `Asset ${asset.path} must not be empty`).toBeGreaterThan(100);
    }
  });

  test("serves Service Worker with correct caching boundaries", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("javascript");

    const code = await res.text();
    expect(code).toContain("skipWaiting");
    expect(code).toContain("clients.claim");
    // Verify boundaries: never caches /api/, /monitor, or /login
    expect(code).toContain('url.pathname.startsWith("/api/")');
    expect(code).toContain('url.pathname.startsWith("/monitor")');
    expect(code).toContain('url.pathname.startsWith("/login")');
  });

  test("renders manifest link and PWA metadata in HTML document head", async ({ page }) => {
    await page.goto("/login");

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");

    const themeColorMeta = page.locator('meta[name="theme-color"]');
    await expect(themeColorMeta).toHaveAttribute("content", "#0a0d14");

    const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleTouchIcon).toHaveAttribute("href", "/icons/icon-180.png");
  });

  test("handles beforeinstallprompt event safely in PWA install prompt banner", async ({ page }) => {
    await page.goto("/login");

    // Banner is not visible when beforeinstallprompt has not fired
    const banner = page.getByRole("complementary", { name: /Desktop app installation/i });
    await expect(banner).toBeHidden();

    // Trigger fake beforeinstallprompt event
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt") as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string; platform: string }>;
      };
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
      window.dispatchEvent(event);
    });

    // Banner appears with install button
    await expect(banner).toBeVisible();
    const installBtn = banner.getByRole("button", { name: /Install app/i });
    await expect(installBtn).toBeVisible();

    // Clicking install triggers prompt and dismisses banner
    await installBtn.click();
    await expect(banner).toBeHidden();
  });
});
