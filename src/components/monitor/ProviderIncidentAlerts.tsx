"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { ServiceStatus, MonitorEvent } from "@/lib/monitor/types";
import { deriveActiveIncidents } from "@/lib/monitor/incidents";

const STORAGE_KEY = "project-monitor:notified-incidents:v1";

interface ProviderIncidentAlertsProps {
  services: ServiceStatus[];
  events: MonitorEvent[];
}

export default function ProviderIncidentAlerts({
  services,
  events,
}: ProviderIncidentAlertsProps) {
  const activeIncidents = deriveActiveIncidents(services, events);
  const previousHealthRef = useRef(
    new Map(
      services.map((service) => [
        `${service.source}:${service.service}`,
        service.status,
      ]),
    ),
  );

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });
  const [recoveries, setRecoveries] = useState<string[]>([]);

  const notifyMissingIncidents = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      const notified = new Set<string>(
        JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"),
      );
      for (const incident of activeIncidents) {
        if (notified.has(incident.key)) continue;
        new Notification(`${incident.source.toUpperCase()} Incident: ${incident.service}`, {
          body: `${incident.status.toUpperCase()} · ${incident.stage.toUpperCase()} · ${incident.summary}`,
          icon: "/icons/icon-192.png",
        });
        notified.add(incident.key);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...notified]));
    } catch {
      // Storage or notification error
    }
  }, [activeIncidents]);

  useEffect(() => {
    notifyMissingIncidents();

    const previous = previousHealthRef.current;
    const recovered = services.filter((service) => {
      const key = `${service.source}:${service.service}`;
      return previous.get(key) !== "healthy" && service.status === "healthy";
    });
    previousHealthRef.current = new Map(
      services.map((service) => [
        `${service.source}:${service.service}`,
        service.status,
      ]),
    );

    if (recovered.length === 0) return;

    const labels = recovered.map(
      (service) => `${service.source.toUpperCase()} ${service.service}`,
    );
    setRecoveries(labels);

    try {
      const notified = new Set<string>(
        JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"),
      );
      for (const service of recovered) {
        const prefix = `${service.source}:${service.service}:`;
        for (const key of notified) {
          if (key.startsWith(prefix) || key === `${service.source}:${service.service}:${service.status}`) {
            notified.delete(key);
          }
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...notified]));
    } catch {
      // Storage error
    }

    const timer = window.setTimeout(() => setRecoveries([]), 8_000);
    return () => window.clearTimeout(timer);
  }, [services, notifyMissingIncidents]);

  const enableNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission === "granted") notifyMissingIncidents();
    }
  };

  if (activeIncidents.length === 0 && recoveries.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs font-mono">
        <span className="text-slate-400">
          Services Status Monitor: <span className="text-emerald-400 font-semibold">ALL HEALTHY</span>
        </span>
        {permission === "default" && (
          <button
            type="button"
            onClick={enableNotifications}
            className="px-2.5 py-1 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-200 hover:bg-cyan-900 transition text-[11px]"
          >
            Enable browser alerts
          </button>
        )}
        {(permission === "denied" || permission === "unsupported") && (
          <span className="text-[10px] text-slate-500 italic">
            Browser notifications are unavailable or blocked
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 font-mono text-xs">
      {permission === "default" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={enableNotifications}
            className="px-2.5 py-1 rounded bg-rose-950 border border-rose-700 text-rose-200 hover:bg-rose-900 transition text-[11px] font-semibold"
          >
            Enable browser alerts
          </button>
        </div>
      )}

      {recoveries.map((label) => (
        <div
          key={label}
          role="status"
          className="flex items-center justify-between p-3 rounded-lg border border-emerald-800/80 bg-emerald-950/50 text-emerald-200 shadow-lg"
        >
          <div className="flex items-center space-x-2">
            <span className="font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-900 text-[10px]">
              RECOVERED
            </span>
            <span>
              Service <strong>{label}</strong> is now HEALTHY.
            </span>
          </div>
        </div>
      ))}

      {activeIncidents.map((incident) => (
        <div
          key={incident.key}
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-rose-800 bg-rose-950/70 text-rose-200 shadow-xl"
        >
          <div className="flex items-start sm:items-center space-x-2">
            <span className="font-bold uppercase px-2 py-0.5 rounded bg-rose-900 text-rose-100 text-[10px] animate-pulse">
              {incident.source.toUpperCase()} INCIDENT
            </span>
            <div className="space-y-0.5">
              <div>
                Service <strong>{incident.service}</strong> status is{" "}
                <strong className="uppercase underline">{incident.status}</strong> · Stage:{" "}
                <strong className="uppercase">{incident.stage}</strong>
              </div>
              <div className="text-xs text-rose-300/90">{incident.summary}</div>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {(permission === "denied" || permission === "unsupported") && (
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
