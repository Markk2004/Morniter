import type { MonitorSnapshot } from "./types";

export function getRefreshAfterSeconds(
  snapshot: Pick<MonitorSnapshot, "partial" | "providers">,
): number {
  if (snapshot.partial) {
    return 20;
  }

  for (const provider of snapshot.providers) {
    if (provider.error) {
      return 20;
    }
    for (const service of provider.services) {
      if (service.status !== "healthy") {
        return 20;
      }
    }
  }

  return 60;
}
