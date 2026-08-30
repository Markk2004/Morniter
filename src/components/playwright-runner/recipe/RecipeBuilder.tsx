"use client";

import React from "react";
import type { RecipeDraft, RecipeAction, ReusableFlow } from "@/lib/playwright-runner/recipe-types";
import type { CatalogTestTarget } from "@/lib/playwright-runner/types";
import { ActionEditor } from "./ActionEditor";

interface RecipeBuilderProps {
  draft: RecipeDraft;
  flows: ReusableFlow[];
  testTarget?: CatalogTestTarget;
  onChange: (updated: RecipeDraft) => void;
  onClose: () => void;
  onSave?: () => Promise<boolean>;
  onRunDraft?: () => Promise<boolean>;
  isSaving?: boolean;
  isRunDraftRunning?: boolean;
  isDraftVerified?: boolean;
  saveError?: string | null;
  saveSuccess?: boolean;
  disabled?: boolean;
}

export function RecipeBuilder({
  draft,
  flows,
  testTarget,
  onChange,
  onClose,
  onSave,
  onRunDraft,
  isSaving = false,
  isRunDraftRunning = false,
  isDraftVerified = false,
  saveError,
  saveSuccess = false,
  disabled = false,
}: RecipeBuilderProps) {
  const handleAddAction = (isCleanup = false) => {
    const newAction: RecipeAction = { kind: "goto", url: "/" };
    if (isCleanup) {
      onChange({
        ...draft,
        cleanupActions: [...(draft.cleanupActions || []), newAction],
      });
    } else {
      onChange({
        ...draft,
        actions: [...draft.actions, newAction],
      });
    }
  };

  const handleUpdateAction = (index: number, updated: RecipeAction, isCleanup = false) => {
    if (isCleanup) {
      const list = [...(draft.cleanupActions || [])];
      list[index] = updated;
      onChange({ ...draft, cleanupActions: list });
    } else {
      const list = [...draft.actions];
      list[index] = updated;
      onChange({ ...draft, actions: list });
    }
  };

  const handleDeleteAction = (index: number, isCleanup = false) => {
    if (isCleanup) {
      const list = (draft.cleanupActions || []).filter((_, i) => i !== index);
      onChange({ ...draft, cleanupActions: list });
    } else {
      const list = draft.actions.filter((_, i) => i !== index);
      onChange({ ...draft, actions: list });
    }
  };

  const handleMoveAction = (index: number, direction: "up" | "down", isCleanup = false) => {
    const list = isCleanup ? [...(draft.cleanupActions || [])] : [...draft.actions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    if (isCleanup) {
      onChange({ ...draft, cleanupActions: list });
    } else {
      onChange({ ...draft, actions: list });
    }
  };

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-slate-900/90 p-4 space-y-4 font-mono text-xs shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>✨</span>
            <span>Recipe Builder</span>
            <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
              Draft
            </span>
            {isDraftVerified ? (
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                ✅ Verified Passing
              </span>
            ) : (
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/30">
                ⚠️ Unverified
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Design structured browser automation steps. Code generates live in Code Workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRunDraft && (
            <button
              type="button"
              onClick={onRunDraft}
              disabled={disabled || isRunDraftRunning || draft.actions.length === 0}
              className="px-3 py-1.5 rounded-lg border border-indigo-500/50 bg-indigo-600/30 text-indigo-200 hover:bg-indigo-600/50 hover:text-white disabled:opacity-40 text-xs font-semibold cursor-pointer transition-colors"
            >
              {isRunDraftRunning ? "⏳ Running..." : "▶️ Test Draft"}
            </button>
          )}

          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={disabled || isSaving || !isDraftVerified}
              title={!isDraftVerified ? "Run and verify draft in browser before saving" : "Save as automated test"}
              className="px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600/30 text-emerald-200 hover:bg-emerald-600/50 hover:text-white disabled:opacity-40 text-xs font-semibold cursor-pointer transition-colors"
            >
              {isSaving ? "⏳ Saving..." : "💾 Save as Automated Test"}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Save Error & Success Alerts */}
      {saveError && (
        <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs">
          <strong>Save Failed:</strong> {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-xs">
          <strong>Success:</strong> Recipe saved to ProjectSTS and validated with Playwright!
        </div>
      )}

      {/* Metadata Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Recipe Title</label>
          <input
            type="text"
            value={draft.title}
            disabled={disabled}
            placeholder="e.g. Verify student enrollment flow"
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Generated Output File</label>
          <input
            type="text"
            value={draft.output}
            disabled={disabled}
            placeholder="frontend/e2e/generated/..."
            onChange={(e) => onChange({ ...draft, output: e.target.value })}
            className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-400">Risk Level</label>
            {testTarget && (
              <span className="text-[10px] text-slate-400">
                Target: <strong className="text-slate-300">{testTarget.label}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...draft, risk: "read-only" })}
              className={`flex-1 py-1.5 px-2 rounded border text-xs font-semibold cursor-pointer transition-colors ${
                draft.risk === "read-only"
                  ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              🛡️ Read-Only
            </button>
            <button
              type="button"
              disabled={disabled || testTarget?.allowMutating === false}
              title={testTarget?.allowMutating === false ? "Mutating execution is disabled for this environment" : undefined}
              onClick={() => onChange({
                ...draft,
                risk: "mutating",
                cleanupActions: draft.cleanupActions && draft.cleanupActions.length > 0 ? draft.cleanupActions : [{ kind: "goto", url: "/" }],
              })}
              className={`flex-1 py-1.5 px-2 rounded border text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                draft.risk === "mutating"
                  ? "border-amber-500/50 bg-amber-950/40 text-amber-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              ⚠️ Mutating (Writes Data)
            </button>
          </div>
          {testTarget?.allowMutating === false && (
            <p className="text-[10px] text-amber-400 mt-1">
              ⚠️ Mutating execution is disabled for this environment.
            </p>
          )}
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">UAT Function ID</label>
          <input
            type="text"
            value={draft.functionId}
            disabled={disabled}
            placeholder="e.g. FN-STS-01"
            onChange={(e) => onChange({ ...draft, functionId: e.target.value })}
            className="w-full rounded border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Actions Sequence */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Test Actions Sequence ({draft.actions.length})
          </h4>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAddAction(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>+</span>
            <span>Add Action</span>
          </button>
        </div>

        {draft.actions.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center text-slate-500 italic">
            No actions in recipe yet. Click &quot;Add Action&quot; to begin building your test sequence.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {draft.actions.map((action, idx) => (
              <ActionEditor
                key={`action-${idx}`}
                index={idx}
                action={action}
                flows={flows}
                disabled={disabled}
                onChange={(updated) => handleUpdateAction(idx, updated, false)}
                onDelete={() => handleDeleteAction(idx, false)}
                onMoveUp={idx > 0 ? () => handleMoveAction(idx, "up", false) : undefined}
                onMoveDown={idx < draft.actions.length - 1 ? () => handleMoveAction(idx, "down", false) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mutating Cleanup Section */}
      {draft.risk === "mutating" && (
        <div className="space-y-2 pt-2 border-t border-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>🧹</span>
                <span>Cleanup Actions (Guaranteed Execution)</span>
              </h4>
              <p className="text-[10px] text-amber-400/80">
                Executed in a finally block even if preceding test actions fail.
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleAddAction(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>+</span>
              <span>Add Cleanup Action</span>
            </button>
          </div>

          {(!draft.cleanupActions || draft.cleanupActions.length === 0) ? (
            <div className="p-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-950/20 text-center text-amber-400 italic">
              Mutating recipes require at least one cleanup action.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {draft.cleanupActions.map((action, idx) => (
                <ActionEditor
                  key={`cleanup-${idx}`}
                  index={idx}
                  action={action}
                  flows={flows}
                  disabled={disabled}
                  onChange={(updated) => handleUpdateAction(idx, updated, true)}
                  onDelete={() => handleDeleteAction(idx, true)}
                  onMoveUp={idx > 0 ? () => handleMoveAction(idx, "up", true) : undefined}
                  onMoveDown={idx < (draft.cleanupActions?.length || 0) - 1 ? () => handleMoveAction(idx, "down", true) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RecipeBuilder;
