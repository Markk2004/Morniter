"use client";

import { useEffect, useRef } from "react";
import type { TestLogLine } from "@/lib/test-runner/types";

interface JobTerminalProps {
  lines: TestLogLine[];
  isRunning?: boolean;
  truncated?: boolean;
}

export default function JobTerminal({ lines, isRunning, truncated }: JobTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If user is near bottom (within 40px), re-enable auto-scroll
    const isAtBottom = scrollHeight - (scrollTop + clientHeight) <= 40;
    userScrolledRef.current = !isAtBottom;
  };

  useEffect(() => {
    if (!userScrolledRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 h-80 overflow-y-auto space-y-1.5 shadow-inner"
    >
      {lines.length === 0 ? (
        <div className="h-full flex items-center justify-center text-slate-600 italic">
          {isRunning ? "Waiting for test execution output..." : "No test execution logs to display."}
        </div>
      ) : (
        lines.map((line, idx) => (
          <div key={line.sequence ?? idx} className="flex items-start gap-2 leading-relaxed">
            <span className="text-slate-600 shrink-0 text-[10px]">
              {new Date(line.timestamp).toLocaleTimeString()}
            </span>
            <span
              className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase shrink-0 ${
                line.stream === "stderr"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : line.stream === "system"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
              }`}
            >
              {line.stream}
            </span>
            <span className="whitespace-pre-wrap break-all flex-1">{line.message}</span>
          </div>
        ))
      )}

      {truncated && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-xs italic text-center">
          ⚠️ Log output truncated (maximum 5,000 lines limit reached).
        </div>
      )}
    </div>
  );
}
