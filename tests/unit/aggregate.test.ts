import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getMonitorSnapshot } from "@/lib/monitor/aggregate";
import { MemoryCache } from "@/lib/monitor/cache";
import { resetServerEnvCache } from "@/lib/env/server";
import type { MonitorProvider } from "@/lib/providers/types";
import type { MonitorSnapshot } from "@/lib/monitor/types";

describe("getMonitorSnapshot", () => {
  beforeEach(() => {
    resetServerEnvCache();
    vi.stubEnv("GROUP_ACCESS_PASSWORD_HASH", "$2b$12$hash");
    vi.stubEnv("SESSION_SIGNING_SECRET", "x".repeat(48));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  const successProvider: MonitorProvider = {
    source: "vercel",
    fetchSnapshot: async () => ({
      source: "vercel",
      fetchedAt: "2026-07-25T10:00:00Z",
      stale: false,
      services: [{ source: "vercel", service: "frontend", status: "healthy", checkedAt: "2026-07-25T10:00:00Z" }],
      events: [
        {
          id: "evt-1",
          source: "vercel",
          service: "frontend",
          type: "deployment",
          severity: "info",
          status: "READY",
          message: "Deployed",
          occurredAt: "2026-07-25T10:00:00Z",
        },
      ],
    }),
  };

  const failingProvider: MonitorProvider = {
    source: "render",
    fetchSnapshot: async () => ({
      source: "render",
      fetchedAt: "2026-07-25T10:00:00Z",
      stale: false,
      services: [],
      events: [],
      error: { code: "upstream_error", message: "Render API down" },
    }),
  };

  it("aggregates results and sets partial flag if any provider fails", async () => {
    const cache = new MemoryCache<MonitorSnapshot>();
    const snapshot = await getMonitorSnapshot({
      providers: [successProvider, failingProvider],
      cache,
    });

    expect(snapshot.partial).toBe(true);
    expect(snapshot.providers).toHaveLength(2);
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0].id).toBe("evt-1");
  });

  it("serves response from memory cache when fresh and bypasses cache when forceRefresh is true", async () => {
    const cache = new MemoryCache<MonitorSnapshot>();
    const fetchSpy = vi.spyOn(successProvider, "fetchSnapshot");

    const snap1 = await getMonitorSnapshot({ providers: [successProvider], cache });
    const snap2 = await getMonitorSnapshot({ providers: [successProvider], cache });

    expect(snap1).toEqual(snap2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const snap3 = await getMonitorSnapshot({ providers: [successProvider], cache, forceRefresh: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(snap3.refreshAfterSeconds).toBe(60);

    fetchSpy.mockRestore();
  });

  it("calculates refreshAfterSeconds as 60 for healthy snapshot and 20 for partial/unhealthy snapshot", async () => {
    const cache = new MemoryCache<MonitorSnapshot>();
    const healthySnap = await getMonitorSnapshot({ providers: [successProvider], cache, forceRefresh: true });
    expect(healthySnap.refreshAfterSeconds).toBe(60);

    const incidentSnap = await getMonitorSnapshot({
      providers: [successProvider, failingProvider],
      cache,
      forceRefresh: true,
    });
    expect(incidentSnap.refreshAfterSeconds).toBe(20);
  });
});
