# Windows Local Agent Installer Implementation Plan

Current status: Electron package, secure credential storage, device pairing, project validation, guided setup, bundled Agent runtime, navigation/IPC hardening, tray lifecycle, capped supervisor restart, NSIS configuration with uninstall data choice, and local installer artifact are implemented. Remaining work is fixed Chromium installer flow, automated Electron coverage, Windows 10/11 acceptance, signing, and release distribution.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a per-user Windows installer, tray application, guided settings wizard, and uninstaller for the existing Morniter Local Agent.

**Architecture:** A focused Electron package embeds the compiled Agent and manages it with Electron `utilityProcess`. The renderer is sandboxed behind a narrow preload API; configuration is schema-validated and written atomically, while the per-device credential obtained from the pairing API is encrypted with Electron `safeStorage`. NSIS packages a per-user installer that registers startup and a standard Windows uninstaller.

**Tech Stack:** Electron, electron-vite, React 19, TypeScript, Zod 4, electron-builder/NSIS, Vitest, Playwright Electron tests, existing Morniter Agent.

## Global Constraints

- Implement this plan only after `2026-09-08-agent-device-pairing.md` passes its release gate.
- Target Windows 10 and Windows 11 x64 with a per-user non-admin installation.
- Bundle the Agent runtime, but do not install or modify monitored-project npm dependencies automatically.
- Never expose raw command execution, shell input, tokens, passwords, absolute paths, or source contents to the remote frontend.
- Encrypt the device credential with Electron `safeStorage`; fail closed when secure storage is unavailable.
- The installer may offer a fixed project-local Chromium installation only after explicit user confirmation.
- Reuse `public/icons/icon-512.png`; generated `.ico` and tray assets are build outputs.
- Preserve `npm run test-agent` for developer mode and prevent duplicate Agent IDs.
- Do not run Git commands. The operator handles add, commit, push, tags, and release upload manually.

---

### Task 1: Scaffold the isolated desktop package

**Files:**
- Create: `desktop-agent/package.json`
- Create: `desktop-agent/tsconfig.json`
- Create: `desktop-agent/electron.vite.config.ts`
- Create: `desktop-agent/src/main/index.ts`
- Create: `desktop-agent/src/preload/index.ts`
- Create: `desktop-agent/src/renderer/main.tsx`
- Create: `desktop-agent/src/renderer/App.tsx`
- Modify: `package.json`
- Test: `desktop-agent/tests/smoke.test.ts`

**Interfaces:**
- Produces: buildable Electron main/preload/renderer entry points and root scripts `desktop-agent:dev`, `desktop-agent:test`, `desktop-agent:build`, `desktop-agent:package`.
- Consumes: React 19 and the existing compiled `agent/dist` output.

- [ ] **Step 1: Write a failing package smoke test**

```ts
expect(packageJson.main).toBe("out/main/index.js");
expect(packageJson.build.appId).toBe("com.softdeath.morniter.agent");
expect(packageJson.build.nsis.perMachine).toBe(false);
```

- [ ] **Step 2: Run the desktop test and confirm the package is absent**

Run: `npm --prefix desktop-agent test`  
Expected: FAIL because `desktop-agent/package.json` does not exist.

- [ ] **Step 3: Add the package and root scripts**

Use exact package scripts:

```json
{
  "dev": "electron-vite dev",
  "test": "vitest run",
  "build": "electron-vite build",
  "package": "npm run build && electron-builder --win nsis --x64"
}
```

Add root scripts that call npm with `--prefix desktop-agent` and make `desktop-agent:package` depend on `npm run agent:build`.

- [ ] **Step 4: Implement a sandboxed empty shell**

Create one `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, no remote module, no navigation outside packaged content, and a restrictive CSP.

- [ ] **Step 5: Install dependencies and verify clean build**

Run: `npm --prefix desktop-agent install`  
Run: `npm --prefix desktop-agent test`  
Run: `npm --prefix desktop-agent run build`  
Expected: smoke test and three-process Electron build pass.

### Task 2: Implement versioned settings and secure credential storage

**Files:**
- Create: `desktop-agent/src/shared/settings.ts`
- Create: `desktop-agent/src/main/settings-store.ts`
- Create: `desktop-agent/src/main/credential-store.ts`
- Test: `desktop-agent/tests/settings-store.test.ts`
- Test: `desktop-agent/tests/credential-store.test.ts`

**Interfaces:**
- Produces: `DesktopAgentSettingsSchema`, `readSettings()`, `writeSettingsAtomic(settings)`, `saveDeviceCredential(token)`, `readDeviceCredential()`, `clearDeviceCredential()`.
- Consumes: Electron `app.getPath("userData")` and `safeStorage`.

- [ ] **Step 1: Add failing validation, migration, atomic-write, and plaintext-leak tests**

Test HTTPS except localhost, contained relative `testRoot`, UUID `deviceId`, unique project IDs, migration from version 1, interrupted writes, and absence of the clear token in every persisted file.

- [ ] **Step 2: Run tests and confirm missing modules fail**

Run: `npm --prefix desktop-agent test -- settings-store.test.ts credential-store.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement the versioned settings schema**

```ts
export const DesktopAgentSettingsSchema = z.object({
  version: z.literal(1),
  serverUrl: z.string().url(),
  agentId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  deviceId: z.string().uuid(),
  startWithWindows: z.boolean().default(true),
  projects: z.array(LocalProjectSchema).min(1).max(20),
}).strict();
```

- [ ] **Step 4: Implement atomic settings and encrypted credential storage**

Write non-secret JSON to a temporary sibling, flush, and rename. Encrypt/decrypt only in the main process. Throw `SECURE_STORAGE_UNAVAILABLE` rather than writing plaintext.

- [ ] **Step 5: Run focused tests**

Run: `npm --prefix desktop-agent test -- settings-store.test.ts credential-store.test.ts`  
Expected: PASS.

### Task 3: Implement pairing and project validation services

**Files:**
- Create: `desktop-agent/src/main/pairing-client.ts`
- Create: `desktop-agent/src/main/project-validator.ts`
- Create: `desktop-agent/src/shared/setup-results.ts`
- Test: `desktop-agent/tests/pairing-client.test.ts`
- Test: `desktop-agent/tests/project-validator.test.ts`

**Interfaces:**
- Produces: `enrollDevice(input)`, `validateLocalProject(input)`, `detectTestRoots(workspaceRoot)`, typed safe setup results.
- Consumes: pairing API from the prerequisite plan and Task 2 stores.

- [ ] **Step 1: Add failing service tests**

Cover expired/invalid code, `Cache-Control: no-store`, token never included in thrown errors, HTTPS enforcement, missing package manifest, path escape, discovery of `e2e` and `tests/e2e`, Playwright package resolution, and browser availability.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm --prefix desktop-agent test -- pairing-client.test.ts project-validator.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement enrollment**

Send `{ pairingCode, agentId, deviceId }` to `/api/playwright-runner/agents/enroll`, save the returned token immediately through `credential-store`, discard the in-memory clear value, and return only public device metadata.

- [ ] **Step 4: Implement contained project inspection**

Resolve real paths, require `testRoot` and optional generated root to stay below `workspaceRoot`, read only known package/config files, and return labels rather than absolute paths to the renderer diagnostics.

- [ ] **Step 5: Run focused tests**

Run: `npm --prefix desktop-agent test -- pairing-client.test.ts project-validator.test.ts`  
Expected: PASS.

### Task 4: Supervise the existing Agent process

**Files:**
- Create: `desktop-agent/src/main/agent-supervisor.ts`
- Create: `desktop-agent/src/main/agent-worker.ts`
- Create: `desktop-agent/src/shared/agent-state.ts`
- Modify: `agent/src/config.ts`
- Test: `desktop-agent/tests/agent-supervisor.test.ts`
- Test: `tests/unit/test-agent/config.test.ts`

**Interfaces:**
- Produces: `AgentSupervisor.start()`, `.stop(reason)`, `.restart()`, `.state()`, state events `stopped|connecting|online|running|error`.
- Consumes: Task 2 config/credential and existing `agent/dist/index.js` behavior.

- [ ] **Step 1: Write failing lifecycle tests**

Test exactly one worker, idempotent start/stop, five-second graceful stop then tree termination, unexpected-crash backoff at 1/2/4/8/16 seconds, circuit break after five failures, no restart after operator stop, and token/path redaction.

- [ ] **Step 2: Run lifecycle tests and confirm failure**

Run: `npm --prefix desktop-agent test -- agent-supervisor.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Add an explicit Agent config input boundary**

Extend `agent/src/config.ts` to accept a desktop-provided config file path and credential environment reference without changing existing CLI developer behavior. The worker must never receive renderer-originated command text.

- [ ] **Step 4: Implement supervision with `utilityProcess.fork`**

Start only the fixed packaged worker entry, pass a minimal environment, capture bounded sanitized output, emit typed states, and enforce the restart policy.

- [ ] **Step 5: Run desktop and existing Agent regression tests**

Run: `npm --prefix desktop-agent test -- agent-supervisor.test.ts`  
Run: `npm test -- tests/unit/test-agent/config.test.ts tests/unit/test-agent/single-instance.test.ts tests/unit/test-agent/runner.test.ts`  
Run: `npm run agent:build`  
Expected: PASS.

### Task 5: Build the tray menu and safe preload API

**Files:**
- Create: `desktop-agent/src/main/tray.ts`
- Create: `desktop-agent/src/main/ipc.ts`
- Create: `desktop-agent/src/shared/preload-api.ts`
- Modify: `desktop-agent/src/preload/index.ts`
- Modify: `desktop-agent/src/main/index.ts`
- Test: `desktop-agent/tests/ipc.test.ts`
- Test: `desktop-agent/tests/tray.test.ts`

**Interfaces:**
- Produces: `window.morniterAgent` allowlist and tray actions Open Settings, Open Morniter, Start, Stop, Restart, Test Connection, Scan Tests, Safe Logs, Start with Windows, Quit.
- Consumes: Tasks 2–4.

- [ ] **Step 1: Add failing IPC and tray-state tests**

Assert no generic invoke/send API, no filesystem or shell bridge, disabled actions while transitioning/running, status text updates, external navigation allowlist permits only configured Morniter origin, and Quit waits for supervisor shutdown.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm --prefix desktop-agent test -- ipc.test.ts tray.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement the typed preload allowlist**

Expose named methods only: `getState`, `saveSettings`, `enroll`, `validateProject`, `startAgent`, `stopAgent`, `restartAgent`, `testConnection`, `scanTests`, `setStartWithWindows`, `openMorniter`, `readSafeLogs`, and `subscribeState`.

- [ ] **Step 4: Implement tray state and startup registration**

Use `app.setLoginItemSettings({ openAtLogin })`, update menu availability from supervisor state, keep Agent running when Settings closes, and stop it on explicit Quit or Windows shutdown.

- [ ] **Step 5: Run focused tests and Electron build**

Run: `npm --prefix desktop-agent test -- ipc.test.ts tray.test.ts`  
Run: `npm --prefix desktop-agent run build`  
Expected: PASS.

### Task 6: Implement the approved setup and settings UI

**Files:**
- Create: `desktop-agent/src/renderer/styles/tokens.css`
- Create: `desktop-agent/src/renderer/styles/app.css`
- Create: `desktop-agent/src/renderer/setup/SetupWizard.tsx`
- Create: `desktop-agent/src/renderer/setup/SystemCheckStep.tsx`
- Create: `desktop-agent/src/renderer/setup/PairingStep.tsx`
- Create: `desktop-agent/src/renderer/setup/ProjectStep.tsx`
- Create: `desktop-agent/src/renderer/setup/VerificationStep.tsx`
- Create: `desktop-agent/src/renderer/settings/SettingsScreen.tsx`
- Create: `desktop-agent/src/renderer/logs/SafeLogs.tsx`
- Modify: `desktop-agent/src/renderer/App.tsx`
- Test: `desktop-agent/tests/setup-wizard.test.tsx`
- Test: `desktop-agent/tests/settings-screen.test.tsx`

**Interfaces:**
- Produces: six-step first-run wizard matching the approved production mockup and a persistent Settings screen.
- Consumes: Task 5 preload API only.

- [ ] **Step 1: Write failing component tests**

Cover all six steps, Back/Continue, direct completed-step navigation, pairing expiry, validation errors, project browser dialog result, scan result, start-with-Windows toggle, loading/disabled/focus states, reduced motion, and 320px no-overflow behavior.

- [ ] **Step 2: Run component tests and confirm failure**

Run: `npm --prefix desktop-agent test -- setup-wizard.test.tsx settings-screen.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement the approved visual system**

Use a restrained near-black palette, existing cat icon, one green action/status accent, system UI font, 8–14px radii, solid surfaces, no gradients, no decorative glass, and visible keyboard focus. Keep body text at WCAG AA contrast.

- [ ] **Step 4: Implement the six steps and guidance panel**

Steps are Welcome, System Check, Secure Pairing, Project Setup, Verification, and Completed. Pairing guidance points to `Morniter → Settings → Agents → Pair new agent`. Completion explains PWA installation and warns against simultaneous `npm run test-agent` with the same Agent ID.

- [ ] **Step 5: Implement explicit error recovery**

Map typed failures to actions: edit URL, request new code, choose another folder, install Chromium with confirmation, retry connection, open safe logs, or reset setup. Never render raw stack traces.

- [ ] **Step 6: Run renderer tests, accessibility checks, and build**

Run: `npm --prefix desktop-agent test -- setup-wizard.test.tsx settings-screen.test.tsx`  
Run: `npm --prefix desktop-agent run build`  
Expected: PASS with no accessibility violations in tested states.

### Task 7: Add fixed Chromium installation with confirmation

**Files:**
- Create: `desktop-agent/src/main/playwright-installer.ts`
- Modify: `desktop-agent/src/main/ipc.ts`
- Modify: `desktop-agent/src/renderer/setup/SystemCheckStep.tsx`
- Test: `desktop-agent/tests/playwright-installer.test.ts`

**Interfaces:**
- Produces: `inspectPlaywrightRuntime(project)`, `installChromium(project, confirmationId)`.
- Consumes: validated project roots from Task 3 and safe process adapter conventions from `agent/src/process-adapter.ts`.

- [ ] **Step 1: Write failing safety tests**

Assert no installation without one-use confirmation, only the resolved project-local Playwright executable may run, arguments equal `install chromium`, `shell:false`, project containment holds, cancellation kills the process tree, and output is bounded/redacted.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm --prefix desktop-agent test -- playwright-installer.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement inspection and fixed installation**

Resolve the project's installed Playwright CLI without downloading packages or running `npm install`. If absent, report `PLAYWRIGHT_PACKAGE_MISSING`. If Chromium is absent, issue a one-use confirmation ID and run only the fixed browser-install operation after confirmation.

- [ ] **Step 4: Connect progress and cancellation to UI**

Show Downloading, Installing, Verifying, Ready, Failed, and Cancelled states. Do not allow Agent start until verification succeeds or the selected project declares another available browser.

- [ ] **Step 5: Run focused tests**

Run: `npm --prefix desktop-agent test -- playwright-installer.test.ts setup-wizard.test.tsx`  
Expected: PASS.

### Task 8: Generate branded assets and package NSIS install/uninstall

**Files:**
- Create: `desktop-agent/scripts/generate-windows-icons.mjs`
- Create: `desktop-agent/build/installer.nsh`
- Modify: `desktop-agent/package.json`
- Test: `desktop-agent/tests/package-config.test.ts`

**Interfaces:**
- Produces: `Morniter-Agent-Setup-<version>.exe`, standard uninstaller, `.ico`, 16/20/24/32px tray PNG assets.
- Consumes: `public/icons/icon-512.png` and Tasks 1–7 output.

- [ ] **Step 1: Add failing package-contract tests**

Assert per-user install, Start Menu shortcut, Installed Apps metadata, upgrade GUID stability, output filename, bundled `agent/dist`, generated assets, and uninstall data-choice hook.

- [ ] **Step 2: Run package tests and confirm failure**

Run: `npm --prefix desktop-agent test -- package-config.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Generate Windows icon assets from the existing cat logo**

The build script reads `../public/icons/icon-512.png`, emits deterministic tray PNGs and `morniter-agent.ico`, and fails if the source is missing or smaller than 512px.

- [ ] **Step 4: Configure NSIS install and upgrade**

Set `oneClick:false`, `perMachine:false`, `allowToChangeInstallationDirectory:false`, stable `appId`, Start Menu shortcut, and startup registration on first launch. Preserve valid application data during upgrade.

- [ ] **Step 5: Implement bounded uninstall cleanup**

Stop the Agent, remove startup registration and application files, then offer Retain settings/logs or Remove all Agent data. Never touch repositories, ProjectSTS dependencies, Playwright tests, browser/PWA profiles, or generated project files.

- [ ] **Step 6: Build the installer artifact**

Run: `npm run agent:build`  
Run: `npm run desktop-agent:package`  
Expected: signed-build-ready NSIS `.exe` appears under `desktop-agent/dist/`; no source maps or secrets are bundled.

### Task 9: Verify install, upgrade, startup, and uninstall

**Files:**
- Create: `desktop-agent/tests/windows-installer-smoke.ps1`
- Create: `docs/morniter-agent-installation.md`
- Modify: `morniter-playwright-docs/example.md`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Produces: release evidence and team installation guide.
- Consumes: packaged artifact from Task 8 and deployed pairing APIs.

- [ ] **Step 1: Add a disposable Windows installer smoke script**

The script checks install exit code, Installed Apps entry, shortcut, first-launch wizard, startup registration, process shutdown, upgrade preserving settings, retain-data uninstall, reinstall recovery, and full-data uninstall. It uses a temporary Windows test account or disposable VM only.

- [ ] **Step 2: Document exact team workflow**

Document: download installer from the approved release, verify publisher/checksum, install, create Pairing Code in Morniter, select ProjectSTS workspace/test root, install Chromium when prompted, wait for Online, install the PWA separately, run one test, and uninstall from Windows Settings.

- [ ] **Step 3: Run automated release gates**

Run: `npm run typecheck`  
Run: `npm run lint`  
Run: `npm test`  
Run: `npm run agent:build`  
Run: `npm run build`  
Run: `npm --prefix desktop-agent test`  
Run: `npm --prefix desktop-agent run build`  
Expected: all pass.

- [ ] **Step 4: Run manual Windows 10 and Windows 11 acceptance**

On each OS, verify non-admin clean install, successful pairing, Agent Online, catalog scan, one headless run, one visible-browser run, startup after sign-in, upgrade, retain-data uninstall/reinstall, and full-data uninstall.

- [ ] **Step 5: Record exact status and release blockers**

Update `STATUS.md` with artifact version/hash, automated counts, Windows acceptance matrix, deployment URL, signing state, and remaining blockers. Do not mark production complete until the installer is code-signed and distributed from a trusted team location.
