import type { ServerEnv } from "@/lib/env/server";
import type { ProviderSnapshot, ServiceStatus, MonitorEvent } from "@/lib/monitor/types";
import type { MonitorProvider } from "./types";
import { fetchJson, ProviderError } from "./request";
import { redactText } from "@/lib/monitor/redact";
import { z } from "zod";

const cronJobDetailsSchema = z.object({
  jobData: z.object({
    jobId: z.number(),
    title: z.string(),
    enabled: z.boolean(),
    lastExecution: z
      .object({
        status: z.number(),
        duration: z.number().optional(),
        date: z.string().optional(),
      })
      .optional(),
  }),
});

export class CronJobProvider implements MonitorProvider {
  readonly source = "cronjob" as const;

  constructor(private env: ServerEnv) {}

  async fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot> {
    const fetchedAt = new Date().toISOString();

    if (!this.env.CRONJOB_API_KEY || this.env.CRONJOB_JOB_IDS.length === 0) {
      return {
        source: this.source,
        fetchedAt,
        stale: false,
        services: [],
        events: [],
        error: {
          code: "configuration_error",
          message: "Cronjob API key or job IDs not configured",
        },
      };
    }

    const services: ServiceStatus[] = [];
    const events: MonitorEvent[] = [];

    try {
      for (const jobRef of this.env.CRONJOB_JOB_IDS) {
        const url = `https://api.cron-job.org/jobs/${encodeURIComponent(jobRef.id)}`;
        const headers = { Authorization: `Bearer ${this.env.CRONJOB_API_KEY}` };

        const data = await fetchJson(url, { headers }, cronJobDetailsSchema, signal);
        const job = data.jobData;

        let status: ServiceStatus["status"] = "unknown";
        let severity: MonitorEvent["severity"] = "info";

        if (!job.enabled) {
          status = "degraded";
          severity = "warning";
        } else if (job.lastExecution) {
          // Status 0: OK, status > 0: error/failed execution
          if (job.lastExecution.status === 0) {
            status = "healthy";
            severity = "info";
          } else {
            status = "failed";
            severity = "error";
          }
        } else {
          status = "healthy";
        }

        services.push({
          source: this.source,
          service: jobRef.label,
          status,
          checkedAt: fetchedAt,
        });

        const execDate = job.lastExecution?.date || fetchedAt;
        const execStatusStr = job.lastExecution
          ? job.lastExecution.status === 0
            ? "SUCCESS"
            : `FAILED (code ${job.lastExecution.status})`
          : "NO_EXECUTION";

        events.push({
          id: `cronjob-${job.jobId}-${execDate}`,
          source: this.source,
          service: jobRef.label,
          type: "cron",
          severity,
          status: execStatusStr,
          message: redactText(`Cron job "${job.title}" (${job.jobId}) execution status: ${execStatusStr}`),
          occurredAt: execDate,
          externalUrl: `https://console.cron-job.org/jobs/${job.jobId}`,
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
      const message = redactText(err instanceof Error ? err.message : "Failed to fetch Cronjob data");
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
