"use client";

import React from "react";
import type { BrowserName } from "@/lib/playwright-runner/types";

interface BrowserSelectorProps {
  selected: BrowserName[];
  capabilities?: {
    chromium?: boolean;
    firefox?: boolean;
    webkit?: boolean;
  };
  onToggle: (browser: BrowserName) => void;
  disabled?: boolean;
}

const ALL_BROWSERS: { id: BrowserName; label: string; icon: string }[] = [
  { id: "chromium", label: "Google Chrome", icon: "🌐" },
  { id: "firefox", label: "Firefox", icon: "🦊" },
  { id: "webkit", label: "WebKit (Safari)", icon: "🧭" },
];

export function BrowserSelector({
  selected,
  capabilities,
  onToggle,
  disabled = false,
}: BrowserSelectorProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
          Target Browsers
        </h3>
        <span className="text-[10px] font-mono text-indigo-400">
          {selected.length} selected
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {ALL_BROWSERS.map((browser) => {
          const isInstalled =
            !capabilities || capabilities[browser.id] !== false;
          const isChecked = selected.includes(browser.id);

          return (
            <label
              key={browser.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium cursor-pointer select-none transition-colors ${
                isChecked
                  ? "bg-indigo-950/40 border-indigo-500/40 text-white"
                  : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/40"
              } ${disabled || !isInstalled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  aria-label={browser.label}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                  checked={isChecked}
                  disabled={disabled || !isInstalled}
                  onChange={() => onToggle(browser.id)}
                />
                <span className="text-sm">{browser.icon}</span>
                <span>{browser.label}</span>
              </div>

              {!isInstalled && (
                <span className="text-[10px] font-mono text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  not installed
                </span>
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}

export default BrowserSelector;
