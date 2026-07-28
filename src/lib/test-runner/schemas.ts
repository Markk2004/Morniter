import { z } from "zod";

export const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const CreateJobSchema = z
  .object({
    projectId: z
      .string()
      .regex(ID_REGEX, "projectId must consist of lowercase letters, digits, and hyphens"),
    presetId: z
      .string()
      .regex(ID_REGEX, "presetId must consist of lowercase letters, digits, and hyphens"),
  })
  .strict();

export type CreateJobInput = z.infer<typeof CreateJobSchema>;

export const PollRequestSchema = z
  .object({
    agentId: z.string().min(1).max(128),
    catalogVersion: z.string().optional(),
    catalog: z.unknown().optional(),
  })
  .strict();

export type PollRequestInput = z.infer<typeof PollRequestSchema>;

export const AppendLogsSchema = z
  .object({
    jobId: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    stream: z.enum(["stdout", "stderr", "system"]),
    lines: z.array(z.string()),
  })
  .strict();

export type AppendLogsInput = z.infer<typeof AppendLogsSchema>;

export const CompleteJobSchema = z
  .object({
    jobId: z.string().min(1),
    status: z.enum(["passed", "failed", "cancelled", "timed_out"]),
    exitCode: z.number().int().nullable().optional(),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    error: z.string().optional(),
  })
  .strict();

export type CompleteJobInput = z.infer<typeof CompleteJobSchema>;
