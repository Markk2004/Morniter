"use client";

import React from "react";
import type { AgentPresence } from "@/lib/test-runner/types";

interface AgentStatusBannerProps {
  presence: AgentPresence | null;
}

export function AgentStatusBanner({ presence }: AgentStatusBannerProps) {
  const state = presence?.state || "offline";

  let badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  let dotColor = "bg-rose-500";
  let label = "Local Agent Offline";

  if (state === "online") {
    badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    dotColor = "bg-emerald-500 animate-pulse";
    label = "Local Agent Online";
  } else if (state === "lagging") {
    badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/30";
    dotColor = "bg-amber-500";
    label = "Local Agent Lagging";
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
      <div className="flex items-center space-x-3">
        <div className={`px-3 py-1.5 rounded-full border text-xs font-mono font-medium flex items-center space-x-2 ${badgeColor}`}>
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span>{label}</span>
        </div>
        <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
          {presence?.agentId ? `ID: ${presence.agentId}` : "Waiting for heartbeat..."}
        </span>
      </div>

      <div className="text-xs text-slate-400 font-mono">
        {presence?.lastHeartbeatAt && presence.lastHeartbeatAt !== "1970-01-01T00:00:00.000Z" ? (
          <span>Last heartbeat: {new Date(presence.lastHeartbeatAt).toLocaleTimeString()}</span>
        ) : (
          <span>No heartbeat detected</span>
        )}
      </div>
    </div>
  );
}
