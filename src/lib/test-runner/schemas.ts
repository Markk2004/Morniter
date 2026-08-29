import { z } from "zod";

// Legacy preset-runner API contract. Do not replace this module with the
// Playwright workspace schemas; the new runner owns its separate module at
// src/lib/playwright-runner/schemas.ts while migration routes still compile.

export const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SRS_ID_REGEX = /^(?:FR|BR|NFR)-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i;

export const TestPresetMetadataSchema = z
  .object({
    category: z.enum(["automated", "execution", "uat"]),
    srsIds: z.array(z.string().regex(SRS_ID_REGEX)),
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

export const TestPresetSchema = z
  .object({
    id: z.string().regex(ID_REGEX),
    name: z.string().min(1).max(128),
    description: z.string().max(500),
    commandPreview: z.string().min(1).max(256),
    timeoutSeconds: z.number().int().min(1).max(1800),
    category: z.enum(["automated", "execution", "uat"]),
    srsIds: z.array(z.string().regex(SRS_ID_REGEX)),
    risk: z.enum(["safe", "mutating", "read-only"]),
    databaseTarget: z.enum(["none", "defaultdb", "production"]),
  })
  .superRefine((preset, ctx) => {
    if (preset.category === "execution" && (preset.risk !== "mutating" || preset.databaseTarget !== "defaultdb")) {
      ctx.addIssue({ code: "custom", message: "execution presets must be mutating and target defaultdb" });
    }
    if (preset.category === "uat" && (preset.risk !== "read-only" || preset.databaseTarget !== "none")) {
      ctx.addIssue({ code: "custom", message: "uat presets must be read-only and have no database target" });
    }
    if (preset.databaseTarget === "production" && preset.risk === "mutating") {
      ctx.addIssue({ code: "custom", message: "mutating presets cannot target production" });
    }
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

export const CreateJobSchema = z
  .object({
    projectId: z
      .string()
      .regex(ID_REGEX, "projectId must consist of lowercase letters, digits, and hyphens"),
    presetId: z
      .string()
      .regex(ID_REGEX, "presetId must consist of lowercase letters, digits, and hyphens"),
    agentId: z.string().min(1).max(128).optional(),
  })
  .strict();

export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export const TestProgressSchema = z.object({
  framework: z.enum(["jest", "cypress", "vitest", "unknown"]),
  completed: z.number().int().nonnegative().nullable(),
  total: z.number().int().positive().nullable(),
  percentage: z.number().min(0).max(100).nullable(),
  currentLabel: z.string().max(300).optional(),
  updatedAt: z.string().datetime(),
});

export type TestProgressInput = z.infer<typeof TestProgressSchema>;

export const PollRequestSchema = z
  .object({
    agentId: z.string().min(1).max(128),
    catalogVersion: z.string().min(1).max(64),
    catalog: TestProjectCatalogSchema.optional(),
  })
  .strict();

export type PollRequestInput = z.infer<typeof PollRequestSchema>;

export const AgentHeartbeatSchema = z
  .object({
    observedAt: z.string().datetime(),
    progress: TestProgressSchema.optional(),
  })
  .strict();

export type AgentHeartbeatInput = z.infer<typeof AgentHeartbeatSchema>;

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

export type AppendLogBatchInput = z.infer<typeof AppendLogBatchSchema>;

export const CompleteJobSchema = z
  .object({
    jobId: z.string().optional(),
    status: z.enum(["passed", "failed", "cancelled", "timed_out"]),
    exitCode: z.number().int().nullable().optional(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
    error: z.string().optional(),
  })
  .strict();

export type CompleteJobInput = z.infer<typeof CompleteJobSchema>;
