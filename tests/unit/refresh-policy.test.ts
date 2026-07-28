import { describe, expect, it } from "vitest";
import { getRefreshAfterSeconds } from "@/lib/monitor/refresh-policy";
import type { ProviderSnapshot } from "@/lib/monitor/types";

describe("getRefreshAfterSeconds policy", () => {
  const healthyProviders: ProviderSnapshot[] = [
    {
      source: "vercel",
      fetchedAt: "2026-07-28T10:00:00Z",
      stale: false,
      services: [
        {
          source: "vercel",
          service: "web",
          status: "healthy",
          checkedAt: "2026-07-28T10:00:00Z",
        },
      ],
      events: [],
    },
  ];

  const failedProviders: ProviderSnapshot[] = [
    {
      source: "render",
      fetchedAt: "2026-07-28T10:00:00Z",
      stale: false,
      services: [
        {
          source: "render",
          service: "api",
          status: "failed",
          checkedAt: "2026-07-28T10:00:00Z",
        },
      ],
      events: [],
    },
  ];

  const errorProviders: ProviderSnapshot[] = [
    {
      source: "aiven",
      fetchedAt: "2026-07-28T10:00:00Z",
      stale: true,
      services: [],
      events: [],
      error: {
        code: "upstream_error",
        message: "Aiven API returned 500",
      },
    },
  ];

  it("returns 60 seconds for a healthy snapshot", () => {
    expect(getRefreshAfterSeconds({ partial: false, providers: healthyProviders })).toBe(60);
  });

  it("returns 20 seconds when partial is true", () => {
    expect(getRefreshAfterSeconds({ partial: true, providers: healthyProviders })).toBe(20);
  });

  it("returns 20 seconds when a service status is failed or degraded", () => {
    expect(getRefreshAfterSeconds({ partial: false, providers: failedProviders })).toBe(20);
  });

  it("returns 20 seconds when a provider has an error", () => {
    expect(getRefreshAfterSeconds({ partial: false, providers: errorProviders })).toBe(20);
  });
});
