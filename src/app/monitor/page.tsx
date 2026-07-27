import { redirect } from "next/navigation";
import { requireMonitorSession } from "@/lib/auth/session";
import { getMonitorSnapshot } from "@/lib/monitor/aggregate";
import { getServerEnv } from "@/lib/env/server";
import MonitorDashboard from "@/components/monitor/MonitorDashboard";

export default async function MonitorPage() {
  try {
    await requireMonitorSession();
  } catch {
    redirect("/login");
  }

  const env = getServerEnv();
  const initialSnapshot = await getMonitorSnapshot().catch(() => null);

  return (
    <MonitorDashboard
      initialSnapshot={initialSnapshot}
      displayName={env.MONITOR_DISPLAY_NAME}
    />
  );
}
