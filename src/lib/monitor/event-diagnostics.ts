import "server-only";
import { getMonitorSnapshot } from "./aggregate";
import { getServerEnv } from "@/lib/env/server";
import { createProviders, type MonitorProvider } from "@/lib/providers/types";
import type { MonitorDiagnosticsResult, MonitorSnapshot } from "./types";
import { MemoryCache } from "./cache";

const DIAGNOSTICS_TTL_MS = 60_000;
const globalDiagnosticsCache = new MemoryCache<MonitorDiagnosticsResult>(DIAGNOSTICS_TTL_MS);
const inFlightMap = new Map<string, Promise<MonitorDiagnosticsResult>>();

export class DiagnosticLookupError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function clearDiagnosticCache(): void {
  globalDiagnosticsCache.clear();
  inFlightMap.clear();
}

export async function getEventDiagnostics(
  eventId: string,
  signal?: AbortSignal,
  overrides?: { snapshot: MonitorSnapshot; providers: MonitorProvider[] },
): Promise<MonitorDiagnosticsResult> {
  const snapshot = overrides?.snapshot ?? (await getMonitorSnapshot({ signal }));
  const event = snapshot.events.find((candidate) => candidate.id === eventId);
  if (!event) throw new DiagnosticLookupError(404, "Monitor event not found");
  if (!event.diagnosticAvailable) {
    throw new DiagnosticLookupError(400, "Diagnostics are unavailable for this event");
  }

  const cacheKey = `${event.source}:${event.id}`;
  const cached = globalDiagnosticsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existingInFlight = inFlightMap.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const providers = overrides?.providers ?? createProviders(getServerEnv());
  const provider = providers.find((candidate) => candidate.source === event.source);
  if (!provider?.fetchDiagnostics) {
    throw new DiagnosticLookupError(400, "Provider diagnostics are unavailable");
  }

  const fetchFn = provider.fetchDiagnostics.bind(provider);

  const promise = (async () => {
    const result = await fetchFn(event, signal);
    globalDiagnosticsCache.set(cacheKey, result, DIAGNOSTICS_TTL_MS);
    return result;
  })();

  inFlightMap.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    inFlightMap.delete(cacheKey);
  }
}
