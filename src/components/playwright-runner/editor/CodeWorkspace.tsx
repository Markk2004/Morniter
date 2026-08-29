"use client";

import React from "react";

interface CodeWorkspaceProps {
  code: string;
  onChange: (code: string) => void;
  dirty?: boolean;
  onReset?: () => void;
  disabled?: boolean;
}

const TEMPLATES = [
  {
    name: "Basic Navigation",
    code: `import { test, expect } from "@playwright/test";

test("Page title and navigation", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await expect(page).toHaveTitle(/.*Monitor.*/);
});
`,
  },
  {
    name: "Form Fill & Auth",
    code: `import { test, expect } from "@playwright/test";

test("Login flow verification", async ({ page }) => {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel(/username|user/i).fill("test-user");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /login|sign in/i }).click();
  await expect(page).not.toHaveURL(/\\/login/);
});
`,
  },
  {
    name: "API Health Check",
    code: `import { test, expect } from "@playwright/test";

test("Health check endpoint", async ({ request }) => {
  const res = await request.get("http://localhost:3000/api/monitor/redis-status");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data).toHaveProperty("healthy");
});
`,
  },
];

export function CodeWorkspace({
  code,
  onChange,
  dirty = false,
  onReset,
  disabled = false,
}: CodeWorkspaceProps) {
  const lineCount = code ? code.split("\n").length : 1;
  const byteSize = typeof window !== "undefined" ? new Blob([code]).size : code.length;
  const maxBytes = 200000;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newCode = code.substring(0, start) + "  " + code.substring(end);
      onChange(newCode);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-sm overflow-hidden flex flex-col">
      {/* Editor Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-200">
            📝 Code Workspace
          </span>
          {dirty && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
              Draft Modified
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Template picker */}
          <select
            aria-label="Insert template"
            disabled={disabled}
            onChange={(e) => {
              const selectedTpl = TEMPLATES.find((t) => t.name === e.target.value);
              if (selectedTpl) {
                onChange(selectedTpl.code);
              }
            }}
            defaultValue=""
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none"
          >
            <option value="" disabled>
              + Template
            </option>
            {TEMPLATES.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>

          {onReset && dirty && (
            <button
              type="button"
              disabled={disabled}
              onClick={onReset}
              className="px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            >
              Reset
            </button>
          )}

          <div className="text-[10px] font-mono text-slate-400 border-l border-slate-800 pl-2">
            <span>{lineCount} lines</span>
            <span className="mx-1">•</span>
            <span className={byteSize > maxBytes ? "text-rose-400" : ""}>
              {(byteSize / 1024).toFixed(1)} KB
            </span>
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative flex min-h-[260px] max-h-[440px] bg-slate-950/90 font-mono text-xs">
        {/* Line Numbers */}
        <div
          aria-hidden="true"
          className="select-none py-3 px-2 text-right text-slate-600 bg-slate-950 border-r border-slate-800/80 font-mono text-xs leading-relaxed"
        >
          {Array.from({ length: Math.max(lineCount, 12) }, (_, i) => (
            <div key={i + 1}>{i + 1}</div>
          ))}
        </div>

        {/* Code Textarea */}
        <textarea
          aria-label="Playwright Test Code"
          value={code}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full flex-1 p-3 bg-transparent text-slate-100 placeholder:text-slate-600 resize-none font-mono text-xs leading-relaxed focus:outline-none disabled:opacity-50"
          placeholder="// Write your Playwright test or load a spec from the Test Explorer..."
        />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-1.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>Runs as isolated spec in temporary workspace</span>
        <span>TypeScript / ESM syntax</span>
      </div>
    </section>
  );
}

export default CodeWorkspace;
