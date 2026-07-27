"use client";

import React from "react";
import type { ServiceStatus } from "@/lib/monitor/types";
import LocalTime from "@/components/LocalTime";

interface ServiceCardsProps {
  services: ServiceStatus[];
}

export default function ServiceCards({ services }: ServiceCardsProps) {
  if (services.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 text-center text-xs text-slate-500 font-mono">
        No active services configured or responding.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {services.map((svc, idx) => {
        const isHealthy = svc.status === "healthy";
        const isDegraded = svc.status === "degraded";
        const isFailed = svc.status === "failed";

        const badgeBg = isHealthy
          ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
          : isDegraded
            ? "bg-amber-950/80 text-amber-300 border-amber-800/60"
            : isFailed
              ? "bg-rose-950/80 text-rose-300 border-rose-800/60 font-bold"
              : "bg-slate-800 text-slate-400 border-slate-700";

        const dotBg = isHealthy
          ? "bg-emerald-400"
          : isDegraded
            ? "bg-amber-400"
            : isFailed
              ? "bg-rose-500 animate-ping"
              : "bg-slate-400";

        return (
          <div
            key={`${svc.source}-${svc.service}-${idx}`}
            className={`p-3 rounded-lg border bg-slate-900/80 backdrop-blur transition flex flex-col justify-between space-y-2 ${badgeBg}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider opacity-75">
                {svc.source}
              </span>
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${dotBg}`} />
                <span className="text-xs font-mono uppercase font-semibold">{svc.status}</span>
              </div>
            </div>

            <div className="font-mono text-sm font-semibold text-white truncate" title={svc.service}>
              {svc.service}
            </div>

            <div className="text-[10px] font-mono opacity-60 text-right">
              <LocalTime value={svc.checkedAt} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
