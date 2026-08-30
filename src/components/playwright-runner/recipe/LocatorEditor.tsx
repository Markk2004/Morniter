"use client";

import React from "react";
import type { RecipeLocator } from "@/lib/playwright-runner/recipe-types";

interface LocatorEditorProps {
  value: RecipeLocator;
  onChange: (locator: RecipeLocator) => void;
  disabled?: boolean;
}

export function LocatorEditor({ value, onChange, disabled = false }: LocatorEditorProps) {
  const handleKindChange = (kind: RecipeLocator["kind"]) => {
    switch (kind) {
      case "role":
        onChange({ kind: "role", role: "button", name: "" });
        break;
      case "label":
        onChange({ kind: "label", text: "" });
        break;
      case "text":
        onChange({ kind: "text", text: "" });
        break;
      case "test-id":
        onChange({ kind: "test-id", id: "" });
        break;
    }
  };

  return (
    <div className="space-y-2 p-2.5 rounded-lg border border-slate-700/60 bg-slate-900/60 text-xs font-mono">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Locator:</span>
        <select
          value={value.kind}
          disabled={disabled}
          onChange={(e) => handleKindChange(e.target.value as RecipeLocator["kind"])}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-white text-xs focus:border-indigo-500 focus:outline-none"
        >
          <option value="role">Role</option>
          <option value="label">Label</option>
          <option value="text">Text</option>
          <option value="test-id">Test ID</option>
        </select>
      </div>

      {value.kind === "role" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Role Type</label>
            <select
              value={value.role}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, role: e.target.value as typeof value.role })}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-white text-xs focus:border-indigo-500 focus:outline-none"
            >
              <option value="button">button</option>
              <option value="link">link</option>
              <option value="textbox">textbox</option>
              <option value="heading">heading</option>
              <option value="checkbox">checkbox</option>
              <option value="combobox">combobox</option>
              <option value="option">option</option>
              <option value="radio">radio</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Accessible Name</label>
            <input
              type="text"
              value={value.name ?? ""}
              disabled={disabled}
              placeholder="e.g. Sign In"
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-white text-xs focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {value.kind === "label" && (
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">Label Text</label>
          <input
            type="text"
            value={value.text}
            disabled={disabled}
            placeholder="e.g. Username or Email"
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {value.kind === "text" && (
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">Matching Text</label>
          <input
            type="text"
            value={value.text}
            disabled={disabled}
            placeholder="e.g. Welcome Back"
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {value.kind === "test-id" && (
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">data-testid value</label>
          <input
            type="text"
            value={value.id}
            disabled={disabled}
            placeholder="e.g. submit-btn"
            onChange={(e) => onChange({ ...value, id: e.target.value })}
            className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
