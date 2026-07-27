import type {
  MonitorDiagnosticsResult,
  MonitorEvent,
  MonitorSource,
  ProviderSnapshot,
} from "@/lib/monitor/types";
import type { ServerEnv } from "@/lib/env/server";
import { VercelProvider } from "./vercel";
import { RenderProvider } from "./render";
import { AivenProvider } from "./aiven";
import { CronJobProvider } from "./cronjob";
import { HealthProvider } from "./health";

export interface MonitorProvider {
  readonly source: MonitorSource;
  fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot>;
  fetchDiagnostics?(
    event: MonitorEvent,
    signal?: AbortSignal,
  ): Promise<MonitorDiagnosticsResult>;
}

export function createProviders(env: ServerEnv): MonitorProvider[] {
  return [
    new VercelProvider(env),
    new RenderProvider(env),
    new AivenProvider(env),
    ...(env.CRONJOB_API_KEY && env.CRONJOB_JOB_IDS.length > 0
      ? [new CronJobProvider(env)]
      : []),
    new HealthProvider(env),
  ];
}
