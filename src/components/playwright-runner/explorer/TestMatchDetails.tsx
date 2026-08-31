"use client";

import React from "react";
import type { ProjectCoverageTest } from "@/lib/playwright-runner/types";
import {
  getMatchReasonLabels,
  getRunnerLabel,
} from "./test-explorer-presentation";

export interface TestMatchDetailsProps {
  panelId: string;
  functionId?: string;
  functionName?: string;
  test: ProjectCoverageTest;
}

export function TestMatchDetails({
  panelId,
  functionId,
  functionName,
  test,
}: TestMatchDetailsProps) {
  const matchReasons = getMatchReasonLabels(test.matchedBy);
  const functionLabel =
    functionId && functionName
      ? `${functionId} · ${functionName}`
      : functionName || functionId || "-";

  return (
    <div
      id={panelId}
      className="mt-1 rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 text-xs text-slate-300 space-y-2"
    >
      <div className="text-[11px] font-semibold text-slate-400 font-mono border-b border-slate-800 pb-1 flex items-center justify-between">
        <span>ข้อมูลการจับคู่ฟังก์ชัน</span>
        <span className="text-[10px] text-slate-400">ID: {test.id}</span>
      </div>

      <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-[11px]">
        <div>
          <dt className="text-slate-400 text-[10px]">ฟังก์ชัน (Sheet Function)</dt>
          <dd className="font-medium text-slate-200 truncate">{functionLabel}</dd>
        </div>

        <div>
          <dt className="text-slate-400 text-[10px]">ไฟล์ทดสอบ (Relative Path)</dt>
          <dd className="font-mono text-slate-300 text-[10px] truncate">
            {test.relativePath}
          </dd>
        </div>

        <div>
          <dt className="text-slate-400 text-[10px]">ตัวรัน (Runner)</dt>
          <dd className="text-slate-200">{getRunnerLabel(test.runner)}</dd>
        </div>

        <div>
          <dt className="text-slate-400 text-[10px]">ระดับความมั่นใจ (Confidence)</dt>
          <dd className="text-slate-200">
            {test.confidence
              ? test.confidence.charAt(0).toUpperCase() + test.confidence.slice(1)
              : "-"}
          </dd>
        </div>

        <div>
          <dt className="text-slate-400 text-[10px]">สถานะการรัน (Executable)</dt>
          <dd className={test.executable !== false ? "text-emerald-400 font-medium" : "text-slate-400"}>
            {test.executable !== false ? "พร้อมรัน" : "ไม่สามารถรันได้"}
          </dd>
        </div>

        <div>
          <dt className="text-slate-400 text-[10px]">โหมดความเสี่ยง (Risk)</dt>
          <dd className={test.risk === "mutating" ? "text-amber-300 font-medium" : "text-slate-300"}>
            {test.risk === "mutating" ? "Mutating" : "Read-only"}
          </dd>
        </div>
      </dl>

      <div className="border-t border-slate-800/80 pt-1.5">
        <div className="text-slate-400 text-[10px] mb-1">เหตุผลการจับคู่ (Match Reasons):</div>
        <ul className="flex flex-wrap gap-1">
          {matchReasons.map((reason, idx) => (
            <li
              key={idx}
              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700/60"
            >
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default TestMatchDetails;
