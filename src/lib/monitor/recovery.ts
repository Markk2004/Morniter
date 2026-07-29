import type { MonitorSnapshot } from "./types";

function serviceKey(source: string, service: string): string {
  return `${source}:${service}`;
}

/** Returns true when a previously degraded service or event has recovered. */
export function hasRecoveredToHealthy(
  previous: MonitorSnapshot | null,
  next: MonitorSnapshot,
): boolean {
  if (!previous) return false;

  const previousServices = new Map(
    previous.providers
      .flatMap((provider) => provider.services)
      .map((service) => [serviceKey(service.source, service.service), service.status]),
  );

  const serviceRecovered = next.providers
    .flatMap((provider) => provider.services)
    .some((service) => {
      const previousStatus = previousServices.get(serviceKey(service.source, service.service));
      return Boolean(previousStatus && previousStatus !== "healthy" && service.status === "healthy");
    });

  if (serviceRecovered) return true;

  const previousEvents = new Map(previous.events.map((event) => [event.id, event.severity]));
  return next.events.some(
    (event) => previousEvents.get(event.id) === "warning" && event.severity === "info",
  );
}
