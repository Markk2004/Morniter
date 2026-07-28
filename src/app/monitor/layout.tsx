import React from "react";
import { requireMonitorSession } from "@/lib/auth/session";
import { MonitorShell } from "@/components/monitor/MonitorShell";
import { TabSessionGuard } from "@/components/auth/TabSessionGuard";

export default async function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMonitorSession();

  const displayName = process.env.MONITOR_DISPLAY_NAME || "Monitor Operator";

  return (
    <MonitorShell displayName={displayName}>
      <TabSessionGuard />
      {children}
    </MonitorShell>
  );
}
