import type { TestProgress } from "../types";

export interface ProgressParser {
  consume(stream: "stdout" | "stderr", lines: string[]): TestProgress;
}
