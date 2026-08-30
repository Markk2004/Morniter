"use client";

import React from "react";
import type { ReusableFlow } from "@/lib/playwright-runner/recipe-types";

interface FlowSelectorProps {
  flows: ReusableFlow[];
  value: string;
  onChange: (flowId: string) => void;
  disabled?: boolean;
}

export function FlowSelector({ flows, value, onChange, disabled = false }: FlowSelectorProps) {
  const selectedFlow = flows.find((f) => f.id === value);

  return (
    <div className="space-y-1.5 p-2.5 rounded-lg border border-slate-700/60 bg-slate-900/60 text-xs font-mono">
      <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Select Reusable Flow</label>
      <select
        value={value}
        disabled={disabled || flows.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
      >
        {flows.length === 0 ? (
          <option value="">No reusable flows configured</option>
        ) : (
          flows.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.actions.length} steps)
            </option>
          ))
        )}
      </select>
      {selectedFlow?.description && (
        <p className="text-[10px] text-slate-400 italic mt-1">{selectedFlow.description}</p>
      )}
    </div>
  );
}
