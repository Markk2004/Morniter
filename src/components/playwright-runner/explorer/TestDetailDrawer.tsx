"use client";

import React, { useEffect, useState } from "react";
import type { ProjectCoverageTest } from "@/lib/playwright-runner/types";
import {
  getMatchReasonLabels,
  getRunnerLabel,
  getTestThaiMeta,
  getFunctionDetailedDoc,
  resolveFunctionCategory,
} from "./test-explorer-presentation";
import { getFunctionTemplate } from "@/lib/playwright-runner/function-templates";

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
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Resolve function category and documentation
  const resolvedCat = resolveFunctionCategory(test.title, test.relativePath);
  const targetFnId = functionId || resolvedCat.code;
  const functionDoc = getFunctionDetailedDoc(test.title) || getFunctionDetailedDoc(targetFnId);
  const template = getFunctionTemplate(test.title) || getFunctionTemplate(targetFnId);

  const functionLabel =
    functionId && functionName
      ? `${functionId} · ${functionName}`
      : functionDoc?.name || functionName || functionId || "ไม่มีข้อมูลฟังก์ชัน";

  const isRunnable = test.executable !== false;

  const handleCopyCode = async (codeToCopy: string) => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

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
      <div className="relative z-10 w-full max-w-xl bg-slate-900/98 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden text-slate-200 animate-in slide-in-from-right duration-300">
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
                ID: {test.id} {targetFnId ? `· ${targetFnId}` : ""}
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
                {functionDoc?.role || testMeta.role}
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

            {(functionDoc?.overview || testMeta.description) && (
              <div className="rounded-lg bg-indigo-950/30 border border-indigo-500/20 p-3 text-xs text-indigo-200 space-y-1">
                <span className="font-semibold text-indigo-300 block">
                  💡 ภาพรวมและวัตถุประสงค์การทดสอบ:
                </span>
                <p className="leading-relaxed">
                  {functionDoc?.overview || testMeta.description}
                </p>
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

          {/* Comprehensive Function & Code Documentation Section */}
          {functionDoc && (
            <div className="space-y-3 rounded-xl border border-indigo-500/30 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">📘</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 font-mono">
                    คำอธิบายการทำงานของโค้ดสำหรับฟังก์ชันนี้
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {functionDoc.code}
                </span>
              </div>

              {/* Workflow Path */}
              {functionDoc.workflow && (
                <div className="text-xs rounded-lg bg-slate-900 border border-slate-800 p-2.5 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    🛣️ เส้นทางการทำงานของระบบ (Workflow):
                  </span>
                  <span className="font-mono text-slate-200 text-[11px] leading-relaxed block">
                    {functionDoc.workflow}
                  </span>
                </div>
              )}

              {/* Code Explanation Paragraph */}
              {functionDoc.codeExplanation && (
                <div className="text-xs rounded-lg bg-slate-900 border border-slate-800 p-2.5 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-300 block">
                    🔍 คำอธิบายโค้ด Playwright:
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {functionDoc.codeExplanation}
                  </p>
                </div>
              )}

              {/* Step-by-Step Flow */}
              {functionDoc.steps.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-slate-200 block">
                    📋 ขั้นตอนการทำงานของโค้ดทีละสเต็ป (Step-by-Step Execution):
                  </span>
                  <div className="space-y-1.5">
                    {functionDoc.steps.map((st, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs text-slate-200"
                      >
                        <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">
                          {st.replace(/^\d+\.\s*/, "")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expected Results */}
              {functionDoc.expectedResult && (
                <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-3 text-xs text-emerald-200 space-y-1">
                  <span className="font-semibold text-emerald-300 block">
                    🎯 ผลลัพธ์ที่คาดหวังเมื่อโค้ดรันสำเร็จ (Expected Results):
                  </span>
                  <p className="leading-relaxed text-emerald-200">
                    {functionDoc.expectedResult}
                  </p>
                </div>
              )}

              {/* Key Selectors */}
              {functionDoc.keySelectors.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    🎯 องค์ประกอบบนหน้าจอที่โค้ดค้นหาและสั่งการ (Target Elements & Selectors):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {functionDoc.keySelectors.map((sel, idx) => (
                      <span
                        key={idx}
                        className="inline-block text-[10px] font-mono px-2 py-1 rounded bg-slate-900 border border-slate-700/80 text-indigo-300"
                      >
                        {sel}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Code Preview Section with Thai Comments */}
          {template?.code && (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💻</span>
                  <span className="text-xs font-bold text-slate-200">
                    โค้ด Playwright พร้อมคอมเมนต์ภาษาไทย
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyCode(template.code)}
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono transition-colors cursor-pointer"
                  >
                    {copied ? "✓ คัดลอกแล้ว" : "คัดลอกโค้ด"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCode((prev) => !prev)}
                    className="px-2 py-1 rounded border border-indigo-500/40 bg-indigo-950/50 hover:bg-indigo-900/50 text-indigo-300 text-[11px] font-mono transition-colors cursor-pointer"
                  >
                    {showCode ? "▲ ซ่อนโค้ด" : "▼ ดูโค้ด"}
                  </button>
                </div>
              </div>

              {showCode ? (
                <div className="relative mt-2">
                  <pre className="max-h-72 overflow-y-auto p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300/90 leading-relaxed whitespace-pre select-all">
                    <code>{template.code}</code>
                  </pre>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  กดปุ่ม <strong>"▼ ดูโค้ด"</strong> เพื่อดูตัวอย่างสเปก Playwright ฉบับเต็มที่มีคอมเมนต์ <code>//</code> ภาษาไทยกำกับอย่างละเอียดทุกบรรทัด
                </p>
              )}
            </div>
          )}

          {/* Detailed Technical Specifications */}
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
              คุณสามารถกดปุ่ม <strong>"เปิดโค้ดใน Workspace"</strong> เพื่อนำโค้ดพร้อมคำอธิบายภาษาไทยไปเปิดใน Code Editor ของระบบ จากนั้นสามารถกดปุ่มรันเพื่อทดสอบจริงได้ทันที
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
