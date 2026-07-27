import type {
  DiagnosticStage,
  MonitorEvent,
  MonitorSource,
  ServiceStatus,
} from "./types";

export type ActiveMonitorIncident = {
  key: string;
  source: Extract<MonitorSource, "aiven" | "vercel" | "render">;
  service: string;
  status: ServiceStatus["status"];
  severity: MonitorEvent["severity"];
  stage: DiagnosticStage;
  summary: string;
  externalUrl?: string;
};

const alertSources = new Set(["aiven", "vercel", "render"]);

export function deriveActiveIncidents(
  services: ServiceStatus[],
  events: MonitorEvent[],
): ActiveMonitorIncident[] {
  return services
    .filter((service) => alertSources.has(service.source) && service.status !== "healthy")
    .map((service) => {
      const event = events.find(
        (candidate) =>
          candidate.source === service.source &&
          candidate.service === service.service &&
          candidate.severity !== "info",
      );
      return {
        key: event?.incidentKey ?? `${service.source}:${service.service}:${service.status}`,
        source: service.source as ActiveMonitorIncident["source"],
        service: service.service,
        status: service.status,
        severity: event?.severity ?? "warning",
        stage: event?.stage ?? "unknown",
        summary: event?.message ?? `${service.service} status is ${service.status}`,
        externalUrl: event?.externalUrl,
      };
    });
}
