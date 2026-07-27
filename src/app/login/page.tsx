"use client";

import React, { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isPending) return;

    setIsPending(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.status === 204) {
        window.location.href = "/monitor";
        return;
      }

      const data = await res.json().catch(() => ({ error: "Invalid credentials" }));
      setErrorMsg(data.error || "Invalid credentials");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-cyan-500 selection:text-black">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 backdrop-blur">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 items-center justify-center font-mono font-bold text-black text-xl shadow-lg shadow-cyan-500/20 mb-2">
            M
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Project Monitor Access</h1>
          <p className="text-xs text-slate-400 font-mono">
            Enter group access password to view telemetry
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-mono text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="group-password" className="block text-xs font-mono text-slate-300">
              Group password
            </label>
            <input
              id="group-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white placeholder-slate-600 text-sm outline-none transition font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !password}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 font-mono font-bold text-slate-950 text-sm transition shadow-lg shadow-cyan-500/10 disabled:opacity-50"
          >
            {isPending ? "Authenticating..." : "Sign in"}
          </button>
        </form>

        <div className="text-[11px] text-slate-500 text-center font-mono border-t border-slate-800/80 pt-4">
          Read-only telemetry session (8 hours)
        </div>
      </div>
    </div>
  );
}
