"use client";

import React from "react";
import type { RecipeAction, ReusableFlow } from "@/lib/playwright-runner/recipe-types";
import { LocatorEditor } from "./LocatorEditor";
import { FlowSelector } from "./FlowSelector";

interface ActionEditorProps {
  index: number;
  action: RecipeAction;
  flows: ReusableFlow[];
  onChange: (updated: RecipeAction) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disabled?: boolean;
}

export function ActionEditor({
  index,
  action,
  flows,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  disabled = false,
}: ActionEditorProps) {
  const handleKindChange = (kind: RecipeAction["kind"]) => {
    switch (kind) {
      case "goto":
        onChange({ kind: "goto", url: "/" });
        break;
      case "fill":
        onChange({ kind: "fill", target: { kind: "label", text: "" }, value: "" });
        break;
      case "click":
        onChange({ kind: "click", target: { kind: "role", role: "button", name: "" } });
        break;
      case "select":
        onChange({ kind: "select", target: { kind: "role", role: "combobox", name: "" }, value: "" });
        break;
      case "expect-visible":
        onChange({ kind: "expect-visible", target: { kind: "text", text: "" } });
        break;
      case "expect-url":
        onChange({ kind: "expect-url", url: "/", matchType: "contains" });
        break;
      case "expect-text":
        onChange({ kind: "expect-text", target: { kind: "role", role: "heading", name: "" }, text: "" });
        break;
      case "use-flow":
        onChange({ kind: "use-flow", flowId: flows[0]?.id || "" });
        break;
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5 font-mono text-xs shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
            {index + 1}
          </span>
          <select
            value={action.kind}
            disabled={disabled}
            onChange={(e) => handleKindChange(e.target.value as RecipeAction["kind"])}
            className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-white text-xs font-semibold focus:border-indigo-500 focus:outline-none"
          >
            <option value="goto">🌐 Go to URL</option>
            <option value="fill">⌨️ Fill Input</option>
            <option value="click">🖱️ Click</option>
            <option value="select">🔽 Select Option</option>
            <option value="expect-visible">👁️ Expect Visible</option>
            <option value="expect-url">🔗 Expect URL</option>
            <option value="expect-text">📄 Expect Text</option>
            <option value="use-flow">⚡ Reusable Flow</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button
              type="button"
              disabled={disabled}
              onClick={onMoveUp}
              title="Move action up"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            >
              ⬆️
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              disabled={disabled}
              onClick={onMoveDown}
              title="Move action down"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            >
              ⬇️
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={onDelete}
            title="Delete action"
            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 cursor-pointer"
          >
            🗑️
          </button>
        </div>
      </div>

      {action.evidence && (
        <div className="flex items-center justify-between gap-2 rounded bg-slate-900 px-2.5 py-1 text-[11px] border border-slate-800 text-slate-300">
          <span className="truncate">
            <span className="text-slate-400 mr-1 font-semibold">🔍 Evidence:</span>
            <span>{action.evidence}</span>
          </span>
          {action.confidence && (
            <span
              className={`shrink-0 rounded px-1.5 py-0.2 text-[9px] font-mono border ${
                action.confidence === "high"
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                  : action.confidence === "medium"
                    ? "border-amber-500/30 bg-amber-950/40 text-amber-300"
                    : "border-rose-500/30 bg-rose-950/40 text-rose-300"
              }`}
            >
              {action.confidence.toUpperCase()}
            </span>
          )}
        </div>
      )}

      {action.kind === "goto" && (
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">Target Route or URL</label>
          <input
            type="text"
            value={action.url}
            disabled={disabled}
            placeholder="e.g. /login or /dashboard"
            onChange={(e) => onChange({ ...action, url: e.target.value })}
            className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {action.kind === "fill" && (
        <div className="space-y-2">
          <LocatorEditor
            value={action.target}
            disabled={disabled}
            onChange={(target) => onChange({ ...action, target })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-0.5">
                {action.isSecretEnv ? "Environment Variable Name" : "Input Value"}
              </label>
              <input
                type="text"
                value={action.value}
                disabled={disabled}
                placeholder={action.isSecretEnv ? "e.g. STS_UAT_PASSWORD" : "e.g. user@test.local"}
                onChange={(e) => onChange({ ...action, value: e.target.value })}
                className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center pt-4">
              <label className="flex items-center gap-2 text-[11px] text-amber-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(action.isSecretEnv)}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...action, isSecretEnv: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0"
                />
                <span>Reference Secret Env Var</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {action.kind === "click" && (
        <LocatorEditor
          value={action.target}
          disabled={disabled}
          onChange={(target) => onChange({ ...action, target })}
        />
      )}

      {action.kind === "select" && (
        <div className="space-y-2">
          <LocatorEditor
            value={action.target}
            disabled={disabled}
            onChange={(target) => onChange({ ...action, target })}
          />
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Option Value or Text</label>
            <input
              type="text"
              value={action.value}
              disabled={disabled}
              placeholder="e.g. Option 1"
              onChange={(e) => onChange({ ...action, value: e.target.value })}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {action.kind === "expect-visible" && (
        <div className="space-y-2">
          <LocatorEditor
            value={action.target}
            disabled={disabled}
            onChange={(target) => onChange({ ...action, target })}
          />
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Timeout (ms, optional)</label>
            <input
              type="number"
              value={action.timeoutMs ?? ""}
              disabled={disabled}
              placeholder="Default 5000"
              onChange={(e) => onChange({ ...action, timeoutMs: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {action.kind === "expect-url" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Expected URL Pattern</label>
            <input
              type="text"
              value={action.url}
              disabled={disabled}
              placeholder="e.g. /dashboard"
              onChange={(e) => onChange({ ...action, url: e.target.value })}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Match Type</label>
            <select
              value={action.matchType ?? "contains"}
              disabled={disabled}
              onChange={(e) => onChange({ ...action, matchType: e.target.value as "exact" | "contains" })}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
            >
              <option value="contains">Contains substring</option>
              <option value="exact">Exact match</option>
            </select>
          </div>
        </div>
      )}

      {action.kind === "expect-text" && (
        <div className="space-y-2">
          <LocatorEditor
            value={action.target}
            disabled={disabled}
            onChange={(target) => onChange({ ...action, target })}
          />
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Expected Text to Contain</label>
            <input
              type="text"
              value={action.text}
              disabled={disabled}
              placeholder="e.g. Operation successful"
              onChange={(e) => onChange({ ...action, text: e.target.value })}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {action.kind === "use-flow" && (
        <FlowSelector
          flows={flows}
          value={action.flowId}
          disabled={disabled}
          onChange={(flowId) => onChange({ ...action, flowId })}
        />
      )}
    </div>
  );
}
