import "server-only";
import { getMonitorSnapshot } from "./aggregate";
import { getServerEnv } from "@/lib/env/server";
import { createProviders, type MonitorProvider } from "@/lib/providers/types";
import type { MonitorDiagnosticsResult, MonitorSnapshot } from "./types";

export class DiagnosticLookupError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
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

  const providers = overrides?.providers ?? createProviders(getServerEnv());
  const provider = providers.find((candidate) => candidate.source === event.source);
  if (!provider?.fetchDiagnostics) {
    throw new DiagnosticLookupError(400, "Provider diagnostics are unavailable");
  }
  return provider.fetchDiagnostics(event, signal);
}
