export type MonitorSource =
  | "vercel"
  | "render"
  | "aiven"
  | "cronjob"
  | "health";

export type Severity = "info" | "warning" | "error";

export type MonitorEvent = {
  id: string;
  source: MonitorSource;
  service: string;
  type: "deployment" | "runtime" | "database" | "cron" | "health";
  severity: Severity;
  status: string;
  message: string;
  occurredAt: string;
  externalUrl?: string;
  databaseName?: string;
};

export type ServiceStatus = {
  source: MonitorSource;
  service: string;
  status: "healthy" | "degraded" | "failed" | "unknown";
  checkedAt: string;
  databaseName?: string;
};

export type ProviderErrorCode =
  | "configuration_error"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "upstream_error";

export type ProviderSnapshot = {
  source: MonitorSource;
  fetchedAt: string;
  stale: boolean;
  services: ServiceStatus[];
  events: MonitorEvent[];
  error?: { code: ProviderErrorCode; message: string };
};

export type MonitorSnapshot = {
  generatedAt: string;
  refreshAfterSeconds: 15;
  partial: boolean;
  providers: ProviderSnapshot[];
  events: MonitorEvent[];
};
