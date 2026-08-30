import { z } from "zod";

/**
 * ⚠️ INCOMPLETE — DO NOT use this file to overwrite a real schemas.ts.
 * Build-log evidence (route handler imports) proves the real schemas.ts
 * additionally exports at least three schemas this file does NOT have:
 *   - PlaywrightHeartbeatSchema
 *     (used by agent/jobs/[jobId]/heartbeat/route.ts)
 *   - PlaywrightCompleteJobSchema
 *     (used by agent/jobs/[jobId]/complete/route.ts — its parsed output
 *     was partially visible in a compiler error: status is one of
 *     "passed" | "failed" | "cancelled" | "timed_out" — notably NOT
 *     "error", unlike PlaywrightJobStatus's full union in types.ts —
 *     plus optional jobId, browserResults, and artifacts fields)
 *   - AppendPlaywrightLogBatchSchema
 *     (used by agent/jobs/[jobId]/logs/route.ts)
 *
 * This file only covers the browser -> server job-creation contract
 * (PlaywrightJobRequestSchema). It was never contradicted by build
 * evidence the way job-store-logic.ts and types.ts were, which is why
 * it hasn't been touched — but "never contradicted" just means the
 * build hasn't reached a place that would expose the gap yet, not that
 * this file is complete. Dropping it in over the real file would delete
 * three schemas real route handlers depend on.
 *
 * Playwright Automation Workspace — request validation.
 *
 * Mirrors the rules in Task 0.2:
 *   - projectId must match the existing project ID format
 *   - browsers: 1..3 entries, each unique
 *   - code has a max size
 *   - workspace requires code (and forbids testIds)
 *   - project-test requires testIds (and forbids code)
 *   - source determines which of the above two applies (mutual exclusion)
 *
 * DUPLICATION NOTE: the legacy preset-based test runner exports an
 * identically-defined `ID_REGEX` (confirmed by pasted content — same
 * pattern below), but its file path in the repo hasn't been located yet.
 * This is redeclared locally for now rather than left on a guessed import
 * path. Once the legacy file is located, replace this with:
 *   import { ID_REGEX } from "<real path>";
 * and delete PROJECT_ID_PATTERN below, so there's one source of truth.
 * To find it: `grep -rn "export const ID_REGEX" --include="*.ts" .`
 */

// Matches the existing catalog project id format, e.g. "projectsts".
// Lowercase alphanumeric + hyphens, no path separators, no whitespace.
// Kept identical to the legacy ID_REGEX on purpose (see note above).
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const ProjectIdSchema = z
  .string()
  .min(1, "projectId is required")
  .max(64, "projectId is too long")
  .regex(PROJECT_ID_PATTERN, "projectId has an invalid format");

export const BrowserNameSchema = z.enum(["chromium", "firefox", "webkit"]);

export const BrowserModeSchema = z.enum(["headless", "headed"]);

export const BrowsersSchema = z
  .array(BrowserNameSchema)
  .min(1, "at least one browser must be selected")
  .max(3, "at most three browsers may be selected")
  .refine(
    (browsers) => new Set(browsers).size === browsers.length,
    "browsers must not contain duplicates",
  );

/**
 * CONFIRMED to exist by a real unit test (tests/unit/playwright-runner/
 * schemas.test.ts) importing `sanitizeBrowsers` from this module and
 * asserting it dedupes while preserving order:
 *   sanitizeBrowsers(["chromium","firefox","chromium"])
 *     -> ["chromium","firefox"]
 * Kept as a standalone exported utility rather than folded into
 * BrowsersSchema as a .transform() — no test evidence shows the main
 * schema silently accepting/deduping a raw duplicate-browser request
 * (the existing .refine() reject-on-duplicate behavior above is
 * untouched, since nothing contradicts it); this is exported
 * separately for whatever call site (likely the UI, before submission)
 * needs a plain dedupe utility rather than a throwing validator.
 */
export function sanitizeBrowsers(browsers: string[]): string[] {
  return Array.from(new Set(browsers));
}

// Test IDs are opaque stable hashes published by the catalog (Task 2.2),
// never raw file paths.
const TestIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "testId has an invalid format");

const MAX_WORKSPACE_CODE_BYTES = 200_000;

export const WorkspaceCodeSchema = z
  .string()
  .min(1, "workspace code must not be empty")
  .max(MAX_WORKSPACE_CODE_BYTES, "workspace code exceeds the maximum size");

const BaseJobFields = {
  projectId: ProjectIdSchema,
  browsers: BrowsersSchema,
  mode: BrowserModeSchema,
  // CONFIRMED by a real compiler error on jobs/route.ts: the route reads
  // `parseResult.data.agentId || "windows-local-agent-1"` — this field
  // was entirely missing from the original schema, a genuine miss (this
  // schema was never touched/challenged until this error, unlike the
  // agent-side ones which I'd already flagged as lower-confidence).
  // Optional, letting a client target a specific agent; not a violation
  // of the "no command/cwd/env/path" contract — it's routing metadata.
  agentId: z.string().min(1).max(128).optional(),
};

// source: "project-test" — requires testIds, forbids code.
const ProjectTestJobSchema = z
  .object({
    ...BaseJobFields,
    source: z.literal("project-test"),
    testIds: z.array(TestIdSchema).min(1, "select at least one test"),
    code: z.undefined().optional(),
  })
  .strict();

// source: "workspace" — requires code, forbids testIds.
const WorkspaceJobSchema = z
  .object({
    ...BaseJobFields,
    source: z.literal("workspace"),
    code: WorkspaceCodeSchema,
    testIds: z.undefined().optional(),
  })
  .strict();

/**
 * Discriminated union enforcing source-specific mutual exclusion:
 * a request is valid only as exactly one of the two shapes above.
 * `.strict()` on each branch additionally rejects any unexpected field
 * (e.g. a client trying to smuggle `command`, `cwd`, `args`, or `env`).
 */
export const PlaywrightJobRequestSchema = z.discriminatedUnion("source", [
  ProjectTestJobSchema,
  WorkspaceJobSchema,
]);

export type PlaywrightJobRequestInput = z.infer<
  typeof PlaywrightJobRequestSchema
>;

/**
 * Parse and validate a raw request body. Throws a ZodError with field-level
 * issues on failure — callers in the route handler should catch this and
 * respond 400 with a sanitized message (never echo raw upstream errors that
 * might include unexpected input back to the client verbatim).
 */
export function parsePlaywrightJobRequest(body: unknown) {
  return PlaywrightJobRequestSchema.parse(body);
}

// ============================================================
// AGENT-SIDE SCHEMAS — reconstructed against real build evidence
// ============================================================
//
// Everything below was added after a real Turbopack build failure
// listed these four exports as missing:
//   AppendPlaywrightLogBatchSchema, PlaywrightCompleteJobSchema,
//   PlaywrightHeartbeatSchema, PlaywrightPollRequestSchema
//
// Confidence varies per schema — noted individually. All are built to
// structurally match the corresponding real types in types.ts
// (BrowserExecutionResult, TestArtifact, PlaywrightCatalog), which are
// themselves already evidence-corrected from earlier compiler errors.

/**
 * Matches BrowserExecutionResult in types.ts exactly (confirmed shape).
 */
export const BrowserExecutionResultSchema = z
  .object({
    browser: BrowserNameSchema,
    status: z.enum([
      "waiting",
      "running",
      "passed",
      "failed",
      "timed_out",
      "cancelled",
    ]),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative().optional(),
  })
  .strict();

/**
 * Matches TestArtifact in types.ts exactly (confirmed shape, itself
 * confirmed via a real compiler structural-mismatch error).
 */
export const TestArtifactSchema = z
  .object({
    id: z.string().min(1),
    jobId: z.string().min(1),
    type: z.enum(["screenshot", "trace", "video", "report"]),
    filename: z.string().min(1),
    size: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    browser: BrowserNameSchema.optional(),
    testId: z.string().optional(),
    downloadUrl: z.string().optional(),
  })
  .strict();

/**
 * Matches PlaywrightCatalog/PlaywrightCatalogProject in types.ts.
 * `testGroups` kept as z.array(z.unknown()) — its element shape is still
 * genuinely unconfirmed (truncated compiler output), same caveat as in
 * types.ts itself.
 */
const PlaywrightCatalogProjectCapabilitiesSchema = z
  .object({
    browsers: z
      .object({
        chromium: z.boolean().optional(),
        firefox: z.boolean().optional(),
        webkit: z.boolean().optional(),
      })
      .optional(),
    headed: z.boolean().optional(),
    workspaceExecution: z.boolean().optional(),
  })
  .optional();

const PlaywrightTestDescriptorSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    group: z.string(),
    relativePath: z.string().min(1),
    tags: z.array(z.string()).optional(),
    line: z.number().int().positive().optional(),
  })
  .strict();

/**
 * CONFIRMED shape by a real unit test that constructs
 * `testGroups: [{ name: "Auth", tests: [{...}] }]` and successfully
 * parses it — was previously left as z.array(z.unknown()) pending
 * evidence; genuinely resolved now, not a guess.
 */
const PlaywrightTestGroupSchema = z
  .object({
    name: z.string().min(1),
    tests: z.array(PlaywrightTestDescriptorSchema),
  })
  .strict();

const PlaywrightCatalogProjectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rootLabel: z.string().optional(),
    capabilities: PlaywrightCatalogProjectCapabilitiesSchema,
    testGroups: z.array(PlaywrightTestGroupSchema).optional(),
    tests: z.array(PlaywrightTestDescriptorSchema).optional(),
    scanPathLabel: z.string().max(256).optional(),
    sourceByPath: z
      .record(z.string().min(1).max(512), z.string().max(200_000))
      .optional(),
  })
  .strict();

// Public alias retained for callers that use the project-level catalog name.
export const PlaywrightProjectCatalogSchema = PlaywrightCatalogProjectSchema;

export const PlaywrightCatalogSchema = z
  .object({
    version: z.string().min(1),
    updatedAt: z.string().datetime(),
    projects: z.array(PlaywrightCatalogProjectSchema),
  })
  .strict();

/**
 * HIGH CONFIDENCE — status literal union confirmed directly by a real
 * compiler error on the complete route (notably NOT the full
 * PlaywrightJobStatus union: no "error", no "queued", etc. — only the
 * four outcomes an agent actually reports on completion). `jobId` was
 * also visible in that same error as present-but-optional on the parsed
 * type (redundant with the route's own [jobId] path param, presumably
 * kept for double-checking/logging).
 */
export const PlaywrightCompleteJobSchema = z
  .object({
    jobId: z.string().optional(),
    status: z.enum(["passed", "failed", "cancelled", "timed_out"]),
    browserResults: z.array(BrowserExecutionResultSchema).optional(),
    artifacts: z.array(TestArtifactSchema).optional(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
    error: z.string().optional(),
  })
  .strict();

/**
 * MEDIUM CONFIDENCE — inferred from appendPlaywrightLogBatch's real
 * parameter types in job-store.ts (sequenceStart: number, entries:
 * Array<{stream, message, browser?}>, browserResults?) rather than from
 * a direct compiler structural-mismatch error. Field NAMES and
 * OPTIONALITY should be right; exact string-length limits
 * (message/entries count) are a judgment call, not evidenced — kept
 * consistent with this repo's own documented log-batch limits
 * (ARCHITECTURE.md: 100 lines / 32 KiB per upload).
 */
export const AppendPlaywrightLogBatchSchema = z
  .object({
    sequenceStart: z.number().int().nonnegative(),
    entries: z
      .array(
        z.object({
          stream: z.enum(["stdout", "stderr", "system"]),
          message: z.string().max(32_768),
          browser: BrowserNameSchema.optional(),
        }),
      )
      .min(1)
      .max(100),
    browserResults: z.array(BrowserExecutionResultSchema).optional(),
  })
  .strict();

/**
 * MEDIUM CONFIDENCE — inferred from heartbeatPlaywrightJob's real
 * parameter types (browserResults? is the only body-derived data it
 * takes; jobId/agentId come from the URL param + auth, not the body).
 * `observedAt` CONFIRMED required by a real compiler error: the route
 * passes `new Date(parseResult.data.observedAt)` directly as the `now`
 * argument with no fallback/optional-chaining, and originally this
 * schema omitted the field entirely — a genuine miss, not a confidence
 * judgment call like the rest of this schema.
 */
export const PlaywrightHeartbeatSchema = z
  .object({
    observedAt: z.string().datetime(),
    browserResults: z.array(BrowserExecutionResultSchema).optional(),
  })
  .strict();

/**
 * MEDIUM CONFIDENCE overall, but `agentId` specifically is now CONFIRMED
 * by a real compiler error — a genuine miss, not a judgment call: I'd
 * assumed agentId came from verifyAgentAuth() the way it does in the
 * other agent routes, but the poll route destructures it directly off
 * the parsed body instead (`const { agentId, catalog, capabilities } =
 * parseResult.data`). capabilities' shape matches
 * PlaywrightAgentPresence["capabilities"] from the real job-store.ts
 * exactly (that part IS directly evidenced, since job-store.ts's own
 * type definition was pasted in full).
 */
export const PlaywrightPollRequestSchema = z
  .object({
    agentId: z.string().min(1).max(128),
    catalogVersion: z.string().optional(),
    catalog: PlaywrightCatalogSchema.optional(),
    capabilities: z
      .object({
        browsers: z
          .object({
            chromium: z.boolean().optional(),
            firefox: z.boolean().optional(),
            webkit: z.boolean().optional(),
          })
          .optional(),
        headed: z.boolean().optional(),
        workspaceExecution: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();
