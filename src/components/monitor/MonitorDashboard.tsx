"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { MonitorSnapshot, MonitorSource, Severity, MonitorEvent } from "@/lib/monitor/types";
import AutoRefreshControl from "./AutoRefreshControl";
import ServiceCards from "./ServiceCards";
import ProviderErrors from "./ProviderErrors";
import AivenIncidentAlerts from "./AivenIncidentAlerts";
import SourceFilters from "./SourceFilters";
import TerminalPanel from "./TerminalPanel";
import DiagnosticTerminal from "./DiagnosticTerminal";

interface MonitorDashboardProps {
  initialSnapshot?: MonitorSnapshot | null;
  displayName?: string;
}

export default function MonitorDashboard({
  initialSnapshot = null,
  displayName = "Project Monitor",
}: MonitorDashboardProps) {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(initialSnapshot);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSource, setSelectedSource] = useState<MonitorSource | "all">("all");
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">("all");
  const [customQueryResult, setCustomQueryResult] = useState<MonitorSnapshot | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchLatestSnapshot = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      const res = await fetch("/api/monitor/snapshot");
      if (res.ok || res.status === 503) {
        const data: MonitorSnapshot = await res.json();
        if (isMountedRef.current) {
          setSnapshot(data);
          setCustomQueryResult(null);
        }
      } else if (res.status === 401) {
        window.location.href = "/login";
      }
    } catch {
      // Network error, keep existing snapshot
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing]);

  const scheduleNextFetchRef = useRef<() => void>(() => {});

  const scheduleNextFetch = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (isPaused) return;

    timeoutRef.current = setTimeout(async () => {
      if (document.visibilityState === "visible" && !isPaused && isMountedRef.current) {
        await fetchLatestSnapshot();
      }
      if (isMountedRef.current) {
        scheduleNextFetchRef.current();
      }
    }, 15_000);
  }, [isPaused, fetchLatestSnapshot]);

  useEffect(() => {
    scheduleNextFetchRef.current = scheduleNextFetch;
  }, [scheduleNextFetch]);

  useEffect(() => {
    isMountedRef.current = true;
    scheduleNextFetch();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isPaused) {
        fetchLatestSnapshot();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [scheduleNextFetch, isPaused, fetchLatestSnapshot]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  const activeSnapshot = customQueryResult || snapshot;
  const allServices = activeSnapshot?.providers.flatMap((p) => p.services) || [];
  const rawEvents = activeSnapshot?.events || [];

  // Filter events
  const filteredEvents = rawEvents.filter((evt) => {
    if (selectedSource !== "all" && evt.source !== selectedSource) return false;
    if (selectedSeverity !== "all" && evt.severity !== selectedSeverity) return false;
    return true;
  });

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0d14] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex w-full sm:w-auto items-center space-x-3">
            <Image
              src="/icons/icon-192.png"
              alt="Project Monitor logo"
              width={32}
              height={32}
              className="rounded-xl object-cover shadow-lg shadow-cyan-500/20"
            />
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                {displayName}
                {activeSnapshot?.partial && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-normal">
                    PARTIAL
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-slate-400 font-mono">Read-Only Group Monitor</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <AutoRefreshControl
              isPaused={isPaused}
              isRefreshing={isRefreshing}
              lastUpdated={activeSnapshot?.generatedAt || null}
              onTogglePause={() => setIsPaused((prev) => !prev)}
              onManualRefresh={fetchLatestSnapshot}
            />

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Provider Errors Notice (if any) */}
        {activeSnapshot?.providers && <ProviderErrors providers={activeSnapshot.providers} />}

        {/* Aiven Incident Alerts */}
        <AivenIncidentAlerts services={allServices} />

        {/* Live Service Cards */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold">
              Monitored Services ({allServices.length})
            </h2>
          </div>
          <ServiceCards services={allServices} />
        </section>

        {/* Filters */}
        <SourceFilters
          selectedSource={selectedSource}
          selectedSeverity={selectedSeverity}
          onSelectSource={setSelectedSource}
          onSelectSeverity={setSelectedSeverity}
        />

        {/* Main Terminal View */}
        <TerminalPanel
          events={filteredEvents as MonitorEvent[]}
          onClearVisible={() => {
            if (activeSnapshot) {
              setSnapshot({ ...activeSnapshot, events: [] });
            }
          }}
        />

        {/* Diagnostic Terminal Query Prompt */}
        <DiagnosticTerminal onCommandResult={(resSnap) => setCustomQueryResult(resSnap)} />
      </main>
    </div>
  );
}
