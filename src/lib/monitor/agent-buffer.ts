import { redactText } from "./redact";
import type { MonitorEvent, Severity } from "./types";

export interface AgentIngestEvent {
  projectId?: string;
  service?: string;
  level?: "info" | "warn" | "warning" | "error";
  message: string;
  timestamp?: string;
}

const MAX_BUFFER_SIZE = 1000;
const MAX_MESSAGE_LENGTH = 8000;

export class AgentBuffer {
  private events: MonitorEvent[] = [];
  private ttlSeconds: number;

  constructor(ttlSeconds = 60) {
    this.ttlSeconds = ttlSeconds;
  }

  append(ingestEvents: AgentIngestEvent[]): void {
    const nowMs = Date.now();
    const cutoffMs = nowMs - this.ttlSeconds * 1000;

    // Purge expired
    this.events = this.events.filter((e) => Date.parse(e.occurredAt) >= cutoffMs);

    for (const item of ingestEvents) {
      if (!item.message) continue;

      let msg = item.message;
      if (msg.length > MAX_MESSAGE_LENGTH) {
        msg = msg.slice(0, MAX_MESSAGE_LENGTH) + "\n[TRUNCATED]";
      }

      const redacted = redactText(msg);

      let severity: Severity = "info";
      const lvl = item.level?.toLowerCase();
      if (lvl === "error") severity = "error";
      else if (lvl === "warn" || lvl === "warning") severity = "warning";

      const occurredAt = item.timestamp
        ? new Date(item.timestamp).toISOString()
        : new Date(nowMs).toISOString();

      const serviceName =
        item.projectId && item.service
          ? `${item.projectId}:${item.service}`
          : item.service || item.projectId || "agent";

      const event: MonitorEvent = {
        id: `agent-${Math.random().toString(36).slice(2, 9)}`,
        source: "health", // mapped internally as agent runtime
        service: serviceName,
        type: "runtime",
        severity,
        status: "RUNNING",
        message: redacted,
        occurredAt,
      };

      this.events.unshift(event);
    }

    if (this.events.length > MAX_BUFFER_SIZE) {
      this.events = this.events.slice(0, MAX_BUFFER_SIZE);
    }
  }

  read(projectId?: string, limit = 100): MonitorEvent[] {
    const nowMs = Date.now();
    const cutoffMs = nowMs - this.ttlSeconds * 1000;

    this.events = this.events.filter((e) => Date.parse(e.occurredAt) >= cutoffMs);

    let result = this.events;
    if (projectId) {
      result = result.filter(
        (e) =>
          e.service === projectId ||
          e.service.startsWith(`${projectId}:`) ||
          e.message.includes(projectId),
      );
    }

    return result.slice(0, limit);
  }

  clear(): void {
    this.events = [];
  }
}

export const globalAgentBuffer = new AgentBuffer(60);
