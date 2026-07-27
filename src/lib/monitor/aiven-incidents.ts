import type { ServiceStatus } from "./types";

export type AivenIncidentTransition = {
  kind: "opened" | "recovered";
  key: string;
  service: string;
  status: ServiceStatus["status"];
  databaseName?: string;
};

const isAivenUnhealthy = (service: ServiceStatus) =>
  service.source === "aiven" && service.status !== "healthy";

export function getAivenIncidentTransitions(
  previousServices: ServiceStatus[],
  currentServices: ServiceStatus[],
): AivenIncidentTransition[] {
  const previous = new Map(
    previousServices
      .filter((service) => service.source === "aiven")
      .map((service) => [service.service, service]),
  );

  return currentServices
    .filter((service) => service.source === "aiven")
    .flatMap((current): AivenIncidentTransition[] => {
      const previousService = previous.get(current.service);
      const key = `aiven:${current.service}`;

      if (isAivenUnhealthy(current) && (!previousService || previousService.status === "healthy")) {
        return [{ kind: "opened", key, service: current.service, status: current.status, databaseName: current.databaseName }];
      }

      if (current.status === "healthy" && previousService && isAivenUnhealthy(previousService)) {
        return [{ kind: "recovered", key, service: current.service, status: current.status, databaseName: current.databaseName }];
      }

      return [];
    });
}
