"use client";

import React from "react";
import type { RunMode } from "@/lib/playwright-runner/types";

interface RunModeSelectorProps {
  value: RunMode;
  headedAvailable: boolean;
  onChange: (mode: RunMode) => void;
  disabled?: boolean;
}

export function RunModeSelector({
  value,
  headedAvailable,
  onChange,
  disabled = false,
}: RunModeSelectorProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
      <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
        Execution Mode
      </h3>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label
          className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
            value === "headless"
              ? "bg-indigo-950/40 border-indigo-500/40 text-white"
              : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/40"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="playwright-run-mode"
            className="text-indigo-600 focus:ring-0 bg-slate-800 border-slate-700"
            checked={value === "headless"}
            disabled={disabled}
            onChange={() => onChange("headless")}
          />
          <div className="flex flex-col">
            <span className="font-semibold">Headless</span>
            <span className="text-[10px] text-slate-400 font-mono">Fast / CI</span>
          </div>
        </label>

        <label
          className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
            value === "headed"
              ? "bg-indigo-950/40 border-indigo-500/40 text-white"
              : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/40"
          } ${disabled || !headedAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="playwright-run-mode"
            className="text-indigo-600 focus:ring-0 bg-slate-800 border-slate-700"
            checked={value === "headed"}
            disabled={disabled || !headedAvailable}
            onChange={() => onChange("headed")}
          />
          <div className="flex flex-col">
            <span className="font-semibold">Headed</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {headedAvailable ? "Visual Host" : "Unavailable"}
            </span>
          </div>
        </label>
      </div>

      <p className="mt-2.5 text-[11px] font-mono text-slate-400 leading-relaxed">
        {value === "headed"
          ? "Headed mode opens real browser windows on the connected Local Agent host desktop."
          : "Headless mode runs tests in the background with maximum speed and isolation."}
      </p>
    </section>
  );
}

export default RunModeSelector;
