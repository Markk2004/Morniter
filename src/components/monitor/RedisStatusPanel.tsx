import type { RedisStatusResponse } from "@/lib/test-runner/redis-status";

interface RedisStatusPanelProps {
  data: RedisStatusResponse | null;
  isLoading: boolean;
}

const statusStyles = {
  HEALTHY: "border-emerald-800 bg-emerald-950/60 text-emerald-300",
  DEGRADED: "border-amber-800 bg-amber-950/60 text-amber-300",
  UNAVAILABLE: "border-rose-800 bg-rose-950/60 text-rose-300",
} as const;

function formatBytes(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCheckedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleTimeString();
}

export function RedisStatusPanel({ data, isLoading }: RedisStatusPanelProps) {
  const status = data?.status ?? "UNAVAILABLE";
  const commandBreakdown = data
    ? Object.entries(data.appCommands.byCommand).sort(([, left], [, right]) => right - left)
    : [];

  return (
    <section aria-labelledby="redis-status-heading" className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="redis-status-heading" className="text-sm font-semibold text-white">
            Redis status
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Database health and commands from this server instance.
          </p>
        </div>
        <span className={`w-fit rounded-md border px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] ${statusStyles[status]}`}>
          {status}
        </span>
      </div>

      <div aria-live="polite" className="mt-4">
        {isLoading && !data ? (
          <p className="text-xs text-slate-500">Checking Redis status...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Redis commands" value={data?.metrics.totalCommandsProcessed?.toLocaleString() ?? "Unavailable"} />
              <Metric label="App commands" value={data?.appCommands.total.toLocaleString() ?? "Unavailable"} />
              <Metric label="Latency" value={data?.latencyMs === null || data?.latencyMs === undefined ? "Unavailable" : `${data.latencyMs} ms`} />
              <Metric label="Memory" value={formatBytes(data?.metrics.usedMemoryBytes ?? null)} />
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-3 text-xs text-slate-400 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-600">Command breakdown</span>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {commandBreakdown.length > 0 ? (
                    commandBreakdown.map(([command, count]) => (
                      <span key={command} className="font-mono text-slate-300">
                        {command} <span className="text-cyan-400">{count.toLocaleString()}</span>
                      </span>
                    ))
                  ) : (
                    <span>No commands recorded on this instance.</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 sm:text-right">
                <p>Keys: {data?.metrics.totalKeys?.toLocaleString() ?? "Unavailable"}</p>
                <p className="mt-1">Checked: {data ? formatCheckedAt(data.checkedAt) : "Unavailable"}</p>
              </div>
            </div>

            {data?.error && <p className="mt-3 text-xs text-amber-300">{data.error}</p>}
          </>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}
