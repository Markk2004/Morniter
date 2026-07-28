"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { MonitorSnapshot, MonitorSource, Severity, DiagnosticStage, MonitorEvent } from "@/lib/monitor/types";
import AutoRefreshControl from "./AutoRefreshControl";
import ServiceCards from "./ServiceCards";
import ProviderErrors from "./ProviderErrors";
import ProviderIncidentAlerts from "./ProviderIncidentAlerts";
import SourceFilters from "./SourceFilters";
import TerminalPanel from "./TerminalPanel";

interface MonitorLogsPageProps {
  initialSnapshot?: MonitorSnapshot | null;
}

export function MonitorLogsPage({ initialSnapshot = null }: MonitorLogsPageProps) {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(initialSnapshot);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSource, setSelectedSource] = useState<MonitorSource | "all">("all");
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<string | "all">("all");
  const [selectedStage, setSelectedStage] = useState<DiagnosticStage | "all">("all");

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const activeSnapshot = snapshot;
  const allServices = activeSnapshot?.providers.flatMap((p) => p.services) || [];
  const rawEvents = activeSnapshot?.events || [];

  const fetchLatestSnapshot = useCallback(async (force = false) => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      const url = force ? "/api/monitor/snapshot?force=1" : "/api/monitor/snapshot";
      const res = await fetch(url);
      if (res.ok || res.status === 503) {
        const data: MonitorSnapshot = await res.json();
        if (isMountedRef.current) {
          setSnapshot(data);
        }
      } else if (res.status === 401) {
        window.location.href = "/login";
      }
    } catch {
      // Keep existing snapshot on transient network error
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

    const intervalSeconds = activeSnapshot?.refreshAfterSeconds ?? 60;
    timeoutRef.current = setTimeout(async () => {
      if (document.visibilityState === "visible" && !isPaused && isMountedRef.current) {
        await fetchLatestSnapshot(false);
      }
      if (isMountedRef.current) {
        scheduleNextFetchRef.current();
      }
    }, intervalSeconds * 1000);
  }, [isPaused, fetchLatestSnapshot, activeSnapshot?.refreshAfterSeconds]);

  useEffect(() => {
    scheduleNextFetchRef.current = scheduleNextFetch;
  }, [scheduleNextFetch]);

  useEffect(() => {
    isMountedRef.current = true;
    scheduleNextFetch();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isPaused) {
        fetchLatestSnapshot(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [scheduleNextFetch, isPaused, fetchLatestSnapshot]);

  const availableStatuses = Array.from(new Set(rawEvents.map((evt) => evt.status))).sort();
  const availableStages = Array.from(
    new Set(rawEvents.map((evt) => evt.stage).filter(Boolean)),
  ) as DiagnosticStage[];

  const filteredEvents = rawEvents.filter((evt) => {
    if (selectedSource !== "all" && evt.source !== selectedSource) return false;
    if (selectedSeverity !== "all" && evt.severity !== selectedSeverity) return false;
    if (selectedStatus !== "all" && evt.status !== selectedStatus) return false;
    if (selectedStage !== "all" && evt.stage !== selectedStage) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Sub-header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            System & Deployment Logs
            {activeSnapshot?.partial && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-normal">
                PARTIAL
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Read-Only Provider Telemetry</p>
        </div>

        <div className="flex items-center space-x-3">
          <AutoRefreshControl
            isPaused={isPaused}
            isRefreshing={isRefreshing}
            lastUpdated={activeSnapshot?.generatedAt || null}
            refreshAfterSeconds={activeSnapshot?.refreshAfterSeconds ?? 60}
            onTogglePause={() => setIsPaused((prev) => !prev)}
            onManualRefresh={() => fetchLatestSnapshot(true)}
          />
        </div>
      </div>

      {/* Provider Errors Notice */}
      {activeSnapshot?.providers && <ProviderErrors providers={activeSnapshot.providers} />}

      {/* Provider Incident Alerts */}
      <ProviderIncidentAlerts services={allServices} events={rawEvents} />

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
        selectedStatus={selectedStatus}
        selectedStage={selectedStage}
        availableStatuses={availableStatuses}
        availableStages={availableStages}
        onSelectSource={setSelectedSource}
        onSelectSeverity={setSelectedSeverity}
        onSelectStatus={setSelectedStatus}
        onSelectStage={setSelectedStage}
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
    </div>
  );
}
