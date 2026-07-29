# Test failure summary design

## Goal

When a test job finishes with `failed`, `timed_out`, or `agent_lost`, the existing test runner should provide a deterministic summary of the likely cause, where to fix it, and what to try next. The feature must work without an AI provider or API key.

## Scope

- Analyze the persisted job error and execution log on the server when the job reaches a terminal failure state.
- Store the resulting analysis on the job so polling and history receive the same result.
- Display the analysis inline in the existing active-job progress panel and keep a short preview in execution history.
- Keep the raw execution terminal unchanged and available for verification.
- Do not send logs outside the application or add a new external dependency.

## Data shape

Add an optional `failureAnalysis` field to `TestJob`:

```ts
interface FailureAnalysis {
  category: "assertion" | "connection" | "dependency" | "environment" | "permission" | "syntax" | "timeout" | "agent" | "unknown";
  title: string;
  cause: string;
  fixLocation: string;
  recommendation: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}
```

The evidence entries are redacted log messages or the completion error, limited to three entries and trimmed for the UI. The field is omitted for passed and cancelled jobs.

## Analysis rules

Rules run in this order so a status-specific failure cannot be hidden by a generic log match:

1. `timed_out` or timeout wording maps to `timeout`.
2. `agent_lost` or an agent heartbeat/lease error maps to `agent`.
3. Missing module/package wording maps to `dependency`.
4. Environment-variable or configuration wording maps to `environment`.
5. Connection, Redis, refused, or network wording maps to `connection`.
6. Permission or access-denied wording maps to `permission`.
7. Assertion wording, expected/received output, or failed test matcher wording maps to `assertion`.
8. Syntax or parse-error wording maps to `syntax`.
9. Anything else maps to `unknown` and tells the user to inspect the first stderr/error lines.

Each rule returns plain-language Thai UI copy, a practical fix location, a next action, and a confidence level. Evidence is selected from the first matching lines, followed by the completion error when relevant.

## UI behavior

`RunProgress` keeps the existing failure error notice and adds a compact `Failure summary` section only for terminal failure states with `failureAnalysis`. It shows the category, confidence, cause, fix location, recommendation, and evidence. `JobHistory` shows the summary title and fix location as a short preview, so the result remains visible after refresh or when another job becomes active. The section uses existing slate/cyan/rose product UI tokens, a full border, readable labels, and an `aria-live="polite"` container so the completed analysis is announced without interrupting the terminal.

## Edge cases

- A failed process with no recognizable pattern gets an `unknown` analysis rather than an empty panel.
- A job with no logs still uses its completion error or exit code as evidence.
- Redaction already happens when logs are stored; the analyzer must not expose unredacted values.
- Truncated logs are analyzed from the retained lines and the UI continues to show the existing truncation notice.
- Existing jobs without `failureAnalysis` remain valid and render the current failure notice only.

## Verification

- Unit tests cover each rule, precedence, evidence limit, and unknown fallback.
- Store tests verify failure analysis is persisted during completion and omitted for passed jobs.
- Component tests verify the summary appears for failed jobs and does not appear for passed or running jobs.
- Run the full test suite, typecheck, lint, and production build.
