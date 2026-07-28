import type { TestProgress } from "../types";
import type { ProgressParser } from "./types";

export class CypressProgressParser implements ProgressParser {
  private completed: number | null = null;
  private total: number | null = null;
  private percentage: number | null = null;
  private currentLabel?: string;

  consume(stream: "stdout" | "stderr", lines: string[]): TestProgress {
    for (const line of lines) {
      if (line.includes("Running: ") || line.includes("Spec: ")) {
        this.currentLabel = line.trim();
      }

      // Match: "2 of 2 passed (100%)" or "Spec 1 of 5"
      const matchSpec = line.match(/(?:Spec|Running)\s+(\d+)\s+of\s+(\d+)/i);
      if (matchSpec) {
        this.completed = parseInt(matchSpec[1], 10);
        this.total = parseInt(matchSpec[2], 10);
        this.percentage = this.total > 0 ? Math.min(100, Math.round((this.completed / this.total) * 100)) : null;
      }

      const matchPercent = line.match(/\((\d+)%\)/);
      if (matchPercent && !this.percentage) {
        this.percentage = Math.min(100, parseInt(matchPercent[1], 10));
      }
    }

    return {
      framework: "cypress",
      completed: this.completed,
      total: this.total,
      percentage: this.percentage,
      currentLabel: this.currentLabel,
      updatedAt: new Date().toISOString(),
    };
  }
}
