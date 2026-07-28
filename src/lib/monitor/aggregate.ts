import "server-only";
import type { MonitorSnapshot, ProviderSnapshot, MonitorEvent } from "./types";
import type { MonitorProvider } from "@/lib/providers/types";
import { createProviders } from "@/lib/providers/types";
import { getServerEnv } from "@/lib/env/server";
import { MemoryCache } from "./cache";
import { getRefreshAfterSeconds } from "./refresh-policy";

const SNAPSHOT_TTL_MS = 30_000;
const globalSnapshotCache = new MemoryCache<MonitorSnapshot>(SNAPSHOT_TTL_MS);
const CACHE_KEY = "monitor_snapshot";

export interface AggregateOptions {
  providers?: MonitorProvider[];
  cache?: MemoryCache<MonitorSnapshot>;
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

export async function getMonitorSnapshot(options: AggregateOptions = {}): Promise<MonitorSnapshot> {
  const cache = options.cache ?? globalSnapshotCache;
  if (!options.forceRefresh) {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const env = getServerEnv();
  const providers = options.providers ?? createProviders(env);

  const results = await Promise.allSettled(
    providers.map((p) => p.fetchSnapshot(options.signal)),
  );

  const providerSnapshots: ProviderSnapshot[] = [];
  const allEvents: MonitorEvent[] = [];
  let partial = false;

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const source = providers[i].source;

    if (res.status === "fulfilled") {
      const snap = res.value;
      providerSnapshots.push(snap);
      if (snap.error) {
        partial = true;
      }
      allEvents.push(...snap.events);
    } else {
      partial = true;
      const fetchedAt = new Date().toISOString();
      const errMsg = res.reason instanceof Error ? res.reason.message : "Provider failed";
      providerSnapshots.push({
        source,
        fetchedAt,
        stale: false,
        services: [],
        events: [],
        error: { code: "upstream_error", message: errMsg },
      });
    }
  }

  // Sort events newest first
  allEvents.sort(
    (left, right) => Date.parse(right.occurredAt || "") - Date.parse(left.occurredAt || ""),
  );

  // Cap at 500 events max
  const cappedEvents = allEvents.slice(0, 500);

  const refreshAfterSeconds = getRefreshAfterSeconds({
    partial,
    providers: providerSnapshots,
  });

  const snapshot: MonitorSnapshot = {
    generatedAt: new Date().toISOString(),
    refreshAfterSeconds,
    partial,
    providers: providerSnapshots,
    events: cappedEvents,
  };

  cache.set(CACHE_KEY, snapshot, SNAPSHOT_TTL_MS);
  return snapshot;
}

export function clearSnapshotCache(): void {
  globalSnapshotCache.clear();
}
