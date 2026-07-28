import type { TestProgress } from "../types";
import type { ProgressParser } from "./types";
import { JestProgressParser } from "./jest";
import { VitestProgressParser } from "./vitest";
import { CypressProgressParser } from "./cypress";

class FallbackProgressParser implements ProgressParser {
  private currentLabel?: string;

  consume(stream: "stdout" | "stderr", lines: string[]): TestProgress {
    if (lines.length > 0) {
      this.currentLabel = lines[lines.length - 1].slice(0, 300);
    }

    return {
      framework: "unknown",
      completed: null,
      total: null,
      percentage: null,
      currentLabel: this.currentLabel,
      updatedAt: new Date().toISOString(),
    };
  }
}

export function createProgressParser(commandPreview: string): ProgressParser {
  const lower = commandPreview.toLowerCase();
  if (lower.includes("jest")) {
    return new JestProgressParser();
  }
  if (lower.includes("vitest")) {
    return new VitestProgressParser();
  }
  if (lower.includes("cypress")) {
    return new CypressProgressParser();
  }
  return new FallbackProgressParser();
}

export type { ProgressParser };
