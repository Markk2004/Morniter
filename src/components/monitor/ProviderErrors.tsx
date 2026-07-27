"use client";

import React from "react";
import type { ProviderSnapshot } from "@/lib/monitor/types";

interface ProviderErrorsProps {
  providers: ProviderSnapshot[];
}

export default function ProviderErrors({ providers }: ProviderErrorsProps) {
  const erroredProviders = providers.filter((p) => p.error !== undefined);

  if (erroredProviders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {erroredProviders.map((p) => (
        <div
          key={p.source}
          className="flex items-start justify-between p-3 rounded-lg border border-amber-800/80 bg-amber-950/40 text-amber-200 text-xs font-mono"
        >
          <div className="flex items-center space-x-2">
            <span className="font-bold uppercase px-1.5 py-0.5 rounded bg-amber-900/80 border border-amber-700 text-[10px]">
              {p.source}
            </span>
            <span>{p.error?.message}</span>
          </div>
          <span className="text-[10px] text-amber-400/80 uppercase tracking-wider">
            [{p.error?.code}]
          </span>
        </div>
      ))}
    </div>
  );
}
