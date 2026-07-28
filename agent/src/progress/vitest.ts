import type { TestProgress } from "../types";
import type { ProgressParser } from "./types";

export class VitestProgressParser implements ProgressParser {
  private completed: number | null = null;
  private total: number | null = null;
  private percentage: number | null = null;
  private currentLabel?: string;

  consume(stream: "stdout" | "stderr", lines: string[]): TestProgress {
    for (const line of lines) {
      if (line.includes("✓ ") || line.includes("❯ ") || line.includes("× ")) {
        this.currentLabel = line.trim();
      }

      // Match: "Tests  258 passed (258)" or "Tests  2 failed | 258 passed (260)"
      const match = line.match(/Tests\s+.*?(\d+)\s+passed\s*\((?:.*?\|\s*)?(\d+)\)/i);
      if (match) {
        const passedNum = parseInt(match[1], 10);
        const totalNum = parseInt(match[2], 10);
        this.total = totalNum;
        this.completed = Math.min(passedNum, totalNum);
        this.percentage = totalNum > 0 ? Math.min(100, Math.round((this.completed / totalNum) * 100)) : null;
      }
    }

    return {
      framework: "vitest",
      completed: this.completed,
      total: this.total,
      percentage: this.percentage,
      currentLabel: this.currentLabel,
      updatedAt: new Date().toISOString(),
    };
  }
}
