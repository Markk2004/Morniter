import type { MonitorDiagnostic } from "./types";
import { redactText } from "./redact";

const DEFAULT_MAX_LINES = 20;
const DEFAULT_MAX_BYTES = 4096;

export function limitDiagnostics(
  input: MonitorDiagnostic[],
  options: { maxLines?: number; maxBytes?: number } = {},
): { lines: MonitorDiagnostic[]; truncated: boolean } {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const output: MonitorDiagnostic[] = [];
  let usedBytes = 0;
  let truncated = input.length > maxLines;

  for (const line of input.slice(0, maxLines)) {
    const redacted = redactText(line.message);
    const availableBytes = maxBytes - usedBytes;
    if (availableBytes <= 0) {
      truncated = true;
      break;
    }

    let message = redacted;
    if (Buffer.byteLength(message, "utf8") > availableBytes) {
      message = Buffer.from(message, "utf8").subarray(0, availableBytes).toString("utf8");
      truncated = true;
    }

    output.push({ ...line, message });
    usedBytes += Buffer.byteLength(message, "utf8");
  }

  return { lines: output, truncated };
}
