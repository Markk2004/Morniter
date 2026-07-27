"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ServiceStatus } from "@/lib/monitor/types";
import { getAivenIncidentTransitions, type AivenIncidentTransition } from "@/lib/monitor/aiven-incidents";

const STORAGE_KEY = "project-monitor:aiven-incidents";

interface AivenIncidentAlertsProps {
  services: ServiceStatus[];
}

function getStoredIncidentKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredIncidentKeys(keys: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(keys)));
  } catch {
    // Ignore storage errors
  }
}

export default function AivenIncidentAlerts({ services }: AivenIncidentAlertsProps) {
  const previousServicesRef = useRef<ServiceStatus[]>(services);
  const [notificationPermission, setNotificationPermission] = useState<string>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });
  const [activeTransitions, setActiveTransitions] = useState<AivenIncidentTransition[]>([]);

  useEffect(() => {
    const previous = previousServicesRef.current;
    const transitions = getAivenIncidentTransitions(previous, services);
    previousServicesRef.current = services;

    if (transitions.length === 0) return;

    setActiveTransitions(transitions);

    const storedKeys = getStoredIncidentKeys();

    for (const t of transitions) {
      if (t.kind === "opened") {
        if (!storedKeys.has(t.key)) {
          storedKeys.add(t.key);
          saveStoredIncidentKeys(storedKeys);

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            const dbInfo = t.databaseName ? ` (Target: ${t.databaseName})` : "";
            new Notification(`Aiven Incident Alert: ${t.service}`, {
              body: `Aiven service "${t.service}" state changed to ${t.status.toUpperCase()}${dbInfo}.`,
              icon: "/icons/icon-192.png",
            });
          }
        }
      } else if (t.kind === "recovered") {
        storedKeys.delete(t.key);
        saveStoredIncidentKeys(storedKeys);
      }
    }
  }, [services]);

  const handleEnableNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }
  };

  // Find all currently unhealthy Aiven services to display in-app alert banner
  const unhealthyAivenServices = services.filter(
    (s) => s.source === "aiven" && s.status !== "healthy",
  );

  const activeRecoveries = activeTransitions.filter((t) => t.kind === "recovered");

  if (unhealthyAivenServices.length === 0 && activeRecoveries.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs font-mono">
        <span className="text-slate-400">
          Aiven Status Monitor: <span className="text-emerald-400 font-semibold">ALL RUNNING</span>
        </span>
        {notificationPermission === "default" && (
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="px-2.5 py-1 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-200 hover:bg-cyan-900 transition text-[11px]"
          >
            Enable browser alerts
          </button>
        )}
        {(notificationPermission === "denied" || notificationPermission === "unsupported") && (
          <span className="text-[10px] text-slate-500 italic">
            Browser notifications are unavailable or blocked
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 font-mono text-xs">
      {activeRecoveries.map((rec) => (
        <div
          key={rec.key}
          className="flex items-center justify-between p-3 rounded-lg border border-emerald-800/80 bg-emerald-950/50 text-emerald-200 shadow-lg"
        >
          <div className="flex items-center space-x-2">
            <span className="font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-900 text-[10px]">
              Aiven RECOVERED
            </span>
            <span>
              Service <strong>{rec.service}</strong> is now HEALTHY
              {rec.databaseName && ` (Target: ${rec.databaseName})`}.
            </span>
          </div>
        </div>
      ))}

      {unhealthyAivenServices.map((svc) => (
        <div
          key={svc.service}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-rose-800 bg-rose-950/70 text-rose-200 shadow-xl"
        >
          <div className="flex items-start sm:items-center space-x-2">
            <span className="font-bold uppercase px-2 py-0.5 rounded bg-rose-900 text-rose-100 text-[10px] animate-pulse">
              Aiven INCIDENT
            </span>
            <div>
              <span>
                Service <strong>{svc.service}</strong> status is{" "}
                <strong className="uppercase underline">{svc.status}</strong>
                {svc.databaseName && (
                  <span className="text-rose-300 ml-1">
                    (Database target: <strong>{svc.databaseName}</strong>)
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {notificationPermission === "default" && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="px-2.5 py-1 rounded bg-rose-900 border border-rose-700 text-rose-100 hover:bg-rose-800 transition text-[11px] font-semibold"
              >
                Enable browser alerts
              </button>
            )}
            {(notificationPermission === "denied" || notificationPermission === "unsupported") && (
              <span className="text-[10px] text-rose-400/80 italic">
                Browser notifications are unavailable or blocked
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
