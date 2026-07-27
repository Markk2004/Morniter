# Project Monitor

Next.js full-stack read-only telemetry dashboard for group members to view deployment status, service health, and provider events from Vercel, Render, Aiven, and cron-job.org in a single unified terminal interface.

The application contains both React UI components and server-side API route handlers within a single Next.js project deployed on Vercel. It requires **no database**, **no Redis**, and contains **no mutation/destructive operations**.

Includes PWA support for Desktop/Mobile home screen installation and an interactive Diagnostic Terminal query engine.

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

# 5. Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Commands

```bash
npm run dev          # Start Next.js development server
npm run build        # Build production bundle
npm run start        # Start production server
npm run lint         # Run ESLint check
npm run typecheck    # Run TypeScript check
npm run test         # Run Vitest test suite
npm run test:e2e     # Run Playwright end-to-end tests
npm run hash-password -- "password"  # Generate bcrypt password hash
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `GROUP_ACCESS_PASSWORD_HASH` | Required bcrypt hash of the group password |
| `SESSION_SIGNING_SECRET` | Required 48+ char secret for HS256 JWT cookie signing |
| `MONITOR_DISPLAY_NAME` | Display title on the monitor header (default: Project Monitor) |
| `VERCEL_API_TOKEN` | Read-only Vercel API access token |
| `VERCEL_TEAM_ID` | Optional Vercel Team ID |
| `VERCEL_PROJECT_IDS` | Comma-separated `id:label` pairs (e.g. `prj_123:frontend`) |
| `RENDER_API_KEY` | Read-only Render API key |
| `RENDER_SERVICE_IDS` | Comma-separated `id:label` pairs (e.g. `srv_123:backend`) |
| `AIVEN_API_TOKEN` | Read-only Aiven API token |
| `AIVEN_PROJECT_NAME` | Aiven project name |
| `AIVEN_DATABASE_NAME` | Database target shown for the configured Aiven service (default: `student_tracking`) |
| `AIVEN_SERVICE_NAMES` | Comma-separated `id:label` pairs (e.g. `db-pg:database`) |
| `CRONJOB_API_KEY` | Read-only cron-job.org API key |
| `CRONJOB_JOB_IDS` | Comma-separated `id:label` pairs (e.g. `8158370:news-job`) |
| `MONITORED_HEALTH_ENDPOINTS` | Comma-separated `id:label` pairs (e.g. `https://example.com/api/health:api`) |
| `MONITOR_AGENT_INGEST_TOKEN` | Secret Bearer token for dev agent log ingestion |
| `MONITOR_AGENT_PROJECT_ID` | Configured project ID for dev agent logs |
| `MONITOR_AGENT_BUFFER_SECONDS` | In-memory agent log TTL (default: 60) |

---

## Diagnostic Terminal Commands

The built-in read-only Diagnostic Terminal supports allowlisted commands:

- `logs [source] [service] [--last N]` - Filter logs by provider source and service name (e.g., `logs render backend --last 50`)
- `errors [source] [--last N]` - View error severity events
- `deploys [source] [--last N]` - View deployment history events
- `health all` - View health endpoint status
- `cron failures` - View failed scheduled cron job executions
- `agent [projectId] [--last N]` - View dev agent runtime output

---

## Architecture & Security Constraints

- **Read-Only**: All provider calls are read-only. No redeploy, restart, or mutation endpoints exist.
- **Provider Credentials**: Secret tokens reside strictly on the server (`server-only`). They are never exposed in JavaScript bundles or client API responses.
- **Redaction Engine**: Upstream log messages pass through a multi-pass regex redactor stripping Bearer headers, database URLs, and secret JSON keys.
- **Memory Cache**: 10-second server memory cache prevents hitting provider rate limits.
- **Resilience**: A failure in one provider adapter sets `partial: true` without removing successful events from other providers.

---

## Production Deployment Notes

Set `AIVEN_DATABASE_NAME=student_tracking` in both Preview and Production when testing both Vercel environments. The dashboard label is a configured database target; it is not a schema-level connectivity proof from the Aiven service endpoint.

Browser notifications require the user to click `Enable browser alerts`, and the in-app incident alert banner still works when permission is denied or blocked.


---

## Production Deployment (Vercel)

1. Deploy the Next.js application to Vercel.
2. Set Environment Variables (`GROUP_ACCESS_PASSWORD_HASH`, `SESSION_SIGNING_SECRET`, and provider credentials) in Vercel Project Settings.
3. Configure Vercel Firewall rate-limiting on `/api/auth/login`.
