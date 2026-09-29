"use client";

import React, { useEffect } from "react";
import type { ProjectCoverageTest } from "@/lib/playwright-runner/types";
import {
  getMatchReasonLabels,
  getRunnerLabel,
  getTestThaiMeta,
} from "./test-explorer-presentation";

export interface TestDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  test: ProjectCoverageTest | null;
  functionId?: string;
  functionName?: string;
  onLoadSource?: (testId: string) => void;
  onToggleSelect?: (testId: string) => void;
  isSelected?: boolean;
  disabled?: boolean;
}

export function TestDetailDrawer({
  isOpen,
  onClose,
  test,
  functionId,
  functionName,
  onLoadSource,
  onToggleSelect,
  isSelected = false,
  disabled = false,
}: TestDetailDrawerProps) {
  // Close drawer on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !test) return null;

  const matchReasons = getMatchReasonLabels(test.matchedBy);
  const testMeta = getTestThaiMeta(test.title);
  const functionLabel =
    functionId && functionName
      ? `${functionId} · ${functionName}`
      : functionName || functionId || "ไม่มีข้อมูลฟังก์ชัน";

  const isRunnable = test.executable !== false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-test-title"
      className="fixed inset-0 z-50 overflow-hidden flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative z-10 w-full max-w-lg bg-slate-900/98 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden text-slate-200 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-sm">
              📋
            </span>
            <div className="min-w-0">
              <h2
                id="drawer-test-title"
                className="text-sm font-bold text-slate-100 truncate"
                title={test.title}
              >
                รายละเอียดการทดสอบ (Test Details)
              </h2>
              <span className="text-[11px] font-mono text-slate-400 block truncate">
                ID: {test.id}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Main Title & Role Badges */}
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded-md border font-semibold ${testMeta.roleBadgeStyle}`}
              >
                {testMeta.role}
              </span>
              <span
                className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                  test.risk === "mutating"
                    ? "border-amber-500/30 bg-amber-950/40 text-amber-300 font-medium"
                    : "border-slate-700 bg-slate-800/60 text-slate-300"
                }`}
              >
                {test.risk === "mutating" ? "⚠️ Mutating" : "🛡️ Read-only"}
              </span>
              <span
                className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                  isRunnable
                    ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300 font-medium"
                    : "border-slate-800 bg-slate-800/40 text-slate-400"
                }`}
              >
                {isRunnable ? "✅ พร้อมรัน" : "⛔ ไม่สามารถรันได้"}
              </span>
            </div>

            <h3 className="text-base font-bold text-white leading-snug">
              {test.title}
            </h3>

            {testMeta.description && (
              <div className="rounded-lg bg-indigo-950/30 border border-indigo-500/20 p-3 text-xs text-indigo-200">
                <span className="font-semibold text-indigo-300 block mb-1">
                  💡 วัตถุประสงค์และฟังก์ชันที่ทดสอบ:
                </span>
                {testMeta.description}
              </div>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="flex flex-wrap items-center gap-2">
            {onLoadSource && (
              <button
                type="button"
                onClick={() => {
                  onLoadSource(test.id);
                  onClose();
                }}
                disabled={disabled}
                className="flex-1 min-w-[160px] py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span>📝</span>
                <span>เปิดโค้ดใน Workspace</span>
              </button>
            )}

            {onToggleSelect && isRunnable && (
              <button
                type="button"
                onClick={() => onToggleSelect(test.id)}
                disabled={disabled}
                className={`py-2 px-3 rounded-lg border font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-300"
                    : "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200"
                }`}
              >
                <span>{isSelected ? "✓" : "+"}</span>
                <span>{isSelected ? "เลือกแล้ว" : "เลือกเทสต์นี้"}</span>
              </button>
            )}
          </div>

          {/* Detailed Specifications */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
              <span>⚙️</span>
              <span>ข้อมูลทางเทคนิคและการจับคู่ฟังก์ชัน</span>
            </h4>

            <div className="grid grid-cols-1 gap-2.5 text-xs">
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                <span className="text-[10px] text-slate-400 block mb-0.5">
                  ฟังก์ชันระบบ (Sheet Function / Spec Target)
                </span>
                <span className="font-semibold text-slate-100 font-mono">
                  {functionLabel}
                </span>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                <span className="text-[10px] text-slate-400 block mb-0.5">
                  ที่อยู่ไฟล์ทดสอบ (Relative File Path)
                </span>
                <span className="font-mono text-indigo-300 break-all select-all">
                  {test.relativePath}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                  <span className="text-[10px] text-slate-400 block mb-0.5">
                    เครื่องมือทดสอบ (Test Runner)
                  </span>
                  <span className="font-medium text-slate-200">
                    {getRunnerLabel(test.runner)}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                  <span className="text-[10px] text-slate-400 block mb-0.5">
                    ความมั่นใจการจับคู่ (Confidence)
                  </span>
                  <span className="font-medium text-slate-200 capitalize">
                    {test.confidence || "Standard"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Match Reasons */}
          {matchReasons.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                <span>🔍</span>
                <span>เหตุผลการจับคู่ฟังก์ชัน (Match Reasons)</span>
              </h4>
              <ul className="space-y-1.5">
                {matchReasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-lg bg-slate-950/40 border border-slate-800/80 text-xs text-slate-300"
                  >
                    <span className="text-indigo-400 shrink-0">▸</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Helpful Guidance */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/30 p-3 text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300 block">
              💡 วิธีการรันและดูโค้ด:
            </span>
            <p>
              คุณสามารถกดปุ่ม <strong>"เปิดโค้ดใน Workspace"</strong> เพื่อดูโค้ดที่แท้จริงของเทสต์นี้ ซึ่งจะมี <code>// comment</code> อธิบายรายละเอียดของคำสั่งแต่ละบรรทัดให้เข้าใจง่าย
            </p>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-mono text-slate-400">
            กด <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">Esc</kbd> เพื่อปิด
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

export default TestDetailDrawer;
