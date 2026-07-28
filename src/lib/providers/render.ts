import type { ServerEnv } from "@/lib/env/server";
import type {
  ProviderSnapshot,
  ServiceStatus,
  MonitorEvent,
  MonitorDiagnosticsResult,
  MonitorDiagnostic,
} from "@/lib/monitor/types";
import type { MonitorProvider } from "./types";
import { fetchJson, ProviderError } from "./request";
import { redactText } from "@/lib/monitor/redact";
import { limitDiagnostics } from "@/lib/monitor/diagnostic-lines";
import { z } from "zod";

const RENDER_REQUEST_TIMEOUT_MS = 15_000;
const DEPLOYMENT_HISTORY_LIMIT = 20;

const renderServiceSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    ownerId: z.string().optional(),
    dashboardUrl: z.string().optional(),
    service: z
      .object({
        id: z.string(),
        name: z.string(),
        ownerId: z.string().optional(),
        dashboardUrl: z.string().optional(),
      })
      .optional(),
  })
  .transform((data) =>
    data.service ?? {
      id: data.id ?? "",
      name: data.name ?? "",
      ownerId: data.ownerId ?? "",
      dashboardUrl: data.dashboardUrl,
    },
  );

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

const renderLogLabelSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const renderLogsSchema = z.object({
  hasMore: z.boolean(),
  nextStartTime: z.string(),
  nextEndTime: z.string(),
  logs: z.array(
    z.object({
      id: z.string(),
      message: z.string(),
      timestamp: z.string(),
      labels: z.array(renderLogLabelSchema),
    }),
  ),
});

export function normalizeRenderState(rawState: string): {
  status: ServiceStatus["status"];
  severity: MonitorEvent["severity"];
  normalizedState: string;
} {
  const normalizedState = rawState.toLowerCase();
  if (["live", "build_succeeded"].includes(normalizedState)) {
    return { status: "healthy", severity: "info", normalizedState };
  }
  if (
    ["created", "queued", "building", "pre_deploy", "deploying", "update_in_progress"]
      .includes(normalizedState)
  ) {
    return { status: "degraded", severity: "warning", normalizedState };
  }
  if (
    ["build_failed", "deploy_failed", "canceled", "cancelled", "suspended", "deactivated"]
      .includes(normalizedState)
  ) {
    return { status: "failed", severity: "error", normalizedState };
  }
  return { status: "unknown", severity: "warning", normalizedState };
}

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
            `https://api.render.com/v1/services/${encodeURIComponent(serviceRef.id)}/deploys?limit=${DEPLOYMENT_HISTORY_LIMIT}`,
            { headers },
            renderDeploysResponseSchema,
            signal,
            RENDER_REQUEST_TIMEOUT_MS,
          ),
        ]);

        let latestStatus: ServiceStatus["status"] = "unknown";

        if (deploysData.length > 0) {
          latestStatus = normalizeRenderState(deploysData[0].deploy.status).status;
        }

        services.push({
          source: this.source,
          service: serviceRef.label,
          status: latestStatus,
          checkedAt: fetchedAt,
        });

        for (const item of deploysData) {
          const dep = item.deploy;
          const normalized = normalizeRenderState(dep.status);

          const rawMsg = dep.commit?.message
            ? `Deploy ${dep.id}: ${dep.commit.message} (status: ${dep.status})`
            : `Deploy ${dep.id}: status is ${dep.status}`;

          events.push({
            id: `render-${dep.id}`,
            source: this.source,
            service: serviceRef.label,
            type: "deployment",
            severity: normalized.severity,
            status: dep.status,
            message: redactText(rawMsg),
            occurredAt: dep.createdAt,
            stage: normalized.status === "healthy" ? "deploy" : "build",
            incidentKey: `render:${serviceRef.label}:${dep.id}`,
            deploymentId: dep.id,
            resourceId: serviceRef.id,
            ownerId: serviceData.ownerId,
            diagnosticAvailable: Boolean(serviceData.ownerId),
            diagnosticEndTime: dep.finishedAt ?? fetchedAt,
            commitSha: dep.commit?.id,
            commitMessage: dep.commit?.message,
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

  async fetchDiagnostics(
    event: MonitorEvent,
    signal?: AbortSignal,
  ): Promise<MonitorDiagnosticsResult> {
    if (
      event.source !== "render" ||
      !event.resourceId ||
      !event.ownerId ||
      !this.env.RENDER_SERVICE_IDS.some((ref) => ref.id === event.resourceId)
    ) {
      throw new ProviderError("upstream_error", "Invalid Render diagnostic event");
    }

    const params = new URLSearchParams({
      ownerId: event.ownerId,
      resource: event.resourceId,
      type: "build",
      startTime: event.occurredAt,
      endTime: event.diagnosticEndTime ?? new Date().toISOString(),
      direction: "backward",
      limit: "20",
    });
    const data = await fetchJson(
      `https://api.render.com/v1/logs?${params}`,
      { headers: { Authorization: `Bearer ${this.env.RENDER_API_KEY}` } },
      renderLogsSchema,
      signal,
      RENDER_REQUEST_TIMEOUT_MS,
    );

    const rawLines: MonitorDiagnostic[] = data.logs.map((log) => {
      const labels = new Map(log.labels.map((label) => [label.name, label.value]));
      const level = labels.get("level");
      return {
        id: log.id,
        stage: labels.get("type") === "build" ? "build" : "runtime",
        level:
          level === "error" || level === "critical" || level === "alert" || level === "emergency"
            ? "error"
            : level === "warning"
              ? "warning"
              : "info",
        message: log.message,
        occurredAt: log.timestamp,
      };
    });
    const limited = limitDiagnostics(rawLines);
    const firstError = limited.lines.find((line) => line.level === "error");

    return {
      eventId: event.id,
      summary: firstError?.message ?? `Render deploy status is ${event.status}`,
      lines: limited.lines,
      truncated: limited.truncated,
    };
  }
}
