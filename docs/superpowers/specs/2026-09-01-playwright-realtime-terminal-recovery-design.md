# Playwright realtime terminal recovery design

## Problem

The Playwright workspace can appear unlocked after the 30-minute execute session has expired. A Run request then receives `403 EXECUTION_REQUIRED`, but the UI remains unlocked and gives no useful recovery action. Separately, the log cursor mixes “next sequence” and “last consumed sequence” semantics, causing the first line of a later batch to be skipped. Successful runs also begin with a generic system message that does not identify the selected project, tests, browsers, or mode.

## Approved behavior

- A `403` response with code `EXECUTION_REQUIRED` immediately sets the workspace to locked and shows the existing Execution Unlock panel with an expiry message.
- Other Run failures expose a safe user-facing error instead of failing silently.
- The log API cursor represents the next unread sequence. A request using the returned cursor must include the line at that exact sequence.
- Polling continues until every available terminal log has been reconciled after the job enters a terminal status.
- Each accepted job begins with a safe run summary containing project ID, selected test labels or count, browsers, mode, and source.
- The summary must not contain an absolute filesystem path, environment value, token, password, raw command, or working directory.
- Existing one-second browser polling and 250 ms Agent batching remain. WebSockets are out of scope.

## Data flow

1. The browser submits a job.
2. On `201`, the browser records the accepted job and a local submission line.
3. On `403 EXECUTION_REQUIRED`, the browser clears its unlocked state and displays the unlock panel.
4. The Agent claims the job, publishes a safe run summary, then streams redacted stdout/stderr batches.
5. The browser requests logs with `cursor=<next unread sequence>`, appends unique lines, and stores the returned next cursor.
6. After a terminal status is observed, the browser performs bounded reconciliation until no more lines remain, then stops polling.

## Error handling

- Authorization recovery is explicit and does not reload the whole page.
- Network and server errors show safe text without provider payloads or secrets.
- Reconciliation is bounded to prevent request loops.
- Duplicate retries remain idempotent through sequence-based de-duplication.

## Verification seams

- Browser job API route for execute-session enforcement.
- Playwright log store pagination contract across multiple batches.
- `usePlaywrightRunner` behavior for 403 recovery and terminal reconciliation.
- Local Agent callback output for safe run summary ordering and redaction.
- Browser E2E flow from unlock through Run, realtime output, and completion.

