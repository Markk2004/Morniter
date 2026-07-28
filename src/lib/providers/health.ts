import type { ServerEnv } from "@/lib/env/server";
import type { ProviderSnapshot, ServiceStatus, MonitorEvent } from "@/lib/monitor/types";
import type { MonitorProvider } from "./types";
import { redactText } from "@/lib/monitor/redact";
import { ProviderError } from "./request";

export class HealthProvider implements MonitorProvider {
  readonly source = "health" as const;

  constructor(private env: ServerEnv) {}

  async fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot> {
    const fetchedAt = new Date().toISOString();

    if (this.env.MONITORED_HEALTH_ENDPOINTS.length === 0) {
      return {
        source: this.source,
        fetchedAt,
        stale: false,
        services: [],
        events: [],
        error: {
          code: "configuration_error",
          message: "No health check endpoints configured",
        },
      };
    }

    const services: ServiceStatus[] = [];
    const events: MonitorEvent[] = [];

    try {
      for (const endpointRef of this.env.MONITORED_HEALTH_ENDPOINTS) {
        const urlStr = endpointRef.id;

        // In production, require HTTPS
        if (process.env.NODE_ENV === "production" && !urlStr.startsWith("https://")) {
          services.push({
            source: this.source,
            service: endpointRef.label,
            status: "failed",
            checkedAt: fetchedAt,
          });
          events.push({
            id: `health-${endpointRef.label}-invalid-scheme`,
            source: this.source,
            service: endpointRef.label,
            type: "health",
            severity: "error",
            status: "FAILED",
            message: "Health check URL must use HTTPS in production",
            occurredAt: fetchedAt,
          });
          continue;
        }

        const startTime = Date.now();
        const timeoutController = new AbortController();
        const timer = setTimeout(() => timeoutController.abort(), 8000);

        const onCallerAbort = () => timeoutController.abort();
        if (signal) signal.addEventListener("abort", onCallerAbort);

        try {
          const res = await fetch(urlStr, {
            method: "GET",
            redirect: "follow",
            signal: timeoutController.signal,
          });

          const latencyMs = Date.now() - startTime;
          const isHealthy = res.ok;
          const statusStr = isHealthy ? "UP" : `DOWN (${res.status})`;

          services.push({
            source: this.source,
            service: endpointRef.label,
            status: isHealthy ? "healthy" : "failed",
            checkedAt: fetchedAt,
          });

          events.push({
            id: `health-${endpointRef.label}-${fetchedAt}`,
            source: this.source,
            service: endpointRef.label,
            type: "health",
            severity: isHealthy ? "info" : "error",
            status: statusStr,
            message: redactText(`Health check for ${endpointRef.label}: ${statusStr} in ${latencyMs}ms`),
            occurredAt: fetchedAt,
          });
        } catch (err) {
          const latencyMs = Date.now() - startTime;
          services.push({
            source: this.source,
            service: endpointRef.label,
            status: "failed",
            checkedAt: fetchedAt,
          });

          const errMsg = err instanceof Error ? err.message : "Health check request failed";
          events.push({
            id: `health-${endpointRef.label}-${fetchedAt}`,
            source: this.source,
            service: endpointRef.label,
            type: "health",
            severity: "error",
            status: "DOWN",
            message: redactText(`Health check for ${endpointRef.label} failed after ${latencyMs}ms: ${errMsg}`),
            occurredAt: fetchedAt,
          });
        } finally {
          clearTimeout(timer);
          if (signal) signal.removeEventListener("abort", onCallerAbort);
        }
      }

      return {
        source: this.source,
        fetchedAt,
        stale: false,
        services,
        events,
      };
    } catch (err) {
      const code = err instanceof ProviderError ? err.code : "upstream_error";
      const message = redactText(err instanceof Error ? err.message : "Failed to perform health checks");
      return {
        source: this.source,
        fetchedAt,
        stale: false,
        services,
        events,
        error: { code, message },
      };
    }
  }
}
