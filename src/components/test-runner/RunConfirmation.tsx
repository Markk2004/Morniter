"use client";

import React from "react";
import type { TestPreset } from "@/lib/test-runner/types";

interface RunConfirmationProps {
  isOpen: boolean;
  projectName: string;
  preset: TestPreset | null;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RunConfirmation({
  isOpen,
  projectName,
  preset,
  isSubmitting,
  onConfirm,
  onCancel,
}: RunConfirmationProps) {
  if (!isOpen || !preset) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-labelledby="confirm-dialog-title"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div>
          <h3 id="confirm-dialog-title" className="text-lg font-bold text-slate-100 flex items-center gap-2">
            Confirm Test Run
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Execution will be queued for the local runner agent.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Project:</span>
            <span className="text-slate-200 font-semibold">{projectName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Preset:</span>
            <span className="text-cyan-400 font-semibold">{preset.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Type:</span>
            <span className="text-slate-200">{preset.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">SRS / BR:</span>
            <span className="text-slate-200">{preset.srsIds.length ? preset.srsIds.join(", ") : "General"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Target:</span>
            <span className="text-slate-200">
              {preset.category === "execution" ? "Aiven defaultdb" : preset.category === "uat" ? "Read-only deployment" : "No database"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Command:</span>
            <span className="text-emerald-400">{preset.commandPreview}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Timeout:</span>
            <span className="text-slate-300">{preset.timeoutSeconds} seconds</span>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800/60 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
          >
            {isSubmitting ? "Queuing..." : "Confirm Run"}
          </button>
        </div>
      </div>
    </div>
  );
}
