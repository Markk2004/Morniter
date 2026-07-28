import React from "react";
import { getMonitorSnapshot } from "@/lib/monitor/aggregate";
import { MonitorLogsPage } from "@/components/monitor/MonitorLogsPage";

export default async function MonitorPage() {
  let initialSnapshot = null;
  try {
    initialSnapshot = await getMonitorSnapshot();
  } catch {
    // Aggregator fallback
  }

  return <MonitorLogsPage initialSnapshot={initialSnapshot} />;
}
