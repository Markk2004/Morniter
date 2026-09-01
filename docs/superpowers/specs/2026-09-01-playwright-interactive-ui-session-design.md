# Playwright interactive UI session design

## Purpose

Add a Local Agent mode that opens Playwright UI on the Agent's Windows desktop, keeps it open for repeated manual Run and Replay actions, and prevents another Morniter test job from using the same Agent until the interactive session closes.

## Confirmed behavior

- Add `Interactive UI` beside `Headless` and `Headed`.
- Launch the installed Playwright UI with only tests selected in Test Explorer.
- Allow exactly one browser project per interactive session; default to Chromium.
- Keep the Playwright UI process open until the operator closes it, presses `Stop UI` in Morniter, or the 30-minute session timeout expires.
- Treat the Agent as busy for the full session.
- End with `session_closed`, not Passed, Failed, or Cancelled.
- Record a close reason: `user_closed`, `operator_stopped`, `timeout`, or `process_error`.
- Show detailed test steps, locator inspection, screenshots, and replay controls in Playwright UI. Morniter Terminal shows only safe session lifecycle events.
- Playwright UI opens only on the machine running Local Agent. Morniter does not proxy the UI or expose its local URL.

## Command boundary

The Agent constructs the command from allowlisted catalog data:

```text
npx playwright test <selected relative spec paths> --config <allowlisted config> --project=<one browser> --ui --ui-host=127.0.0.1 --ui-port=0
```

Absolute paths, cwd, command arguments, loopback URL, environment values, and secrets must not be returned to the browser API or Terminal. The existing path-containment and project allowlist remain authoritative.

## Lifecycle

1. The browser submits a job with `mode: "interactive"`, one browser, and selected project-test IDs.
2. The API rejects workspace draft source, zero/multiple browsers, unavailable headed capability, or an occupied Agent.
3. The Agent claims the job, emits a safe session summary, and spawns Playwright UI.
4. Heartbeats keep the job and Agent lease active while the UI process lives.
5. Morniter changes the action to `Stop UI` and shows elapsed time plus the 30-minute limit.
6. Closing the UI process, requesting Stop, reaching timeout, or process failure completes the job as `session_closed` with a close reason.
7. Completion releases the active Agent lease and allows the next queued job.

## Security and concurrency

- Bind Playwright UI to `127.0.0.1` and an ephemeral port.
- Do not transmit or persist the UI URL.
- Interactive mode is available only for catalog tests owned by a configured Local Agent project.
- Keep execute-session and same-origin checks for start and stop actions.
- One Agent may own only one active normal or interactive job.
- Stop must terminate the Playwright UI process tree and release the lease idempotently.
- Agent restart or heartbeat loss must allow stale-job recovery without leaving the queue permanently locked.

## UI

- Add a third mode control labelled `Interactive UI`.
- Selecting it forces one browser; Chromium is retained or selected by default.
- Disable Code Space and Recipe Draft execution in this mode.
- Run action reads `Open Interactive UI`; active action reads `Stop UI`.
- Terminal lifecycle lines identify project, selected test count/titles, browser, start time, remaining limit, and close reason.
- Explain that replay controls appear on the Local Agent computer, not in the Morniter web page.

## Verification

- Schema rejects invalid source/browser combinations.
- Command preparation includes UI flags and only selected contained spec paths.
- Unit tests verify loopback binding and absence of paths, URL, command, and secrets from published logs.
- Process tests cover manual close, Stop, timeout, spawn error, and idempotent cleanup.
- Store tests cover active lease retention and release for `session_closed`.
- Component tests cover mode switching, one-browser enforcement, labels, and locked state.
- E2E stubs cover the complete browser flow.
- Final acceptance uses one existing read-only ProjectSTS spec and verifies replay from the visible Playwright UI.

## Out of scope

- Streaming individual replay results back to Morniter.
- Remote access to Playwright UI.
- Multiple browsers in one interactive session.
- Opening every test in the project.
- Keeping the session open beyond 30 minutes.

