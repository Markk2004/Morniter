export type MonitorSource =
  | "vercel"
  | "render"
  | "aiven"
  | "cronjob"
  | "health";

export type Severity = "info" | "warning" | "error";

export type DiagnosticStage =
  | "build"
  | "deploy"
  | "runtime"
  | "database"
  | "health"
  | "cron"
  | "unknown";

export type MonitorDiagnostic = {
  id: string;
  stage: DiagnosticStage;
  level: Severity;
  message: string;
  occurredAt?: string;
};

export type MonitorDiagnosticsResult = {
  eventId: string;
  summary: string;
  lines: MonitorDiagnostic[];
  truncated: boolean;
};

export type MonitorEvent = {
  id: string;
  source: MonitorSource;
  service: string;
  type: "deployment" | "runtime" | "database" | "cron" | "health";
  severity: Severity;
  status: string;
  message: string;
  occurredAt: string;
  databaseName?: string;
  stage?: DiagnosticStage;
  incidentKey?: string;
  deploymentId?: string;
  resourceId?: string;
  ownerId?: string;
  diagnosticAvailable?: boolean;
  diagnosticEndTime?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  commitAuthor?: string;
  deploymentTarget?: string;
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
  refreshAfterSeconds: number;
  partial: boolean;
  providers: ProviderSnapshot[];
  events: MonitorEvent[];
};
