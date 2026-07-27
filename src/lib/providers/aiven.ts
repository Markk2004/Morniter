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

        const stateUpper = data.service.state.toUpperCase();
        let status: ServiceStatus["status"] = "unknown";
        let severity: MonitorEvent["severity"] = "info";

        if (stateUpper === "RUNNING") {
          status = "healthy";
          severity = "info";
        } else if (stateUpper === "REBUILDING" || stateUpper === "REBALANCING") {
          status = "degraded";
          severity = "warning";
        } else if (stateUpper === "POWEROFF" || stateUpper === "FAILED") {
          status = "failed";
          severity = "error";
        }

        services.push({
          source: this.source,
          service: serviceRef.label,
          status,
          checkedAt: fetchedAt,
        });

        const occurredAt = data.service.update_time || data.service.create_time || fetchedAt;

        events.push({
          id: `aiven-${data.service.service_name}-${stateUpper}`,
          source: this.source,
          service: serviceRef.label,
          type: "database",
          severity,
          status: data.service.state,
          message: redactText(
            `Aiven service ${data.service.service_name} (${data.service.service_type}) state is ${data.service.state}`,
          ),
          occurredAt,
          externalUrl: `https://console.aiven.io/project/${encodeURIComponent(
            this.env.AIVEN_PROJECT_NAME,
          )}/services/${encodeURIComponent(data.service.service_name)}`,
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
