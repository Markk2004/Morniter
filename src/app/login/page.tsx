"use client";

import React, { useState } from "react";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
import { createTabSessionMarker, TAB_SESSION_STORAGE_KEY } from "@/lib/auth/tab-session";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <main className="min-h-screen bg-[#07110f] font-sans text-[#eef8e9] selection:bg-[#9cff57] selection:text-[#07110f]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <div className="grid w-full overflow-hidden rounded-xl border border-[#274236] bg-[#0c1916] shadow-2xl shadow-black/30 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative order-2 flex min-h-[620px] flex-col justify-between overflow-hidden border-t border-[#274236] p-6 sm:p-10 lg:order-1 lg:border-r lg:border-t-0 lg:p-14">
            <div className="pointer-events-none absolute inset-0 opacity-80">
              <Image
                src="/images/cybersecurity-network.png"
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover object-right"
              />
              <div className="absolute inset-0 bg-[#07110f]/65" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <BrandLogo size="md" />
                <p className="font-mono text-sm font-semibold tracking-[0.12em] text-[#eef8e9]">
                  Softdeath Monitor
                </p>
              </div>
            </div>
          </section>

          <section className="order-1 flex min-h-[620px] items-center bg-[#0c1916] p-6 sm:p-10 lg:order-2 lg:p-12">
            <div className="w-full max-w-sm">
              <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.16em] text-[#739482]">
                <span>ACCESS GATEWAY</span>
                <span className="text-[#9cff57]">AUTH / 01</span>
              </div>
              <h2 className="mt-5 text-3xl font-medium tracking-[-0.03em] text-[#f2faef]">
                Workspace access
              </h2>
              <p id="group-password-help" className="mt-3 text-sm leading-6 text-[#a7bbae]">
                Enter the group password to view telemetry.
              </p>

              {errorMsg && (
                <div role="alert" className="mt-6 flex items-start gap-3 border border-[#7b3d3d] bg-[#2a1515] p-3 text-sm text-[#ffc7c1]">
                  <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff756a]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="group-password" className="block text-sm font-medium text-[#d7e7d3]">
                    Group password
                  </label>
                  <div className="relative">
                    <input
                      id="group-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      aria-describedby="group-password-help"
                      aria-invalid={Boolean(errorMsg)}
                      required
                      autoFocus
                      className="w-full rounded-lg border border-[#385243] bg-[#07110f] px-4 py-3 pr-24 text-sm text-[#f2faef] outline-none transition-colors placeholder:text-[#617f6b] hover:border-[#52735d] focus:border-[#9cff57] focus:ring-2 focus:ring-[#9cff57]/25"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-1 right-1 rounded-md px-3 font-mono text-[10px] tracking-[0.1em] text-[#9db5a2] outline-none transition-colors hover:text-[#b6f694] focus-visible:ring-2 focus-visible:ring-[#9cff57]"
                    >
                      {showPassword ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending || !password}
                  className="w-full rounded-lg bg-[#9cff57] px-4 py-3 text-sm font-semibold text-[#07110f] outline-none transition-colors hover:bg-[#b6f694] focus-visible:ring-2 focus-visible:ring-[#9cff57] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1916] disabled:cursor-not-allowed disabled:bg-[#29412f] disabled:text-[#6f8875]"
                >
                  {isPending ? "Authenticating..." : "Access workspace"}
                </button>
              </form>

              <p className="mt-8 border-t border-[#274236] pt-5 font-mono text-[10px] leading-5 tracking-[0.04em] text-[#789184]">
                This session is limited to the current browser tab.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
