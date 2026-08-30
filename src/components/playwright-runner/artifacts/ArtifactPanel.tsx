"use client";

import React from "react";
import type { TestArtifact } from "@/lib/playwright-runner/types";

interface ArtifactPanelProps {
  artifacts: TestArtifact[];
}

export function ArtifactPanel({ artifacts }: ArtifactPanelProps) {
  if (!artifacts || artifacts.length === 0) return null;

  const getTypeIcon = (type: TestArtifact["type"]) => {
    switch (type) {
      case "trace":
        return "🔍";
      case "screenshot":
        return "📸";
      case "video":
        return "🎥";
      case "report":
        return "📊";
      default:
        return "📁";
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📦</span>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
            Execution Artifacts ({artifacts.length})
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Generated during run
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {artifacts.map((art) => (
          <div
            key={art.id}
            className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 truncate">
              <span className="text-base">{getTypeIcon(art.type)}</span>
              <div className="truncate">
                <p className="font-mono font-medium text-slate-200 truncate">
                  {art.filename}
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  {formatSize(art.size)}
                  {art.browser && ` • ${art.browser}`}
                </p>
              </div>
            </div>

            {art.downloadUrl ? (
              <a
                href={art.downloadUrl}
                download={art.filename}
                className="shrink-0 px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-[11px] font-mono transition-colors"
              >
                Download
              </a>
            ) : (
              <span className="shrink-0 text-[10px] font-mono text-slate-400">
                Ready
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ArtifactPanel;
