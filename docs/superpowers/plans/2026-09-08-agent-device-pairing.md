# Agent Device Pairing Implementation Plan

Current status: implemented locally through device APIs, async Agent-route authentication, and the first production UI. Focused tests, full Vitest, typecheck, lint, and Next.js build pass. Remaining work is deployed enrollment/revocation smoke testing and the authenticated browser acceptance test.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add short-lived pairing codes and revocable per-device credentials so team members can connect a Windows Local Agent without copying the shared Vercel Agent token.

**Architecture:** `TEST_RUNNER_AGENT_TOKEN` remains the only server-side root secret. Authenticated operators create one-use pairing codes stored as HMAC digests in Upstash; enrollment exchanges a valid code for an HS256 device JWT whose `jti` is recorded in Redis. Agent routes accept either the legacy shared token for developer mode or a non-revoked device token.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod 4, jose, Node crypto, Upstash Redis, React 19, Vitest, Testing Library, Playwright.

## Global Constraints

- Never return `TEST_RUNNER_AGENT_TOKEN`, a token digest, or a complete device token to the browser after enrollment.
- Pairing codes contain six uppercase alphanumeric characters, are single-use, and expire after 10 minutes.
- Pairing creation and revocation require monitor and execution sessions plus same-origin validation.
- Enrollment is public only to the holder of a valid pairing code and is rate-limited by a non-reversible request fingerprint.
- Device tokens are bound to `agentId`, `deviceId`, and JWT `jti`; revocation is checked on every Agent request.
- Existing shared-token authentication remains available for `npm run test-agent` developer mode.
- No absolute project path may be stored or returned by this subsystem.
- Do not run Git commands. The operator handles add, commit, push, and deployment manually.

---

### Task 1: Define pairing and device contracts

**Files:**
- Create: `src/lib/test-runner/device-contracts.ts`
- Modify: `src/lib/playwright-runner/schemas.ts`
- Test: `tests/unit/test-runner/device-contracts.test.ts`

**Interfaces:**
- Produces: `CreatePairingCodeSchema`, `EnrollDeviceSchema`, `DeviceIdSchema`, `AgentDevice`, `AgentDevicePublic`, `PAIRING_TTL_SECONDS`.
- Consumes: existing project and Agent ID validation conventions.

- [ ] **Step 1: Add failing schema tests**

```ts
expect(EnrollDeviceSchema.parse({ pairingCode: "ABC-123", agentId: "mark-windows-01", deviceId: crypto.randomUUID() })).toBeTruthy();
expect(() => EnrollDeviceSchema.parse({ pairingCode: "abc", agentId: "bad id", deviceId: "C:\\secret" })).toThrow();
```

- [ ] **Step 2: Run the focused test and confirm missing exports fail**

Run: `npm test -- tests/unit/test-runner/device-contracts.test.ts`  
Expected: FAIL because `device-contracts.ts` does not exist.

- [ ] **Step 3: Implement exact bounded contracts**

```ts
export const PAIRING_TTL_SECONDS = 10 * 60;
export const PairingCodeSchema = z.string().regex(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
export const DeviceIdSchema = z.string().uuid();
export const EnrollDeviceSchema = z.object({
  pairingCode: PairingCodeSchema,
  agentId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  deviceId: DeviceIdSchema,
}).strict();
```

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- tests/unit/test-runner/device-contracts.test.ts`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: PASS.

### Task 2: Implement pairing and device storage

**Files:**
- Create: `src/lib/test-runner/device-store.ts`
- Test: `tests/unit/test-runner/device-store.test.ts`

**Interfaces:**
- Produces: `createPairingCode(agentId, now)`, `consumePairingCode(code, device, now)`, `listAgentDevices()`, `revokeAgentDevice(deviceId, now)`, `isDeviceTokenActive(deviceId, jti)`.
- Consumes: `getRunnerRedis()`, `TEST_RUNNER_AGENT_TOKEN`, Task 1 contracts.

- [ ] **Step 1: Write failing tests for TTL, single use, redaction, and revocation**

```ts
const created = await createPairingCode("mark-windows-01", now);
expect(created.code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
await expect(consumePairingCode(created.code, device, now)).resolves.toMatchObject({ agentId: "mark-windows-01" });
await expect(consumePairingCode(created.code, device, now)).rejects.toThrow("PAIRING_CODE_INVALID");
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- tests/unit/test-runner/device-store.test.ts`  
Expected: FAIL because storage functions are absent.

- [ ] **Step 3: Implement HMAC digest keys and atomic consume**

Use `crypto.createHmac("sha256", TEST_RUNNER_AGENT_TOKEN)` for pairing-code and request fingerprints. Store only the digest at `morniter:agent-pairing:<digest>` with `EX 600`, consume with one Redis transaction/Lua operation, and store public device records at `morniter:agent-device:<deviceId>`. Never persist the clear code.

- [ ] **Step 4: Add bounded device indexing and seven-day revoked-record retention**

Limit the active device list to 100 records. Revocation sets `revokedAt`, removes the device from the active index, and retains the revocation lookup for at least the maximum JWT lifetime.

- [ ] **Step 5: Run focused and Redis regression tests**

Run: `npm test -- tests/unit/test-runner/device-store.test.ts tests/unit/test-runner/redis-command-counter.test.ts`  
Expected: PASS with no unbounded scan command.

### Task 3: Issue and verify device credentials

**Files:**
- Create: `src/lib/test-runner/device-token.ts`
- Modify: `src/lib/test-runner/agent-auth.ts`
- Test: `tests/unit/test-runner/device-token.test.ts`
- Test: `tests/unit/test-runner/agent-auth.test.ts`

**Interfaces:**
- Produces: `createDeviceToken({ agentId, deviceId, jti }, now)`, `verifyDeviceToken(token, now)`, async `verifyAgentAuth(req)` returning `{ mode, agentId?, deviceId? } | null`.
- Consumes: Task 2 `isDeviceTokenActive`.

- [ ] **Step 1: Add failing JWT and legacy-token compatibility tests**

Assert issuer `morniter-agent`, audience `morniter-runner`, scope `agent:poll`, 30-day expiry, required `sub=deviceId`, `agentId`, and `jti`. Assert revoked and agent-ID-mismatched tokens fail while the exact legacy shared token passes.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/unit/test-runner/device-token.test.ts tests/unit/test-runner/agent-auth.test.ts`  
Expected: FAIL on missing async device-token verification.

- [ ] **Step 3: Implement token issuance and authentication context**

```ts
return new SignJWT({ scope: "agent:poll", agentId, jti })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer("morniter-agent")
  .setAudience("morniter-runner")
  .setSubject(deviceId)
  .setIssuedAt(issuedAt)
  .setExpirationTime(issuedAt + 30 * 24 * 60 * 60)
  .sign(secretBytes);
```

- [ ] **Step 4: Make all Agent routes await authentication**

Modify every route under `src/app/api/test-runner/agent/**` and `src/app/api/playwright-runner/agent/**` to await `verifyAgentAuth(req)`. For device mode, reject a request body whose `agentId` differs from the signed claim.

- [ ] **Step 5: Run all Agent route tests**

Run: `npm test -- tests/integration/test-runner-agent-routes.test.ts tests/integration/playwright-runner-agent-routes.test.ts`  
Expected: PASS for legacy and device credentials; mismatch and revocation return 401.

### Task 4: Add pairing and device-management APIs

**Files:**
- Create: `src/app/api/playwright-runner/agents/pairing-code/route.ts`
- Create: `src/app/api/playwright-runner/agents/enroll/route.ts`
- Create: `src/app/api/playwright-runner/agents/route.ts`
- Create: `src/app/api/playwright-runner/agents/[deviceId]/revoke/route.ts`
- Test: `tests/integration/agent-device-pairing-routes.test.ts`

**Interfaces:**
- Produces: `POST pairing-code`, `POST enroll`, `GET agents`, `POST agents/:deviceId/revoke`.
- Consumes: Tasks 1–3 and existing monitor/execute session guards.

- [ ] **Step 1: Add failing route tests**

Cover same-origin enforcement, missing execute session, one-use enrollment, expired code, rate limit, safe list response, revocation, and responses that never contain a root-secret substring.

- [ ] **Step 2: Run the integration test and confirm 404/module failures**

Run: `npm test -- tests/integration/agent-device-pairing-routes.test.ts`  
Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement operator routes**

Pairing creation returns `{ code, expiresAt }`; listing returns only `{ deviceId, agentId, status, createdAt, lastSeenAt, revokedAt? }`; revocation returns 204. Require `requireMonitorSession()`, `requireExecuteSession(req)`, and `requireSameOrigin(req)` for mutation routes.

- [ ] **Step 4: Implement enrollment with rate limiting**

Enrollment accepts only Task 1 payload, limits failed attempts to 10 per 10 minutes per HMAC request fingerprint, atomically consumes the code, issues the device JWT, and returns it once as `{ deviceToken, device }` with `Cache-Control: no-store`.

- [ ] **Step 5: Run integration tests and production build**

Run: `npm test -- tests/integration/agent-device-pairing-routes.test.ts`  
Expected: PASS.  
Run: `npm run build`  
Expected: PASS with four new API routes.

### Task 5: Build the Morniter Agents settings screen

**Files:**
- Create: `src/app/monitor/settings/agents/page.tsx`
- Create: `src/components/agents/AgentDeviceSettings.tsx`
- Create: `src/components/agents/PairAgentPanel.tsx`
- Create: `src/components/agents/AgentDeviceList.tsx`
- Modify: `src/app/monitor/layout.tsx`
- Test: `tests/components/agents/AgentDeviceSettings.test.tsx`

**Interfaces:**
- Produces: accessible Agents settings UI and pairing-code lifecycle.
- Consumes: Task 4 routes.

- [ ] **Step 1: Write failing component tests**

Assert empty/loading/error states, 10-minute countdown, copy action, automatic code removal at expiry, device rows, confirmation before revoke, no token rendering, keyboard navigation, and 320px layout without horizontal overflow.

- [ ] **Step 2: Run the focused component suite and confirm failure**

Run: `npm test -- tests/components/agents/AgentDeviceSettings.test.tsx`  
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the approved production UI**

Use existing Morniter colors, typography, button vocabulary, focus states, and responsive rules. Add `Settings → Agents`, `Pair new agent`, a six-character code, expiry countdown, and status labels `Online`, `Offline`, `Revoked`. Do not use gradients or expose credentials.

- [ ] **Step 4: Add revoke confirmation and resilient refresh**

Use one confirmation dialog with device name and ID suffix. Refresh every 30 seconds only while the page is visible; stop polling after three consecutive failures and expose a manual Retry action.

- [ ] **Step 5: Run component, accessibility, lint, and type checks**

Run: `npm test -- tests/components/agents/AgentDeviceSettings.test.tsx`  
Expected: PASS.  
Run: `npm run lint`  
Expected: PASS.  
Run: `npm run typecheck`  
Expected: PASS.

### Task 6: Add authenticated browser acceptance

**Files:**
- Create: `e2e/agent-device-pairing.spec.ts`
- Modify: `docs/superpowers/plans/STATUS.md`

**Interfaces:**
- Produces: browser evidence that an operator can create and revoke a device pairing safely.
- Consumes: Tasks 1–5.

- [ ] **Step 1: Add an authenticated E2E test**

The test signs in, unlocks execution, opens Agents settings, creates a code, asserts the displayed format and countdown, uses the enroll API fixture once, confirms a second exchange fails, sees the device row, revokes it, and confirms subsequent Agent auth fails.

- [ ] **Step 2: Run the focused browser test**

Run: `npx playwright test e2e/agent-device-pairing.spec.ts`  
Expected: PASS on Chromium.

- [ ] **Step 3: Run the complete Morniter release gate**

Run: `npm run typecheck`  
Run: `npm run lint`  
Run: `npm test`  
Run: `npm run agent:build`  
Run: `npm run build`  
Run: `npx playwright test`  
Expected: every command passes; only documented expected skips remain.

- [ ] **Step 4: Record exact evidence**

Update `STATUS.md` with exact test counts, build route count, local-only status, required Vercel deployment variables, and the remaining real-device smoke test. Do not mark production complete before deployed enrollment and revocation pass.
