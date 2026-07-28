import type { TestProgress } from "../types";
import type { ProgressParser } from "./types";

export class JestProgressParser implements ProgressParser {
  private completed: number | null = null;
  private total: number | null = null;
  private percentage: number | null = null;
  private currentLabel?: string;

  consume(stream: "stdout" | "stderr", lines: string[]): TestProgress {
    for (const line of lines) {
      if (line.includes("PASS ") || line.includes("FAIL ")) {
        this.currentLabel = line.trim();
      }

      // Match: "Tests: 2 failed, 258 passed, 260 total" or "Tests: 260 passed, 260 total"
      const match = line.match(/Tests:\s+.*?\b(\d+)\s+total/i);
      if (match) {
        const totalNum = parseInt(match[1], 10);
        let passedNum = 0;
        let failedNum = 0;

        const passedMatch = line.match(/(\d+)\s+passed/i);
        if (passedMatch) passedNum = parseInt(passedMatch[1], 10);

        const failedMatch = line.match(/(\d+)\s+failed/i);
        if (failedMatch) failedNum = parseInt(failedMatch[1], 10);

        const doneNum = passedNum + failedNum;
        this.total = totalNum;
        this.completed = Math.min(doneNum, totalNum);
        this.percentage = totalNum > 0 ? Math.min(100, Math.round((this.completed / totalNum) * 100)) : null;
      }
    }

    return {
      framework: "jest",
      completed: this.completed,
      total: this.total,
      percentage: this.percentage,
      currentLabel: this.currentLabel,
      updatedAt: new Date().toISOString(),
    };
  }
}
