import { z } from "zod";

export const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const BrowserSchema = z.enum(["chromium", "firefox", "webkit"]);

export const RunModeSchema = z.enum(["headless", "headed"]);

export const PlaywrightTestDescriptorSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  group: z.string().min(1).max(128),
  relativePath: z.string().min(1).max(512),
  line: z.number().int().positive().optional(),
  tags: z.array(z.string().min(1).max(64)).optional(),
});

export const PlaywrightProjectCatalogSchema = z.object({
  id: z.string().regex(ID_REGEX),
  name: z.string().min(1).max(128),
  rootLabel: z.string().max(256).optional(),
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
  testGroups: z
    .array(
      z.object({
        name: z.string().min(1).max(128),
        tests: z.array(PlaywrightTestDescriptorSchema),
      }),
    )
    .optional(),
  tests: z.array(PlaywrightTestDescriptorSchema).optional(),
});

export const PlaywrightCatalogSchema = z.object({
  version: z.string().min(1).max(64),
  updatedAt: z.string().datetime(),
  projects: z.array(PlaywrightProjectCatalogSchema),
});

const BasePlaywrightJobRequestSchema = z.object({
  projectId: z.string().regex(ID_REGEX),
  browsers: z.array(BrowserSchema).min(1).max(3),
  mode: RunModeSchema,
  idempotencyKey: z.string().min(8).max(128).optional(),
  agentId: z.string().min(1).max(128).optional(),
});

export const ExistingTestPlaywrightJobRequestSchema = BasePlaywrightJobRequestSchema.extend({
  source: z.literal("project-test"),
  testIds: z.array(z.string().min(1).max(128)).min(1).max(50),
}).strict();

export const WorkspacePlaywrightJobRequestSchema = BasePlaywrightJobRequestSchema.extend({
  source: z.literal("workspace"),
  code: z.string().min(1).max(200_000),
}).strict();

export const PlaywrightJobRequestSchema = z.discriminatedUnion("source", [
  ExistingTestPlaywrightJobRequestSchema,
  WorkspacePlaywrightJobRequestSchema,
]);

export type PlaywrightJobRequestInput = z.infer<typeof PlaywrightJobRequestSchema>;

export const BrowserExecutionResultSchema = z.object({
  browser: BrowserSchema,
  status: z.enum(["waiting", "running", "passed", "failed", "cancelled"]),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative().optional(),
});

export const TestArtifactSchema = z.object({
  id: z.string().min(1).max(128),
  jobId: z.string().min(1).max(128),
  type: z.enum(["trace", "screenshot", "video", "report"]),
  browser: BrowserSchema.optional(),
  testId: z.string().max(128).optional(),
  filename: z.string().min(1).max(256),
  size: z.number().int().nonnegative(),
  downloadUrl: z.string().max(512).optional(),
  createdAt: z.string().datetime(),
});

export const PlaywrightPollRequestSchema = z
  .object({
    agentId: z.string().min(1).max(128),
    catalogVersion: z.string().min(1).max(64),
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

export type PlaywrightPollRequestInput = z.infer<typeof PlaywrightPollRequestSchema>;

export const PlaywrightHeartbeatSchema = z
  .object({
    observedAt: z.string().datetime(),
    browserResults: z.array(BrowserExecutionResultSchema).optional(),
  })
  .strict();

export const PlaywrightLogEntrySchema = z.object({
  stream: z.enum(["stdout", "stderr", "system"]),
  message: z.string().max(32768),
  browser: BrowserSchema.optional(),
});

export const AppendPlaywrightLogBatchSchema = z
  .object({
    sequenceStart: z.number().int().nonnegative(),
    entries: z.array(PlaywrightLogEntrySchema).min(1).max(100),
    browserResults: z.array(BrowserExecutionResultSchema).optional(),
  })
  .strict();

export type AppendPlaywrightLogBatchInput = z.infer<typeof AppendPlaywrightLogBatchSchema>;

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

export type PlaywrightCompleteJobInput = z.infer<typeof PlaywrightCompleteJobSchema>;

export function sanitizeBrowsers(browsers: z.infer<typeof BrowserSchema>[]): z.infer<typeof BrowserSchema>[] {
  return [...new Set(browsers)];
}
