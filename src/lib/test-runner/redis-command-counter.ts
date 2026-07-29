export interface RedisCommandSnapshot {
  total: number;
  byCommand: Record<string, number>;
  windowStartedAt: string;
  windowDurationSeconds: number;
}

let windowStartedAtMs = Date.now();
const commandCounts = new Map<string, number>();

export function recordRedisCommand(command: string): void {
  const normalizedCommand = command.trim().toUpperCase() || "UNKNOWN";
  commandCounts.set(normalizedCommand, (commandCounts.get(normalizedCommand) ?? 0) + 1);
}

export function getRedisCommandSnapshot(): RedisCommandSnapshot {
  const byCommand = Object.fromEntries(
    [...commandCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );

  return {
    total: Object.values(byCommand).reduce((sum, count) => sum + count, 0),
    byCommand,
    windowStartedAt: new Date(windowStartedAtMs).toISOString(),
    windowDurationSeconds: Math.max(0, Math.floor((Date.now() - windowStartedAtMs) / 1000)),
  };
}

export function resetRedisCommandCounters(): void {
  commandCounts.clear();
  windowStartedAtMs = Date.now();
}
