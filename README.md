# Project Monitor

Next.js full-stack telemetry dashboard and local test runner for group members to view deployment status, service health, provider events from Vercel, Render, Aiven, and cron-job.org, and execute verified test presets on a local Windows agent via Upstash Redis.

Includes PWA support for Desktop/Mobile home screen installation and an interactive Test Runner Console.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local

# 3. Generate group password hash
npm run hash-password -- "your-secure-group-password"

# 4. Generate 48+ character session signing secret
openssl rand -base64 48

# 5. Build and start local test runner agent (Windows)
npm run test-agent:build
$env:TEST_RUNNER_CONFIG="E:\project-monitor\test-runner.config.local.json"
$env:TEST_RUNNER_AGENT_TOKEN="your-agent-token-32-chars"
npm run test-agent

# 6. Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Commands

```bash
npm run dev               # Start Next.js development server
npm run build             # Build production bundle
npm run start             # Start production server
npm run lint              # Run ESLint check
npm run typecheck         # Run TypeScript check
npm run test              # Run Vitest test suite
npm run test:e2e          # Run Playwright end-to-end tests
npm run test-agent:build  # Compile Local Test Runner Agent
npm run test-agent        # Start Local Test Runner Agent
npm run hash-password -- "password"  # Generate bcrypt password hash
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `GROUP_ACCESS_PASSWORD_HASH` | Required bcrypt hash of the group password |
| `SESSION_SIGNING_SECRET` | Required 48+ char secret for HS256 JWT cookie signing |
| `MONITOR_DISPLAY_NAME` | Display title on the monitor header (default: Project Monitor) |
| `TEST_RUNNER_PASSWORD_HASH` | Bcrypt hash for execution step-up authorization (15-minute session) |
| `TEST_RUNNER_AGENT_TOKEN` | Secret Bearer token shared with Local Test Runner Agent |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL for test queue & log streaming |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API Token |

---

## Test Runner Console & Local Agent

The Test Runner Console replaces arbitrary shell commands with a secure, preset-driven local execution system:

- **Zero Shell Exposure**: Browser payloads send only `projectId` and `presetId`. Raw commands, parameters, working directories, or environment variables are never accepted over HTTP.
- **Local Agent Preset Resolver**: The Windows Local Agent resolves preset execution contracts strictly from local config (`test-runner.config.local.json`).
- **Safe Process Execution**: Executes commands via Node `spawn(executable, args, { shell: false })` with process-tree termination on timeout or cancellation.
- **Execution Step-Up Authorization**: Execution requires a dedicated 15-minute `monitor:execute` session (`TEST_RUNNER_PASSWORD_HASH`).
- **Upstash Redis Queue & Storage**: Job queue (max 10 items), job status, log streaming (max 5,000 lines / 1 MB), catalog, and heartbeat are stored in Upstash Redis.


---

## Architecture & Security Constraints

- **Read-Only**: All provider calls are read-only. No redeploy, restart, or mutation endpoints exist.
- **Provider Credentials**: Secret tokens reside strictly on the server (`server-only`). They are never exposed in JavaScript bundles or client API responses.
- **Redaction Engine**: Upstream log messages pass through a multi-pass regex redactor stripping Bearer headers, database URLs, and secret JSON keys.
- **Memory Cache**: 30-second server memory cache prevents hitting provider rate limits. Manual refresh (`force=1`) bypasses cache.
- **Adaptive Polling**: Automatically polls at 60-second intervals during healthy operation and accelerates to 20-second intervals during incidents or degraded states.
- **Historical Deployments**: Fetches up to 20 historical deployment and commit records per Vercel project or Render service without requiring database storage.
- **Resilience**: A failure in one provider adapter sets `partial: true` without removing successful events from other providers.

---

### Deployment Diagnostics

Vercel and Render provider snapshots include up to 20 historical deployment records with Git commit metadata (SHA, branch, author, commit message).
Diagnostic logs are fetched on-demand when an authenticated user clicks "View deployment log" or "View diagnostic details".
Diagnostic responses are cached server-side for 60 seconds with in-flight deduplication, redacted, and limited to 20 lines or 4 KB.

> **Production Note for Vercel & Render:**
> Ensure `VERCEL_PROJECT_IDS` and `RENDER_SERVICE_IDS` use the exact project/service identifiers. When updating environment variables on Vercel or Render production, redeploy the application for new environment configuration to take effect.

- Vercel diagnostics use deployment events for non-READY deployments.
- Render diagnostics use the configured service ID and the owner ID returned by the service API.
- Provider tokens remain server-side.
- The monitor never retries, cancels, rolls back, or triggers a deployment.


---

## Production Deployment Notes

Set `AIVEN_DATABASE_NAME=student_tracking` in both Preview and Production when testing both Vercel environments. The dashboard label is a configured database target; it is not a schema-level connectivity proof from the Aiven service endpoint.

Browser notifications require the user to click `Enable browser alerts`, and the in-app incident alert banner still works when permission is denied or blocked.


---

## Production Deployment (Vercel)

1. Deploy the Next.js application to Vercel.
2. Set Environment Variables (`GROUP_ACCESS_PASSWORD_HASH`, `SESSION_SIGNING_SECRET`, and provider credentials) in Vercel Project Settings.
3. Configure Vercel Firewall rate-limiting on `/api/auth/login`.
