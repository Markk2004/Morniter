import type { ServerEnv } from "@/lib/env/server";
import type { ProviderSnapshot, ServiceStatus, MonitorEvent } from "@/lib/monitor/types";
import type { MonitorProvider } from "./types";
import { fetchJson, ProviderError } from "./request";
import { redactText } from "@/lib/monitor/redact";
import { z } from "zod";

const vercelDeploymentSchema = z.object({
  uid: z.string(),
  name: z.string(),
  url: z.string().optional(),
  state: z.string(),
  created: z.number(),
  meta: z.record(z.string(), z.string().or(z.number())).optional(),
});

const vercelDeploymentsResponseSchema = z.object({
  deployments: z.array(vercelDeploymentSchema),
});

export class VercelProvider implements MonitorProvider {
  readonly source = "vercel" as const;

  constructor(private env: ServerEnv) {}

  async fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot> {
    const fetchedAt = new Date().toISOString();

    if (!this.env.VERCEL_API_TOKEN || this.env.VERCEL_PROJECT_IDS.length === 0) {
      return {
        source: this.source,
        fetchedAt,
        stale: false,
        services: [],
        events: [],
        error: {
          code: "configuration_error",
          message: "Vercel API token or project IDs not configured",
        },
      };
    }

    const services: ServiceStatus[] = [];
    const events: MonitorEvent[] = [];

    try {
      for (const projectRef of this.env.VERCEL_PROJECT_IDS) {
        let url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectRef.id)}&limit=10`;
        if (this.env.VERCEL_TEAM_ID) {
          url += `&teamId=${encodeURIComponent(this.env.VERCEL_TEAM_ID)}`;
        }

        const data = await fetchJson(
          url,
          {
            headers: {
              Authorization: `Bearer ${this.env.VERCEL_API_TOKEN}`,
            },
          },
          vercelDeploymentsResponseSchema,
          signal,
        );

        let latestStatus: ServiceStatus["status"] = "unknown";

        if (data.deployments.length > 0) {
          const latestState = data.deployments[0].state.toUpperCase();
          if (latestState === "READY") latestStatus = "healthy";
          else if (latestState === "BUILDING" || latestState === "INITIALIZING" || latestState === "QUEUED") latestStatus = "degraded";
          else if (latestState === "ERROR" || latestState === "CANCELED") latestStatus = "failed";
        }

        services.push({
          source: this.source,
          service: projectRef.label,
          status: latestStatus,
          checkedAt: fetchedAt,
        });

        for (const dep of data.deployments) {
          const stateUpper = dep.state.toUpperCase();
          const severity =
            stateUpper === "ERROR" || stateUpper === "CANCELED"
              ? "error"
              : stateUpper === "BUILDING" || stateUpper === "INITIALIZING"
                ? "warning"
                : "info";

          const message = redactText(`Deployment ${dep.name} (${dep.uid}): state is ${dep.state}`);
          const externalUrl = dep.url ? `https://${dep.url}` : undefined;

          events.push({
            id: `vercel-${dep.uid}`,
            source: this.source,
            service: projectRef.label,
            type: "deployment",
            severity,
            status: dep.state,
            message,
            occurredAt: new Date(dep.created).toISOString(),
            externalUrl,
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
      const message = redactText(err instanceof Error ? err.message : "Failed to fetch Vercel data");
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
