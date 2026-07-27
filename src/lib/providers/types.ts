import type { MonitorSource, ProviderSnapshot } from "@/lib/monitor/types";
import type { ServerEnv } from "@/lib/env/server";
import { VercelProvider } from "./vercel";
import { RenderProvider } from "./render";
import { AivenProvider } from "./aiven";
import { CronJobProvider } from "./cronjob";
import { HealthProvider } from "./health";

export interface MonitorProvider {
  readonly source: MonitorSource;
  fetchSnapshot(signal?: AbortSignal): Promise<ProviderSnapshot>;
}

export function createProviders(env: ServerEnv): MonitorProvider[] {
  return [
    new VercelProvider(env),
    new RenderProvider(env),
    new AivenProvider(env),
    new CronJobProvider(env),
    new HealthProvider(env),
  ];
}
