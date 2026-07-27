import type { ServiceStatus } from "./types";
export * from "./incidents";

export type AivenTransitionResult = {
  kind: "opened" | "recovered";
  key: string;
  service: string;
  status: ServiceStatus["status"];
  databaseName?: string;
};

export function getAivenIncidentTransitions(
  previousServices: ServiceStatus[],
  currentServices: ServiceStatus[],
): AivenTransitionResult[] {
  const previous = new Map(
    previousServices
      .filter((s) => s.source === "aiven")
      .map((s) => [s.service, s]),
  );

  return currentServices
    .filter((s) => s.source === "aiven")
    .flatMap((current): AivenTransitionResult[] => {
      const prev = previous.get(current.service);
      const key = `aiven:${current.service}`;

      if (current.status !== "healthy" && (!prev || prev.status === "healthy")) {
        return [{ kind: "opened", key, service: current.service, status: current.status, databaseName: current.databaseName }];
      }
      if (current.status === "healthy" && prev && prev.status !== "healthy") {
        return [{ kind: "recovered", key, service: current.service, status: current.status, databaseName: current.databaseName }];
      }
      return [];
    });
}
