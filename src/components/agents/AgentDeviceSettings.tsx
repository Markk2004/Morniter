"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExecutionUnlock } from "@/components/test-runner/ExecutionUnlock";
import type { AgentDevicePublic } from "@/lib/test-runner/device-contracts";

interface PairingResponse {
  code: string;
  expiresAt: string;
}

function errorText(data: unknown, fallback: string): string {
  if (typeof data === "object" && data && "error" in data && typeof data.error === "string") return data.error;
  return fallback;
}

function formatRemaining(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AgentDeviceSettings() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<AgentDevicePublic[]>([]);
  const [agentId, setAgentId] = useState("windows-local-agent-1");
  const [pairing, setPairing] = useState<PairingResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairingExpired, setPairingExpired] = useState(false);
  const failures = useRef(0);

  const loadDevices = useCallback(async () => {
    const res = await fetch("/api/playwright-runner/agents", { cache: "no-store" });
    if (!res.ok) throw new Error("โหลดรายการ Agent ไม่สำเร็จ");
    const data = (await res.json()) as { devices?: AgentDevicePublic[] };
    setDevices(data.devices ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/test-runner/lock", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ unlocked?: boolean }>)
      .then((data) => { if (!cancelled) setUnlocked(Boolean(data.unlocked)); })
      .catch(() => { if (!cancelled) setUnlocked(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (unlocked !== true) return;
    const refresh = () => {
      if (document.visibilityState !== "visible" || failures.current >= 3) return;
      void loadDevices().catch(() => {
        failures.current += 1;
        if (failures.current >= 3) setError("หยุดรีเฟรชชั่วคราวหลังเชื่อมต่อไม่สำเร็จ 3 ครั้ง กด Retry เพื่อลองใหม่");
      });
    };
    const initialRefresh = window.setTimeout(() => {
      void loadDevices().catch(() => {
        failures.current += 1;
        setError("โหลดรายการ Agent ไม่สำเร็จ");
      });
    }, 0);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, [loadDevices, unlocked]);

  useEffect(() => {
    if (!pairing) return;
    const timer = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (new Date(pairing.expiresAt).getTime() <= nextNow) {
        setPairing(null);
        setPairingExpired(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  const remaining = useMemo(() => pairing ? formatRemaining(pairing.expiresAt, now) : null, [now, pairing]);
  const expired = pairing ? new Date(pairing.expiresAt).getTime() <= now : false;

  async function createCode() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/playwright-runner/agents/pairing-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorText(data, "สร้าง Pairing Code ไม่สำเร็จ"));
      setPairing(data as PairingResponse);
      setPairingExpired(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้าง Pairing Code ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(deviceId: string, label: string) {
    if (!window.confirm(`ยกเลิกการเชื่อมต่อ ${label} ใช่หรือไม่`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/playwright-runner/agents/${deviceId}/revoke`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 204) throw new Error(errorText(data, "ยกเลิก Agent ไม่สำเร็จ"));
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิก Agent ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  if (unlocked === null) return <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">กำลังตรวจ Execution Lock...</div>;
  if (!unlocked) return <ExecutionUnlock onUnlocked={() => setUnlocked(true)} />;

  async function retryDevices() {
    failures.current = 0;
    setError(null);
    try {
      await loadDevices();
    } catch {
      failures.current = 1;
      setError("โหลดรายการ Agent ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.16em] text-cyan-400">Agent pairing</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">เชื่อมเครื่องทดสอบ</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">สร้างรหัสชั่วคราวให้ Windows Local Agent เครื่องหนึ่ง เครื่องจะได้รับ credential ของตัวเองและไม่ต้องคัดลอก token หลักจาก Vercel</p>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">Code หมดอายุใน 10 นาที</span>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label htmlFor="agent-id" className="flex-1 text-xs font-medium text-slate-300">Agent ID<input id="agent-id" value={agentId} onChange={(event) => setAgentId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="เช่น mark-windows-01" /></label>
          <button type="button" onClick={() => void createCode()} disabled={loading || !agentId.trim()} className="rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">สร้าง Pairing Code</button>
        </div>
        {pairing && !expired && <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-emerald-300">กรอกรหัสนี้ในหน้าติดตั้ง Agent</p><p aria-live="polite" className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-emerald-100">{pairing.code}</p></div><div className="flex items-center gap-2"><p className="text-xs text-emerald-200">เหลือ {remaining}</p><button type="button" onClick={() => void navigator.clipboard?.writeText(pairing.code)} className="rounded-md border border-emerald-400/30 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-400/10">คัดลอก</button></div></div><p className="mt-3 text-xs text-emerald-200/80">Morniter → Settings → Agents → Pair new agent</p></div>}
        {pairingExpired && <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">Pairing Code หมดอายุแล้ว สร้างรหัสใหม่เพื่อเชื่อมเครื่อง</p>}
        {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-100">เครื่องที่เชื่อมอยู่</h2><p className="mt-1 text-xs text-slate-500">ระบบรีเฟรชสถานะทุก 30 วินาทีเมื่อเปิดหน้านี้</p></div><span className="font-mono text-xs text-slate-500">{devices.length} devices</span></div>
        <div className="mt-4 divide-y divide-slate-800">{devices.length === 0 ? <p className="py-5 text-sm text-slate-500">ยังไม่มีเครื่องที่จับคู่</p> : devices.map((device) => <div key={device.deviceId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium text-slate-200">{device.agentId}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{device.deviceId.slice(0, 8)} · {device.status === "online" ? "Online" : device.status === "offline" ? "Offline" : "Revoked"}</p></div>{device.status !== "revoked" && <button type="button" onClick={() => void revoke(device.deviceId, device.agentId)} disabled={loading} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">Revoke</button>}</div>)}</div>
        {error && <button type="button" onClick={() => void retryDevices()} className="mt-4 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-cyan-400 hover:text-cyan-300">Retry</button>}
      </section>
    </div>
  );
}
