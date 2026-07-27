import type { ServerEnv } from "@/lib/env/server";
import type { ProviderSnapshot, ServiceStatus, MonitorEvent } from "@/lib/monitor/types";
import type { MonitorProvider } from "./types";
import { fetchJson, ProviderError } from "./request";
import { redactText } from "@/lib/monitor/redact";
import { z } from "zod";

const RENDER_REQUEST_TIMEOUT_MS = 15_000;

const renderServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  dashboardUrl: z.string().optional(),
});

const renderDeploySchema = z.object({
  deploy: z.object({
    id: z.string(),
    status: z.string(),
    createdAt: z.string(),
    finishedAt: z.string().nullable().optional(),
    commit: z.object({ id: z.string(), message: z.string().optional() }).optional(),
  }),
});

const renderDeploysResponseSchema = z.array(renderDeploySchema);

export class RenderProvider implements MonitorProvider {
  readonly source = "render" as const;

  constructor(private env: ServerEnv) {}

  async fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot> {
    const fetchedAt = new Date().toISOString();

    if (!this.env.RENDER_API_KEY || this.env.RENDER_SERVICE_IDS.length === 0) {
      return {
        source: this.source,
        fetchedAt,
        stale: false,
        services: [],
        events: [],
        error: {
          code: "configuration_error",
          message: "Render API key or service IDs not configured",
        },
      };
    }

    const services: ServiceStatus[] = [];
    const events: MonitorEvent[] = [];

    try {
      for (const serviceRef of this.env.RENDER_SERVICE_IDS) {
        const headers = { Authorization: `Bearer ${this.env.RENDER_API_KEY}` };

        // Fetch service details and deploys concurrently
        const [serviceData, deploysData] = await Promise.all([
          fetchJson(
            `https://api.render.com/v1/services/${encodeURIComponent(serviceRef.id)}`,
            { headers },
            renderServiceSchema,
            signal,
            RENDER_REQUEST_TIMEOUT_MS,
          ),
          fetchJson(
            `https://api.render.com/v1/services/${encodeURIComponent(serviceRef.id)}/deploys?limit=10`,
            { headers },
            renderDeploysResponseSchema,
            signal,
            RENDER_REQUEST_TIMEOUT_MS,
          ),
        ]);

        let latestStatus: ServiceStatus["status"] = "unknown";

        if (deploysData.length > 0) {
          const statusLower = deploysData[0].deploy.status.toLowerCase();
          if (statusLower === "live" || statusLower === "build_succeeded") latestStatus = "healthy";
          else if (statusLower.includes("build") || statusLower.includes("deploy")) latestStatus = "degraded";
          else if (statusLower.includes("fail") || statusLower === "suspended" || statusLower === "canceled") latestStatus = "failed";
        }

        services.push({
          source: this.source,
          service: serviceRef.label,
          status: latestStatus,
          checkedAt: fetchedAt,
        });

        for (const item of deploysData) {
          const dep = item.deploy;
          const statusLower = dep.status.toLowerCase();
          const severity =
            statusLower.includes("fail") || statusLower === "canceled"
              ? "error"
              : statusLower.includes("build") || statusLower.includes("deploy")
                ? "warning"
                : "info";

          const rawMsg = dep.commit?.message
            ? `Deploy ${dep.id}: ${dep.commit.message} (status: ${dep.status})`
            : `Deploy ${dep.id}: status is ${dep.status}`;

          events.push({
            id: `render-${dep.id}`,
            source: this.source,
            service: serviceRef.label,
            type: "deployment",
            severity,
            status: dep.status,
            message: redactText(rawMsg),
            occurredAt: dep.createdAt,
            externalUrl: serviceData.dashboardUrl,
          });
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
      const message = redactText(err instanceof Error ? err.message : "Failed to fetch Render data");
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
