import type { ServerEnv } from "@/lib/env/server";
import type { ProviderSnapshot, ServiceStatus, MonitorEvent } from "@/lib/monitor/types";
import type { MonitorProvider } from "./types";
import { fetchJson, ProviderError } from "./request";
import { redactText } from "@/lib/monitor/redact";
import { z } from "zod";

const aivenServiceSchema = z.object({
  service: z.object({
    service_name: z.string(),
    service_type: z.string(),
    state: z.string(),
    create_time: z.string().optional(),
    update_time: z.string().optional(),
  }),
});

export function normalizeAivenState(rawState: string): {
  status: ServiceStatus["status"];
  severity: MonitorEvent["severity"];
  normalizedState: string;
} {
  const normalizedState = rawState.replace(/[^A-Z]/gi, "").toUpperCase();

  if (normalizedState === "RUNNING") {
    return { status: "healthy", severity: "info", normalizedState };
  }

  if (normalizedState === "REBUILDING" || normalizedState === "REBALANCING") {
    return { status: "degraded", severity: "warning", normalizedState };
  }

  if (
    normalizedState === "POWEROFF" ||
    normalizedState === "POWEREDOFF" ||
    normalizedState === "FAILED"
  ) {
    return { status: "failed", severity: "error", normalizedState };
  }

  return { status: "unknown", severity: "warning", normalizedState };
}

export class AivenProvider implements MonitorProvider {
  readonly source = "aiven" as const;

  constructor(private env: ServerEnv) {}

  async fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot> {
    const fetchedAt = new Date().toISOString();

    if (
      !this.env.AIVEN_API_TOKEN ||
      !this.env.AIVEN_PROJECT_NAME ||
      this.env.AIVEN_SERVICE_NAMES.length === 0
    ) {
      return {
        source: this.source,
        fetchedAt,
        stale: false,
        services: [],
        events: [],
        error: {
          code: "configuration_error",
          message: "Aiven API token, project name or service names not configured",
        },
      };
    }

    const services: ServiceStatus[] = [];
    const events: MonitorEvent[] = [];

    try {
      for (const serviceRef of this.env.AIVEN_SERVICE_NAMES) {
        const url = `https://api.aiven.io/v1/project/${encodeURIComponent(
          this.env.AIVEN_PROJECT_NAME,
        )}/service/${encodeURIComponent(serviceRef.id)}`;

        const data = await fetchJson(
          url,
          {
            headers: {
              Authorization: `aivenv1 ${this.env.AIVEN_API_TOKEN}`,
            },
          },
          aivenServiceSchema,
          signal,
        );

        const state = normalizeAivenState(data.service.state);

        services.push({
          source: this.source,
          service: serviceRef.label,
          status: state.status,
          checkedAt: fetchedAt,
          databaseName: this.env.AIVEN_DATABASE_NAME,
        });

        const occurredAt = data.service.update_time || data.service.create_time || fetchedAt;

        events.push({
          id: `aiven-${data.service.service_name}-${state.normalizedState}`,
          source: this.source,
          service: serviceRef.label,
          type: "database",
          severity: state.severity,
          status: data.service.state,
          message: redactText(
            `Aiven service ${data.service.service_name} (${data.service.service_type}) state is ${data.service.state}; Database target: ${this.env.AIVEN_DATABASE_NAME}`,
          ),
          occurredAt,
          externalUrl: `https://console.aiven.io/project/${encodeURIComponent(
            this.env.AIVEN_PROJECT_NAME,
          )}/services/${encodeURIComponent(data.service.service_name)}`,
          databaseName: this.env.AIVEN_DATABASE_NAME,
        });
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
      const message = redactText(err instanceof Error ? err.message : "Failed to fetch Aiven data");
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
