import type { MonitorSource, MonitorSnapshot } from "./types";
import { getMonitorSnapshot } from "./aggregate";
import { globalAgentBuffer } from "./agent-buffer";

export type DiagnosticQuery =
  | { type: "logs"; source?: MonitorSource; service?: string; limit: number }
  | { type: "errors"; source?: MonitorSource; limit: number }
  | { type: "deploys"; source?: MonitorSource; limit: number }
  | { type: "health"; target: "all" | string }
  | { type: "cron"; target: "failures" | string }
  | { type: "agent"; projectId?: string; limit: number };

const FORBIDDEN_CHARS = /[;&|><$`\\]/;

export function parseDiagnosticCommand(input: string): DiagnosticQuery {
  const trimmed = input.trim();

  if (!trimmed || FORBIDDEN_CHARS.test(trimmed)) {
    throw new Error("Invalid command: forbidden shell characters or empty input");
  }

  const tokens = trimmed.split(/\s+/);
  const root = tokens[0].toLowerCase();

  let limit = 100;
  const lastIndex = tokens.indexOf("--last");
  if (lastIndex !== -1 && lastIndex + 1 < tokens.length) {
    const parsedLimit = parseInt(tokens[lastIndex + 1], 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 500) {
      throw new Error("Invalid --last parameter: must be between 1 and 500");
    }
    limit = parsedLimit;
  }

  const validSources: MonitorSource[] = ["vercel", "render", "aiven", "cronjob", "health"];

  if (root === "logs") {
    let source: MonitorSource | undefined;
    let service: string | undefined;

    if (tokens.length > 1 && !tokens[1].startsWith("--")) {
      const maybeSource = tokens[1].toLowerCase() as MonitorSource;
      if (validSources.includes(maybeSource)) {
        source = maybeSource;
        if (tokens.length > 2 && !tokens[2].startsWith("--")) {
          service = tokens[2];
        }
      } else {
        service = tokens[1];
      }
    }

    return { type: "logs", source, service, limit };
  }

  if (root === "errors") {
    let source: MonitorSource | undefined;
    if (tokens.length > 1 && !tokens[1].startsWith("--")) {
      const maybeSource = tokens[1].toLowerCase() as MonitorSource;
      if (validSources.includes(maybeSource)) {
        source = maybeSource;
      }
    }
    return { type: "errors", source, limit };
  }

  if (root === "deploys") {
    let source: MonitorSource | undefined;
    if (tokens.length > 1 && !tokens[1].startsWith("--")) {
      const maybeSource = tokens[1].toLowerCase() as MonitorSource;
      if (validSources.includes(maybeSource)) {
        source = maybeSource;
      }
    }
    return { type: "deploys", source, limit };
  }

  if (root === "health") {
    const target = tokens[1] || "all";
    return { type: "health", target };
  }

  if (root === "cron") {
    const target = tokens[1] || "failures";
    return { type: "cron", target };
  }

  if (root === "agent") {
    const projectId = tokens.length > 1 && !tokens[1].startsWith("--") ? tokens[1] : undefined;
    return { type: "agent", projectId, limit };
  }

  throw new Error(`Unknown command: ${root}`);
}

export async function executeDiagnosticQuery(
  query: DiagnosticQuery,
  signal?: AbortSignal,
): Promise<MonitorSnapshot> {
  if (query.type === "agent") {
    const agentEvents = globalAgentBuffer.read(query.projectId, query.limit);
    return {
      generatedAt: new Date().toISOString(),
      refreshAfterSeconds: 15,
      partial: false,
      providers: [
        {
          source: "health",
          fetchedAt: new Date().toISOString(),
          stale: false,
          services: [],
          events: agentEvents,
        },
      ],
      events: agentEvents,
    };
  }

  const baseSnapshot = await getMonitorSnapshot({ signal });
  let filteredEvents = baseSnapshot.events;

  if (query.type === "logs") {
    if (query.source) {
      filteredEvents = filteredEvents.filter((e) => e.source === query.source);
    }
    if (query.service) {
      filteredEvents = filteredEvents.filter((e) => e.service === query.service);
    }
    filteredEvents = filteredEvents.slice(0, query.limit);
  } else if (query.type === "errors") {
    filteredEvents = filteredEvents.filter((e) => e.severity === "error");
    if (query.source) {
      filteredEvents = filteredEvents.filter((e) => e.source === query.source);
    }
    filteredEvents = filteredEvents.slice(0, query.limit);
  } else if (query.type === "deploys") {
    filteredEvents = filteredEvents.filter((e) => e.type === "deployment");
    if (query.source) {
      filteredEvents = filteredEvents.filter((e) => e.source === query.source);
    }
    filteredEvents = filteredEvents.slice(0, query.limit);
  } else if (query.type === "health") {
    filteredEvents = filteredEvents.filter((e) => e.source === "health");
  } else if (query.type === "cron") {
    filteredEvents = filteredEvents.filter((e) => e.source === "cronjob");
    if (query.target === "failures") {
      filteredEvents = filteredEvents.filter((e) => e.severity === "error");
    }
  }

  return {
    ...baseSnapshot,
    events: filteredEvents,
  };
}
