import "server-only";
import { z } from "zod";

export interface ResourceRef {
  id: string;
  label: string;
}

function parseResourceRefString(val: string | undefined, ctx: z.RefinementCtx): ResourceRef[] {
  if (!val || !val.trim()) return [];
  const items = val.split(",").map((item) => item.trim()).filter(Boolean);
  const result: ResourceRef[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const parts = item.split(":");
    const id = parts[0]?.trim();
    const label = parts.length > 1 ? parts.slice(1).join(":").trim() : id;

    if (!id || id.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Resource reference "${item}" is missing an ID`,
      });
      return z.NEVER;
    }

    if (/[\x00-\x1F\x7F]/.test(id) || /[\x00-\x1F\x7F]/.test(label)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Resource reference "${item}" contains control characters`,
      });
      return z.NEVER;
    }

    if (seenIds.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate resource ID "${id}" in provider config`,
      });
      return z.NEVER;
    }

    seenIds.add(id);
    result.push({ id, label: label || id });
  }

  return result;
}

const resourceRefSchema = z.string().optional().transform((val, ctx) => parseResourceRefString(val, ctx));

export const serverEnvSchema = z.object({
  GROUP_ACCESS_PASSWORD_HASH: z.string().min(1, "GROUP_ACCESS_PASSWORD_HASH is required"),
  SESSION_SIGNING_SECRET: z.string().min(48, "SESSION_SIGNING_SECRET must be at least 48 characters"),
  MONITOR_DISPLAY_NAME: z.string().default("Project Monitor"),
  VERCEL_API_TOKEN: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_PROJECT_IDS: resourceRefSchema,
  RENDER_API_KEY: z.string().optional(),
  RENDER_SERVICE_IDS: resourceRefSchema,
  AIVEN_API_TOKEN: z.string().optional(),
  AIVEN_PROJECT_NAME: z.string().optional(),
  AIVEN_SERVICE_NAMES: resourceRefSchema,
  CRONJOB_API_KEY: z.string().optional(),
  CRONJOB_JOB_IDS: resourceRefSchema,
  MONITORED_HEALTH_ENDPOINTS: resourceRefSchema,
  MONITOR_AGENT_INGEST_TOKEN: z.string().optional(),
  MONITOR_AGENT_PROJECT_ID: z.string().optional(),
  MONITOR_AGENT_BUFFER_SECONDS: z.coerce.number().default(60),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(env: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(env);
}

let cachedEnv: ServerEnv | null = null;

export function resetServerEnvCache(): void {
  cachedEnv = null;
}

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = parseServerEnv(process.env);
  }
  return cachedEnv;
}
