import {
  PlaywrightJobRequestSchema,
  type PlaywrightJobRequestInput,
} from "./schemas";

/**
 * Client-side form validation for the Playwright job creation UI.
 *
 * LOW COLLISION RISK NOTE: unlike job-store-logic.ts and redaction.ts
 * (both superseded by real files discovered later), this is new
 * UI-adjacent logic with no evidence of a pre-existing equivalent — it
 * only depends on schemas.ts, which job-store.ts's actual usage has not
 * contradicted (enqueuePlaywrightJob destructures exactly
 * { projectId, source, testIds, code, browsers, mode }, matching this
 * schema's shape). Still: if a real form/validation file turns up later,
 * prefer it over this one, same as everything else in this folder.
 *
 * This does NOT replace server-side validation — the route handler must
 * still run PlaywrightJobRequestSchema.parse() itself. This exists only
 * to give a form instant, field-scoped feedback before submission
 * (e.g. "select at least one test" next to the test picker, rather than
 * a generic error banner after a round trip).
 */

export type PlaywrightJobFormState = {
  projectId: string;
  source: "project-test" | "workspace" | null;
  testIds: string[];
  code: string;
  browsers: string[];
  mode: "headless" | "headed" | null;
};

export function emptyFormState(projectId: string): PlaywrightJobFormState {
  return {
    projectId,
    source: null,
    testIds: [],
    code: "",
    browsers: [],
    mode: null,
  };
}

export type FormFieldErrors = Partial<
  Record<
    "projectId" | "source" | "testIds" | "code" | "browsers" | "mode" | "form",
    string
  >
>;

export type ValidateFormResult =
  | { ok: true; request: PlaywrightJobRequestInput }
  | { ok: false; fieldErrors: FormFieldErrors };

/**
 * Map a single Zod issue's path to a form field key. Falls back to a
 * generic "form" bucket for anything unexpected (e.g. a future schema
 * change adds a field this map doesn't know about yet) rather than
 * silently dropping the error message.
 */
function fieldKeyForPath(path: PropertyKey[]): keyof FormFieldErrors {
  const first = path[0];
  if (
    first === "projectId" ||
    first === "source" ||
    first === "testIds" ||
    first === "code" ||
    first === "browsers" ||
    first === "mode"
  ) {
    return first;
  }
  return "form";
}

/**
 * Validate raw form state before submission. If the source-specific
 * required field is missing (testIds for project-test, code for
 * workspace), that's reported as a field error rather than surfacing
 * Zod's discriminated-union "invalid literal" noise — a form user should
 * see "select at least one test", not a schema error about
 * discriminants.
 */
export function validateJobFormState(
  state: PlaywrightJobFormState,
): ValidateFormResult {
  if (state.source === null) {
    return {
      ok: false,
      fieldErrors: { source: "choose project tests or workspace code" },
    };
  }
  if (state.mode === null) {
    return { ok: false, fieldErrors: { mode: "choose headless or headed" } };
  }

  const candidate =
    state.source === "project-test"
      ? {
          projectId: state.projectId,
          source: "project-test" as const,
          testIds: state.testIds,
          browsers: state.browsers,
          mode: state.mode,
        }
      : {
          projectId: state.projectId,
          source: "workspace" as const,
          code: state.code,
          browsers: state.browsers,
          mode: state.mode,
        };

  const result = PlaywrightJobRequestSchema.safeParse(candidate);

  if (result.success) {
    return { ok: true, request: result.data };
  }

  const fieldErrors: FormFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = fieldKeyForPath(issue.path);
    // First error per field wins — a form shows one message per field,
    // not a stacked list, so later issues for an already-flagged field
    // are dropped rather than overwriting a more specific earlier one.
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return { ok: false, fieldErrors };
}
