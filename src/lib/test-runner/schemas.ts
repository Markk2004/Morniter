import { z } from "zod";

<<<<<<< HEAD
// Legacy preset-runner API contract. Do not replace this module with the
// Playwright workspace schemas; the new runner owns its separate module at
// src/lib/playwright-runner/schemas.ts while migration routes still compile.

export const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SRS_ID_REGEX = /^(?:FR|BR|NFR)-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i;
=======
/**
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
>>>>>>> 8ef9a552828fca2885ac621be4efd4d25a15997f

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
