# Windows Local Agent Installer Design

**Date:** 2026-09-08  
**Status:** Approved design, awaiting implementation planning  
**Target:** Windows 10 and Windows 11 team workstations

## Goal

Provide a finished Windows installer for the Morniter Local Agent so a team
member can install, configure, start, stop, and uninstall the Agent without
running `npm run test-agent` or editing JSON by hand.

The installed desktop Agent and the Morniter PWA remain separate products:

- The PWA is the browser-based control panel installed from Chrome or Edge.
- The Windows Agent owns local project access and launches test processes.
- Installing the PWA does not install the Agent, Node.js project dependencies,
  or Playwright browsers.

## Chosen approach

Build a small Electron tray application and package it as a per-user Windows
NSIS installer. Electron supplies the tray integration, settings window, secure
credential storage, bundled runtime, single-instance behavior, and uninstall
entry. The existing TypeScript Agent remains the execution engine and is
started as a managed child process by the desktop shell.

This approach favors a predictable team installation over a PowerShell-only
bootstrap script or an invisible Windows service. `npm run test-agent` remains
available for repository development and troubleshooting, but is not part of
the normal user workflow.

## Package layout

Add a focused `desktop-agent/` package containing:

- Electron main process and preload bridge;
- tray menu and settings window;
- first-run setup wizard;
- Agent process supervisor;
- configuration validation and migration;
- installer and uninstaller configuration;
- desktop-specific tests and packaging scripts.

Reuse the existing Agent build from `agent/dist/`. Do not fork the Agent
protocol, queue, catalog, executor, redaction, or allowlist logic inside the
desktop package.

Reuse `public/icons/icon-512.png` as the source artwork. Generate Windows `.ico`
and tray-size variants during the packaging build so the installed Agent, Start
Menu entry, uninstaller, and PWA use the same cat branding.

## Installation flow

`Morniter-Agent-Setup.exe` performs a per-user installation that does not
require administrator access:

1. Install application files under the user's local application data folder.
2. Register Morniter Agent in Windows Installed Apps with an uninstaller.
3. Create a Start Menu shortcut.
4. Enable launch at user sign-in by default.
5. Start the tray application and open the first-run setup wizard.

The installer bundles the desktop runtime and compiled Morniter Agent. It does
not modify ProjectSTS source, install arbitrary project packages, change system
PATH, or write secrets into the repository.

## First-run setup

The wizard collects only machine-local configuration:

- Morniter server URL;
- Agent ID;
- short-lived pairing code created by an authenticated Morniter administrator;
- project display name and safe project ID;
- `workspaceRoot`;
- `testRoot`;
- optional generated-test root already allowed by the Agent contract.

Before saving, the wizard validates:

- server URL uses HTTPS, except explicit localhost development URLs;
- Agent ID and project ID match existing schemas;
- selected roots exist and remain contained within the workspace;
- the project has a package manifest;
- the configured test root is valid;
- the project can resolve its Playwright package and selected browser runtime;
- the server accepts the pairing code and returns a device-specific credential
  without exposing either value in diagnostics.

The wizard presents actionable failures and does not partially enable startup
when configuration is invalid.

## Settings and tray behavior

The tray menu contains:

- Status: Online, Connecting, Offline, Running, or Error;
- Open Settings;
- Open Morniter;
- Start Agent;
- Stop Agent;
- Restart Agent;
- Test Connection;
- Scan Tests;
- Open Safe Logs;
- Start with Windows toggle;
- Quit.

Settings uses the same controls plus project-root selection and validation
results. It does not expose a terminal or accept raw shell commands. The desktop
shell translates approved actions into fixed Agent operations.

Closing the Settings window keeps the Agent running in the tray. Quit stops the
managed Agent process after a bounded graceful shutdown. Windows sign-out and
application updates use the same shutdown path.

## Agent process supervision

The desktop shell starts exactly one Agent process and records its process ID
only in application-owned data. It prevents duplicate desktop instances and
relies on the Agent's existing single-instance protection as a second boundary.

The supervisor:

- passes validated configuration through a private application-owned file and
  environment references;
- never invokes a shell;
- captures bounded safe logs;
- reports startup, disconnect, crash, and restart state in the tray;
- uses bounded exponential restart after unexpected crashes;
- stops automatic restart after repeated failures and asks the user to inspect
  the reported configuration error;
- never restarts an Agent intentionally stopped by the user.

The existing `npm run test-agent` command remains unchanged. Documentation must
warn developers not to run it at the same time as the installed Agent for the
same Agent ID.

## Device pairing and credential storage

The shared `TEST_RUNNER_AGENT_TOKEN` remains a server-side Vercel environment
secret. It is never fetched from Vercel, displayed in Morniter, or copied into
the desktop setup wizard.

An authenticated Morniter administrator creates a single-use pairing code for
one Agent. The code expires after 10 minutes and is stored server-side only as a
hash. Setup sends the code, requested Agent ID, and a generated device public
identifier to the Morniter enrollment endpoint. On success, the server consumes
the code and issues a revocable device-specific Agent credential.

Each installed Agent therefore has its own credential. Revoking one machine
does not disconnect other Agents or require rotating the Vercel secret. Pairing
attempts are rate-limited and recorded without the code or credential value.

Non-secret configuration is stored under the desktop application's per-user
data directory. The device credential is encrypted using Electron
`safeStorage`, which uses Windows-provided credential protection when
available.

Rules:

- never write the pairing code or device credential to repository files, logs, Redis payloads, renderer
  state snapshots, or crash reports;
- never send absolute workspace paths to Morniter frontend APIs;
- keep existing project allowlist and path-containment checks authoritative;
- redact server errors before displaying or persisting them;
- use an explicit versioned configuration schema and atomic file replacement;
- retain a last-known-good non-secret configuration for migration recovery.

If secure storage is unavailable, setup must stop and explain the requirement;
it must not fall back to plaintext credential storage. Developer mode may still
use `TEST_RUNNER_AGENT_TOKEN` supplied by the developer's local environment,
but the production installer does not read or manage that variable.

## Playwright dependency handling

The installer bundles the Morniter desktop runtime, not every monitored
project's dependencies. This avoids changing team repositories and prevents
version conflicts between the installed Agent and each project's Playwright
configuration.

Setup checks the selected project's local installation and reports exact
missing requirements. A separate explicit `Install Chromium for this project`
action may run the fixed project-local Playwright browser-install command after
user confirmation. It may not accept custom command text, add packages, or run
inside an unvalidated workspace.

Firefox and WebKit remain selectable only when the project and Agent catalog
report them available.

## PWA guidance

The Settings window includes an `Open Morniter` action. Documentation explains
how to install the production web app from Chrome or Edge using `Install
Morniter` or `Install this site as an app`.

The installer must not attempt to silently install a browser PWA. Browser-owned
installation and permission prompts remain user-controlled. The desktop Agent
continues running independently whether Morniter is opened as a normal tab or
as an installed PWA.

## Uninstall flow

The Windows uninstaller:

1. Stops the Agent and waits for bounded graceful process termination.
2. Removes launch-at-sign-in registration and shortcuts.
3. Removes installed application files and the Installed Apps entry.
4. Offers a clear choice to retain settings/logs for reinstall or remove all
   Morniter Agent application data.

Uninstall never removes ProjectSTS, project dependencies, Playwright tests,
generated tests, Morniter PWA data, browser profiles, or repository files.

If the user retains settings, encrypted credentials remain protected for the
same Windows account. A full-data removal deletes the Agent configuration,
encrypted token, local logs, and application-owned process metadata.

## Updates

The first release uses explicit installer upgrades rather than unattended
automatic updates. Installing a newer signed package upgrades application
files while preserving valid configuration. Schema migrations run before the
Agent starts and roll back to the previous configuration on failure.

Code signing and a trusted distribution channel are release requirements for
team-wide production use. Unsigned development builds must be labelled clearly
and distributed only for internal testing.

## Error handling and logs

The UI presents short actions instead of raw stack traces:

- invalid server URL;
- token rejected;
- project root unavailable;
- test root not contained;
- Playwright package or browser missing;
- duplicate Agent ID/process;
- server unreachable;
- Agent crashed repeatedly.

Safe logs are bounded by size and age. They may contain timestamps, status,
project ID, relative test path, and sanitized errors. They must not contain
tokens, passwords, environment values, absolute paths, or source contents.

## Testing

Automated verification covers:

- settings schema validation and migration;
- credential encryption and no-plaintext persistence;
- workspace/test-root containment;
- child-process start, stop, crash, retry, and single-instance behavior;
- tray command state transitions;
- preload IPC allowlist and renderer isolation;
- log redaction and bounds;
- installer upgrade and uninstall scripts in a disposable Windows environment;
- existing Agent unit/integration tests without protocol regression.

Manual acceptance on Windows 10 and Windows 11 covers:

- clean install without administrator access;
- first-run configuration against the deployed Morniter server;
- Agent Online and catalog publication;
- one headless test and one visible-browser test;
- restart after Windows sign-in;
- settings retained across upgrade;
- uninstall with retained data;
- reinstall and recovery;
- uninstall with full application-data removal.

## Acceptance criteria

- A team member installs `Morniter-Agent-Setup.exe` without cloning Morniter or
  running npm commands.
- First-run setup connects one allowlisted local project and publishes its test
  catalog without exposing absolute paths or credentials.
- Start, stop, restart, connection test, and test scan work from the tray or
  Settings window.
- The Agent launches automatically at Windows sign-in unless disabled.
- Headless, visible-browser, and interactive Playwright modes continue to run
  on the Agent machine through the existing Morniter APIs.
- `npm run test-agent` remains available as an explicitly documented developer
  fallback.
- Uninstall stops the Agent and removes application integration without
  touching monitored repositories or browser PWA data.

## Non-goals

- Remote shell or arbitrary command execution from the Morniter website;
- automatic modification of ProjectSTS source or dependencies;
- bundling every project's Node modules;
- silently installing Chrome/Edge PWA applications;
- replacing Redis, the deployed Next.js backend, or existing Agent APIs;
- macOS or Linux installers in this release.
