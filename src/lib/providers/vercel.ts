import type { ServerEnv } from "@/lib/env/server";
import type {
  ProviderSnapshot,
  ServiceStatus,
  MonitorEvent,
  MonitorDiagnosticsResult,
  MonitorDiagnostic,
  DiagnosticStage,
} from "@/lib/monitor/types";
import type { MonitorProvider } from "./types";
import { fetchJson, ProviderError } from "./request";
import { redactText } from "@/lib/monitor/redact";
import { limitDiagnostics } from "@/lib/monitor/diagnostic-lines";
import { z } from "zod";

const DEPLOYMENT_HISTORY_LIMIT = 20;

const vercelDeploymentSchema = z.object({
  uid: z.string(),
  name: z.string(),
  url: z.string().optional(),
  state: z.string(),
  target: z.string().optional(),
  created: z.number(),
  meta: z.record(z.string(), z.string().or(z.number())).optional(),
});

const vercelDeploymentsResponseSchema = z.object({
  deployments: z.array(vercelDeploymentSchema),
});

const vercelDeploymentEventSchema = z.object({
  type: z.string(),
  created: z.number(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const vercelDeploymentEventsSchema = z
  .array(vercelDeploymentEventSchema)
  .nullable()
  .transform((events) => events ?? []);

export function extractVercelGitMetadata(meta?: Record<string, string | number>): {
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  commitAuthor?: string;
  deploymentTarget?: string;
} {
  if (!meta) return {};

  const getString = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const val = meta[k];
      if (typeof val === "string" && val.trim().length > 0) {
        return val.trim();
      }
    }
    return undefined;
  };

  return {
    commitSha: getString(["githubCommitSha", "gitlabCommitSha", "bitbucketCommitSha", "commitSha", "gitCommitSha"]),
    commitMessage: getString(["githubCommitMessage", "gitlabCommitMessage", "bitbucketCommitMessage", "commitMessage", "gitCommitMessage"]),
    branch: getString(["githubCommitRef", "gitlabCommitRef", "bitbucketCommitRef", "branch", "gitBranch"]),
    commitAuthor: getString(["githubCommitAuthorName", "githubCommitAuthorLogin", "gitlabCommitAuthorName", "commitAuthorName", "commitAuthor"]),
    deploymentTarget: getString(["target", "deploymentTarget"]),
  };
}

export function normalizeVercelState(rawState: string): {
  status: ServiceStatus["status"];
  severity: MonitorEvent["severity"];
  normalizedState: string;
} {
  const normalizedState = rawState.toUpperCase();
  if (normalizedState === "READY") {
    return { status: "healthy", severity: "info", normalizedState };
  }
  if (["BUILDING", "INITIALIZING", "QUEUED"].includes(normalizedState)) {
    return { status: "degraded", severity: "warning", normalizedState };
  }
  if (["ERROR", "CANCELED"].includes(normalizedState)) {
    return { status: "failed", severity: "error", normalizedState };
  }
  return { status: "unknown", severity: "warning", normalizedState };
}

function vercelEventMessage(
  type: string,
  payload: Record<string, unknown>,
  level: MonitorDiagnostic["level"],
): string {
  for (const key of ["text", "message", "error", "output", "reason", "details"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  const info = payload.info;
  if (info && typeof info === "object") {
    for (const key of ["text", "message", "name", "step"]) {
      const value = (info as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  const scalarDetails = Object.entries(payload)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");

  if (scalarDetails) {
    return `Vercel ${type} event: ${scalarDetails}`;
  }

  if (level === "error") {
    return `Vercel build error (${type}) did not include a message.`;
  }

  return `Vercel ${type} build event did not include a message.`;
}

function vercelEventStage(type: string): DiagnosticStage {
  if (type === "deployment-state") return "deploy";
  if (type.includes("invocation") || type === "middleware") return "runtime";
  return "build";
}

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
        let url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectRef.id)}&limit=${DEPLOYMENT_HISTORY_LIMIT}`;
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
          latestStatus = normalizeVercelState(data.deployments[0].state).status;
        }

        services.push({
          source: this.source,
          service: projectRef.label,
          status: latestStatus,
          checkedAt: fetchedAt,
        });

        for (const dep of data.deployments) {
          const normalized = normalizeVercelState(dep.state);
          const gitMeta = extractVercelGitMetadata(dep.meta);
          const deploymentTarget = dep.target ?? gitMeta.deploymentTarget;
          const message = redactText(`Deployment ${dep.name} (${dep.uid}): state is ${dep.state}`);
          events.push({
            id: `vercel-${dep.uid}`,
            source: this.source,
            service: projectRef.label,
            type: "deployment",
            severity: normalized.severity,
            status: dep.state,
            message,
            occurredAt: new Date(dep.created).toISOString(),
            stage: normalized.status === "healthy" ? "deploy" : "build",
            incidentKey: `vercel:${projectRef.label}:${dep.uid}`,
            deploymentId: dep.uid,
            resourceId: projectRef.id,
            diagnosticAvailable: true,
            commitSha: gitMeta.commitSha,
            commitMessage: gitMeta.commitMessage,
            branch: gitMeta.branch,
            commitAuthor: gitMeta.commitAuthor,
            deploymentTarget,
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

  async fetchDiagnostics(
    event: MonitorEvent,
    signal?: AbortSignal,
  ): Promise<MonitorDiagnosticsResult> {
    if (
      event.source !== "vercel" ||
      !event.deploymentId ||
      !event.resourceId ||
      !this.env.VERCEL_PROJECT_IDS.some((ref) => ref.id === event.resourceId)
    ) {
      throw new ProviderError("upstream_error", "Invalid Vercel diagnostic event");
    }

    const params = new URLSearchParams({
      direction: "forward",
      limit: "-1",
      builds: "1",
    });
    if (this.env.VERCEL_TEAM_ID) params.set("teamId", this.env.VERCEL_TEAM_ID);

    const data = await fetchJson(
      `https://api.vercel.com/v3/deployments/${encodeURIComponent(event.deploymentId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${this.env.VERCEL_API_TOKEN}` } },
      vercelDeploymentEventsSchema,
      signal,
    );

    const rawLines: MonitorDiagnostic[] = data.length > 0
      ? data.map((item, index) => {
          const level: MonitorDiagnostic["level"] =
            item.type === "fatal" || item.type === "stderr" || item.type === "exit"
              ? "error"
              : item.payload.level === "warning"
                ? "warning"
                : "info";

          return {
            id: `vercel-log-${item.created}-${index}`,
            stage: vercelEventStage(item.type),
            level,
            message: vercelEventMessage(item.type, item.payload, level),
            occurredAt: new Date(item.created).toISOString(),
          };
        })
      : [{
          id: `${event.id}-no-build-logs`,
          stage: "build",
          level: "warning",
          message: "Vercel returned no build log entries for this deployment.",
          occurredAt: event.occurredAt,
        }];
    const limited = limitDiagnostics(rawLines);
    const firstError = limited.lines.find((line) => line.level === "error");

    return {
      eventId: event.id,
      summary: firstError?.message
        ?? (data.length === 0 ? rawLines[0].message : `Vercel deployment status is ${event.status}`),
      lines: limited.lines,
      truncated: limited.truncated,
    };
  }
}
