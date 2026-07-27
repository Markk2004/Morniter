"use client";

import React, { useState } from "react";
import type { MonitorSnapshot } from "@/lib/monitor/types";

interface DiagnosticTerminalProps {
  onCommandResult?: (snapshot: MonitorSnapshot) => void;
}

export default function DiagnosticTerminal({ onCommandResult }: DiagnosticTerminalProps) {
  const [commandInput, setCommandInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [commandHistory, setCommandHistory] = useState<
    { cmd: string; time: string; status: "success" | "error"; msg?: string }[]
  >([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd || isPending) return;

    setIsPending(true);
    const nowStr = new Date().toLocaleTimeString();

    try {
      const res = await fetch("/api/monitor/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: "Command failed" }));
        setCommandHistory((prev) => [
          { cmd, time: nowStr, status: "error", msg: errJson.error || "Command error" },
          ...prev,
        ]);
        return;
      }

      const snapshot: MonitorSnapshot = await res.json();
      setCommandHistory((prev) => [
        { cmd, time: nowStr, status: "success", msg: `Found ${snapshot.events.length} matching events` },
        ...prev,
      ]);

      if (onCommandResult) {
        onCommandResult(snapshot);
      }
      setCommandInput("");
    } catch {
      setCommandHistory((prev) => [
        { cmd, time: nowStr, status: "error", msg: "Network error executing command" },
        ...prev,
      ]);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono space-y-3 shadow-xl">
      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
        <span className="text-slate-400 font-semibold flex items-center gap-2">
          <span className="text-cyan-400 font-bold">$</span> Diagnostic Terminal
        </span>
        <span className="text-[10px] text-slate-500">Read-Only Query Engine</span>
      </div>

      {/* Command Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span className="text-emerald-400 font-bold text-sm">$</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="e.g. logs render backend --last 50, errors, health all..."
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition font-mono"
        />
        <button
          type="submit"
          disabled={isPending || !commandInput.trim()}
          className="px-3 py-1.5 rounded bg-cyan-950 border border-cyan-700/60 hover:bg-cyan-900 text-cyan-200 text-xs font-mono font-semibold transition disabled:opacity-50"
        >
          {isPending ? "Executing..." : "Run"}
        </button>
      </form>

      {/* History */}
      {commandHistory.length > 0 && (
        <div className="space-y-1.5 max-h-36 overflow-y-auto text-[11px] pt-1">
          {commandHistory.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-slate-400 border-t border-slate-900 pt-1">
              <span className="text-cyan-300">$ {item.cmd}</span>
              <span
                className={`text-[10px] ${
                  item.status === "success" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {item.msg} ({item.time})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
