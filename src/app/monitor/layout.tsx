import React from "react";
import { requireMonitorSession } from "@/lib/auth/session";
import { MonitorShell } from "@/components/monitor/MonitorShell";

export default async function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMonitorSession();

  const displayName = process.env.MONITOR_DISPLAY_NAME || "Morniter Operator";

  return <MonitorShell displayName={displayName}>{children}</MonitorShell>;
}
