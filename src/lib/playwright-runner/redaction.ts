/**
 * ⚠️ SUPERSEDED — DO NOT USE. The real job-store.ts already calls
 * `redactText` from "@/lib/monitor/redact" inside appendPlaywrightLogBatch
 * — redaction is already wired into the real system via that existing
 * module, not this one. This file duplicates functionality that's
 * already solved and already integrated. Do not add this file to the
 * real repo; if @/lib/monitor/redact needs strengthening (e.g. it
 * doesn't yet catch a pattern this file catches), port the specific
 * missing rule INTO @/lib/monitor/redact instead of introducing a
 * second, parallel redaction path that some call sites use and others
 * don't.
 *
 * Original content kept below for reference only.
 */

/**
 * Redaction for Playwright job log lines (stdout/stderr).
 *
 * CLAUDE.md hard constraints require every provider/upstream message
 * reaching the browser to be redacted ("ทุก provider message ต้องผ่าน
 * redaction") and that error text sent to the browser never include a
 * token, header, or raw response ("ข้อความ error ที่ส่ง browser
 * ต้องไม่รวม token, header หรือ raw response"). Playwright job output is
 * exactly this kind of upstream message: stack traces, error dumps, and
 * (for "workspace" ad-hoc code jobs especially) arbitrary console output
 * the test author wrote can all leak a secret that happened to be in
 * process.env or a request the test made.
 *
 * This mirrors the existing "Redaction Engine" described in
 * ARCHITECTURE.md (multi-pass regex, strips Bearer headers, database
 * URLs, secret JSON keys) rather than inventing a different approach —
 * same technique, applied to a new source (agent-spawned process output
 * instead of provider API responses).
 */

interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const RULES: RedactionRule[] = [
  // Authorization: Bearer <token>  /  Authorization: Basic <b64>
  {
    name: "auth-header",
    pattern: /\b(authorization\s*:\s*)(bearer|basic)\s+\S+/gi,
    replacement: "$1$2 [REDACTED]",
  },
  // Generic "Bearer <token>" outside an explicit header line too
  {
    name: "bearer-token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g,
    replacement: "Bearer [REDACTED]",
  },
  // Connection strings with embedded credentials: postgres://, postgresql://,
  // mysql://, mongodb://, mongodb+srv://, redis://, rediss://
  {
    name: "connection-string",
    pattern:
      /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?):\/\/[^\s@/]+:[^\s@/]+@[^\s"'<>]+/gi,
    replacement: "$1://[REDACTED]",
  },
  // JSON / object-literal-style secret fields:
  // "password": "...", 'token': "...", apiKey: "...", etc.
  {
    name: "json-secret-field",
    pattern:
      /(["']?)((?:api[-_]?key|secret|token|password|passwd|auth|credential)[a-zA-Z0-9_]*)\1(\s*[:=]\s*)(["'])(.*?)\4/gi,
    replacement: "$1$2$1$3$4[REDACTED]$4",
  },
  // bcrypt hashes: $2a$/$2b$/$2y$<cost>$<53 chars>
  {
    name: "bcrypt-hash",
    pattern: /\$2[aby]\$\d{2}\$[A-Za-z0-9./]{53}/g,
    replacement: "[REDACTED_BCRYPT_HASH]",
  },
  // Upstash / similar REST tokens surfaced in URLs as a query/header value
  // is already caught by json-secret-field and bearer-token above; this
  // catches the bare "UPSTASH_REDIS_REST_TOKEN=..." env-dump shape.
  {
    name: "env-assignment-secret",
    pattern:
      /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|CREDENTIAL)[A-Z0-9_]*)\s*=\s*\S+/g,
    replacement: "$1=[REDACTED]",
  },
];

/**
 * Redact a single log line. Multi-pass: applies every rule in sequence so
 * overlapping matches (e.g. a bearer token embedded inside a JSON blob)
 * are still caught even if one rule's replacement text doesn't perfectly
 * remove what another rule was also targeting.
 */
export function redactLine(line: string): string {
  let result = line;
  for (const rule of RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

/**
 * Redact a multi-line chunk (as arrives from a spawned process's stdout
 * data event) line by line, preserving line breaks.
 */
export function redactChunk(chunk: string): string {
  return chunk
    .split("\n")
    .map((line) => redactLine(line))
    .join("\n");
}
