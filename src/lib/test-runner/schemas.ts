import { z } from "zod";

// Legacy preset-runner API contract. Do not replace this module with the
// Playwright workspace schemas; the new runner owns its separate module at
// src/lib/playwright-runner/schemas.ts while migration routes still compile.

export const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SRS_ID_REGEX = /^(?:FR|BR|NFR)-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i;

export const PollRequestSchema = z
  .object({
    agentId: z.string().min(1).max(128),
    catalogVersion: z.string().min(1).max(64),
    catalog: z.any().optional(),
  })
  .strict();

export const CreateJobSchema = z
  .object({
    projectId: z.string().regex(ID_REGEX),
    presetId: z.string().regex(ID_REGEX),
  })
  .strict();

export const TestProgressSchema = z.object({
  framework: z.enum(["jest", "cypress", "vitest", "unknown"]),
  completed: z.number().int().nonnegative().nullable(),
  total: z.number().int().nonnegative().nullable(),
  percentage: z.number().int().min(0).max(100).nullable(),
  currentLabel: z.string().max(256).optional(),
  updatedAt: z.string().datetime(),
});

export const AppendLogBatchSchema = z
  .object({
    sequenceStart: z.number().int().nonnegative(),
    entries: z
      .array(
        z.object({
          stream: z.enum(["stdout", "stderr", "system"]),
          message: z.string().max(32768),
        }),
      )
      .min(1)
      .max(100),
    progress: TestProgressSchema.optional(),
  })
  .strict();

export const AgentHeartbeatSchema = z
  .object({
    observedAt: z.string().datetime(),
    progress: TestProgressSchema.optional(),
  })
  .strict();

export const CompleteJobSchema = z
  .object({
    jobId: z.string().optional(),
    status: z.enum(["passed", "failed", "cancelled", "timed_out"]),
    exitCode: z.number().int().nullable().optional(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
    error: z.string().max(4096).optional(),
  })
  .strict();

export const TestPresetMetadataSchema = z
  .object({
    category: z.enum(["automated", "execution", "uat"]),
    srsIds: z.array(z.string().regex(SRS_ID_REGEX, "SRS/BR ID must start with FR-, BR- or NFR-")),
    risk: z.enum(["safe", "mutating", "read-only"]),
    databaseTarget: z.enum(["none", "defaultdb", "production"]),
  })
  .superRefine((metadata, ctx) => {
    if (metadata.category === "execution" && (metadata.risk !== "mutating" || metadata.databaseTarget !== "defaultdb")) {
      ctx.addIssue({ code: "custom", message: "execution presets must be mutating and target defaultdb" });
    }
    if (metadata.category === "uat" && (metadata.risk !== "read-only" || metadata.databaseTarget !== "none")) {
      ctx.addIssue({ code: "custom", message: "uat presets must be read-only and have no database target" });
    }
    if (metadata.databaseTarget === "production" && metadata.risk === "mutating") {
      ctx.addIssue({ code: "custom", message: "mutating presets cannot target production" });
    }
  });

export const TestPresetSchema = z.object({
  id: z.string().regex(ID_REGEX),
  name: z.string().min(1).max(128),
  description: z.string().max(512).default(""),
  commandPreview: z.string().max(512),
  timeoutSeconds: z.number().int().min(1).max(1800),
  category: z.enum(["automated", "execution", "uat"]),
  srsIds: z.array(z.string().regex(SRS_ID_REGEX)),
  risk: z.enum(["safe", "mutating", "read-only"]),
  databaseTarget: z.enum(["none", "defaultdb", "production"]),
});

export const TestProjectSchema = z.object({
  id: z.string().regex(ID_REGEX),
  name: z.string().min(1).max(128),
  presets: z.array(TestPresetSchema).min(1),
});

export const TestProjectCatalogSchema = z.object({
  version: z.string().min(1).max(64),
  updatedAt: z.string().datetime(),
  projects: z.array(TestProjectSchema),
});
