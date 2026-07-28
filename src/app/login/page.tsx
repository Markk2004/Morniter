"use client";

import React, { useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import { createTabSessionMarker, TAB_SESSION_STORAGE_KEY } from "@/lib/auth/tab-session";

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
        window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, createTabSessionMarker());
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
    <main className="min-h-screen bg-[#0a0d14] text-slate-100 font-sans selection:bg-cyan-300 selection:text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-2xl shadow-black/30 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="order-2 flex min-h-[560px] flex-col justify-between border-t border-slate-800 p-6 sm:p-10 lg:order-1 lg:border-r lg:border-t-0 lg:p-14">
            <div>
              <BrandLogo size="md" />
              <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300">
                Morniter / Workspace access
              </p>
              <h1 className="mt-4 max-w-md text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                See what changed before it becomes a problem.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
                Sign in to review deployment telemetry, service health and test execution logs.
              </p>
            </div>

            <p className="max-w-sm font-mono text-[11px] leading-5 text-slate-400">
              Read-only monitoring workspace. Test execution requires a separate unlock step.
            </p>
          </section>

          <section className="order-1 flex min-h-[560px] items-center p-6 sm:p-10 lg:order-2 lg:p-12">
            <div className="w-full max-w-sm">
              <p className="font-mono text-xs text-slate-400">Group authentication</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Project Monitor Access
              </h2>
              <p id="group-password-help" className="mt-3 text-sm leading-6 text-slate-300">
                Enter the group password to view telemetry.
              </p>

              {errorMsg && (
                <div role="alert" className="mt-6 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="group-password" className="block text-sm font-medium text-slate-200">
                    Group password
                  </label>
                  <input
                    id="group-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    aria-describedby="group-password-help"
                    aria-invalid={Boolean(errorMsg)}
                    required
                    autoFocus
                    className="w-full rounded-lg border border-slate-700 bg-[#0a0d14] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 hover:border-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || !password}
                  className="w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-[#111827] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isPending ? "Authenticating..." : "Sign in"}
                </button>
              </form>

              <p className="mt-8 border-t border-slate-800 pt-5 font-mono text-[11px] leading-5 text-slate-400">
                This session is limited to the current browser tab.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
