import { z } from "zod";

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

export function sanitizeBrowsers(browsers: string[]): string[] {
  return Array.from(new Set(browsers));
}

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
  agentId: z.string().min(1).max(128).optional(),
  risk: z.enum(["read-only", "mutating"]).optional(),
  recipeId: z.string().optional(),
};

const ProjectTestJobSchema = z
  .object({
    ...BaseJobFields,
    source: z.literal("project-test"),
    testIds: z.array(TestIdSchema).min(1, "select at least one test"),
    code: z.undefined().optional(),
  })
  .strict();

const WorkspaceJobSchema = z
  .object({
    ...BaseJobFields,
    source: z.literal("workspace"),
    code: WorkspaceCodeSchema,
    testIds: z.undefined().optional(),
  })
  .strict();

export const PlaywrightJobRequestSchema = z.discriminatedUnion("source", [
  ProjectTestJobSchema,
  WorkspaceJobSchema,
]);

export type PlaywrightJobRequestInput = z.infer<
  typeof PlaywrightJobRequestSchema
>;

export function parsePlaywrightJobRequest(body: unknown) {
  return PlaywrightJobRequestSchema.parse(body);
}

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

const PlaywrightTestGroupSchema = z
  .object({
    name: z.string().min(1),
    tests: z.array(PlaywrightTestDescriptorSchema),
  })
  .strict();

export const RunnerProfileSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    runner: z.enum([
      "playwright",
      "generated-playwright",
      "node-test",
      "jest",
      "jest-e2e",
    ]),
    workingDirectory: z
      .string()
      .min(1)
      .refine(
        (val) =>
          !val.startsWith("/") &&
          !val.includes("\\") &&
          !val.split("/").includes(".."),
        { message: "workingDirectory must be a contained relative path" },
      ),
    config: z
      .string()
      .min(1)
      .refine(
        (val) =>
          !val.startsWith("/") &&
          !val.includes("\\") &&
          !val.split("/").includes(".."),
        { message: "config must be a contained relative path" },
      )
      .optional(),
    envAllowlist: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*$/)).optional(),
  })
  .strict();

const ProjectCoverageTestSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    relativePath: z
      .string()
      .min(1)
      .refine(
        (value) =>
          !value.startsWith("/") &&
          !value.includes("\\") &&
          !value.split("/").includes(".."),
        { message: "relativePath must be browser-safe" },
      ),
    runner: z.enum([
      "playwright",
      "generated-playwright",
      "node-test",
      "jest",
      "jest-e2e",
    ]),
    executionProfileId: z.string().min(1).max(64).optional(),
    executable: z.boolean(),
    risk: z.enum(["read-only", "mutating"]).optional(),
    origin: z.enum(["manual", "generated"]),
    confidence: z.enum(["high", "medium", "low"]),
    matchedBy: z.array(
      z.enum([
        "explicit",
        "source-id",
        "path",
        "title",
        "keyword",
        "unmatched",
      ]),
    ),
  })
  .strict();

const ProjectCoverageGroupSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    functionId: z.string().min(1).optional(),
    functionName: z.string().min(1).optional(),
    tests: z.array(ProjectCoverageTestSchema),
    gaps: z.array(
      z
        .object({
          targetId: z.string().min(1),
          title: z.string().min(1),
          status: z.enum([
            "missing-recipe",
            "ready-to-generate",
            "unsupported",
            "stale-generated",
          ]),
        })
        .strict(),
    ),
  })
  .strict();

export const CatalogTestTargetSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(128),
    allowMutating: z.boolean(),
  })
  .strict();

const PlaywrightCatalogProjectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    mapRevision: z.string().optional(),
    testTarget: CatalogTestTargetSchema.optional(),
    rootLabel: z.string().optional(),
    capabilities: PlaywrightCatalogProjectCapabilitiesSchema,
    runnerProfiles: z.array(RunnerProfileSchema).optional(),
    testGroups: z.array(PlaywrightTestGroupSchema).optional(),
    tests: z.array(PlaywrightTestDescriptorSchema).optional(),
    scanPathLabel: z.string().max(256).optional(),
    coverageGroups: z.array(ProjectCoverageGroupSchema).optional(),
    sourceByPath: z
      .record(z.string().min(1).max(512), z.string().max(200_000))
      .optional(),
  })
  .strict();

export const PlaywrightProjectCatalogSchema = PlaywrightCatalogProjectSchema;

export const PlaywrightCatalogSchema = z
  .object({
    version: z.string().min(1),
    updatedAt: z.string().datetime(),
    projects: z.array(PlaywrightCatalogProjectSchema),
  })
  .strict();

export const NativeGroupResultSchema = z
  .object({
    runner: z.enum([
      "playwright",
      "generated-playwright",
      "node-test",
      "jest",
      "jest-e2e",
    ]),
    executionProfileId: z.string().min(1),
    status: z.enum(["passed", "failed", "cancelled", "timed_out"]),
    testIds: z.array(z.string().min(1)),
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime(),
    durationMs: z.number().nonnegative(),
    exitCode: z.number().int().optional(),
    error: z.string().optional(),
  })
  .strict();

export const PlaywrightCompleteJobSchema = z
  .object({
    jobId: z.string().optional(),
    status: z.enum(["passed", "failed", "cancelled", "timed_out"]),
    browserResults: z.array(BrowserExecutionResultSchema).optional(),
    runnerResults: z.array(NativeGroupResultSchema).optional(),
    artifacts: z.array(TestArtifactSchema).optional(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
    error: z.string().optional(),
  })
  .strict();

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

export const PlaywrightHeartbeatSchema = z
  .object({
    observedAt: z.string().datetime(),
    browserResults: z.array(BrowserExecutionResultSchema).optional(),
  })
  .strict();

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
