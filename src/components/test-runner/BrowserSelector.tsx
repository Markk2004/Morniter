"use client";

import React from "react";
import type { BrowserName, RunMode } from "@/lib/playwright-runner/types";

interface BrowserSelectorProps {
  selectedBrowsers: BrowserName[];
  onChangeBrowsers: (browsers: BrowserName[]) => void;
  mode: RunMode;
  onChangeMode: (mode: RunMode) => void;
  capabilities?: {
    browsers?: {
      chromium?: boolean;
      firefox?: boolean;
      webkit?: boolean;
    };
    headed?: boolean;
  };
  disabled?: boolean;
}

export function BrowserSelector({
  selectedBrowsers,
  onChangeBrowsers,
  mode,
  onChangeMode,
  capabilities,
  disabled = false,
}: BrowserSelectorProps) {
  const availableBrowsers: { id: BrowserName; label: string; icon: string }[] = [
    { id: "chromium", label: "Chromium", icon: "🌐" },
    { id: "firefox", label: "Firefox", icon: "🦊" },
    { id: "webkit", label: "WebKit (Safari)", icon: "🧭" },
  ];

  const handleToggleBrowser = (browser: BrowserName) => {
    if (selectedBrowsers.includes(browser)) {
      if (selectedBrowsers.length > 1) {
        onChangeBrowsers(selectedBrowsers.filter((b) => b !== browser));
      }
    } else {
      onChangeBrowsers([...selectedBrowsers, browser]);
    }
  };

  const isHeadedAllowed = capabilities?.headed !== false;

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Target Browsers & Execution Mode
        </h3>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChangeMode("headless")}
            className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-colors ${
              mode === "headless"
                ? "bg-indigo-600 text-white font-bold"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            Headless
          </button>
          <button
            type="button"
            disabled={disabled || !isHeadedAllowed}
            onClick={() => onChangeMode("headed")}
            title={!isHeadedAllowed ? "Headed mode disabled on this agent" : "Run in Headed mode"}
            className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-colors ${
              mode === "headed"
                ? "bg-amber-600 text-white font-bold"
                : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            } ${!isHeadedAllowed ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            Headed 👁️
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {availableBrowsers.map((b) => {
          const isSupported = capabilities?.browsers ? capabilities.browsers[b.id] !== false : true;
          const isChecked = selectedBrowsers.includes(b.id);

          return (
            <label
              key={b.id}
              className={`flex items-center space-x-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                isChecked
                  ? "bg-indigo-950/40 border-indigo-500/60 text-white"
                  : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600"
              } ${!isSupported || disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="checkbox"
                aria-label={`Select ${b.label}`}
                checked={isChecked}
                disabled={disabled || !isSupported}
                onChange={() => handleToggleBrowser(b.id)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-sm">{b.icon}</span>
              <span className="font-medium">{b.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
