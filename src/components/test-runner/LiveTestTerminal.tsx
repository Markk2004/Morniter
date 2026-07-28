"use client";

import React, { useRef, useEffect, useState } from "react";
import type { TestLogLine } from "@/lib/test-runner/types";

interface LiveTestTerminalProps {
  lines: TestLogLine[];
  hasOlder?: boolean;
  onLoadOlder?: () => void;
}

export function LiveTestTerminal({ lines, hasOlder = false, onLoadOlder }: LiveTestTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll on new log lines if at bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  const visibleLines = lines.slice(-1000);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold flex items-center gap-2">
          Execution Log Output ({lines.length} lines)
        </h3>

        <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
          {!autoScroll && (
            <span className="text-amber-400 font-medium">Auto-scroll paused</span>
          )}
          {hasOlder && onLoadOlder && (
            <button
              type="button"
              onClick={onLoadOlder}
              className="text-cyan-400 hover:underline cursor-pointer"
            >
              Load older logs
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Execution log terminal"
        className="h-96 w-full rounded-2xl bg-[#090d16] border border-slate-800/80 p-4 font-mono text-xs overflow-y-auto space-y-1 shadow-inner selection:bg-cyan-500/30"
      >
        {visibleLines.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">
            No log output captured yet.
          </div>
        ) : (
          visibleLines.map((line, idx) => {
            let streamColor = "text-slate-400";
            let msgColor = "text-slate-200";

            if (line.stream === "stderr") {
              streamColor = "text-rose-400 font-semibold";
              msgColor = "text-rose-300";
            } else if (line.stream === "system") {
              streamColor = "text-amber-400 font-semibold";
              msgColor = "text-amber-300 italic";
            }

            return (
              <div key={`${line.sequence}-${idx}`} data-testid="terminal-line" className="flex items-start space-x-3 hover:bg-slate-900/40 px-1.5 py-0.5 rounded">
                <span className="text-[10px] text-slate-600 select-none w-8 text-right font-mono">
                  {line.sequence}
                </span>
                <span className={`text-[10px] uppercase px-1.5 py-0.2 rounded border border-slate-800 bg-slate-950 font-mono ${streamColor}`}>
                  {line.stream}
                </span>
                <span className={`flex-1 whitespace-pre-wrap break-all ${msgColor}`}>
                  {line.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
