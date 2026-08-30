import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AgentConfig, ResolvedPreset } from "./types.js";

const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SRS_ID_REGEX = /^(?:FR|BR|NFR)-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i;

export const TestPresetMetadataSchema = z
  .object({
    category: z.enum(["automated", "execution", "uat"]),
    srsIds: z.array(
      z
        .string()
        .regex(SRS_ID_REGEX, "SRS/BR ID must start with FR-, BR- or NFR-"),
    ),
    risk: z.enum(["safe", "mutating", "read-only"]),
    databaseTarget: z.enum(["none", "defaultdb", "production"]),
  })
  .superRefine((metadata, ctx) => {
    if (
      metadata.category === "execution" &&
      (metadata.risk !== "mutating" || metadata.databaseTarget !== "defaultdb")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "execution presets must be mutating and target defaultdb",
      });
    }
    if (
      metadata.category === "uat" &&
      (metadata.risk !== "read-only" || metadata.databaseTarget !== "none")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "uat presets must be read-only and have no database target",
      });
    }
    if (
      metadata.databaseTarget === "production" &&
      metadata.risk === "mutating"
    ) {
      ctx.addIssue({
        code: "custom",
        message: "mutating presets cannot target production",
      });
    }
  });

export const AgentPresetSchema = z.object({
  id: z.string().regex(ID_REGEX),
  name: z.string().min(1),
  description: z.string().default(""),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().refine((val) => path.isAbsolute(val), {
    message: "cwd must be an absolute path",
  }),
  env: z.record(z.string(), z.string()).default({}),
  timeoutSeconds: z.number().int().min(1).max(1800).default(300),
  metadata: TestPresetMetadataSchema,
});

export const AgentPlaywrightProjectSchema = z.object({
  enabled: z.boolean().default(true),
  workspaceRoot: z.string().refine((val) => path.isAbsolute(val), {
    message: "workspaceRoot must be an absolute path",
  }),
  testRoot: z.string().default("e2e"),
  config: z.string().optional(),
  allowedBrowsers: z.array(z.enum(["chromium", "firefox", "webkit"])).default(["chromium"]),
  allowHeaded: z.boolean().default(true),
  allowWorkspaceExecution: z.boolean().default(true),
  maxTimeoutSeconds: z.number().int().min(1).max(1800).default(600),
  envAllowlist: z.array(z.string()).default([]),
  allowedBaseUrls: z.array(z.string()).default([]),
}).superRefine((project, ctx) => {
  const root = path.resolve(project.workspaceRoot);
  for (const [field, value] of [["testRoot", project.testRoot], ["config", project.config]] as const) {
    if (!value) continue;
    if (path.isAbsolute(value)) {
      ctx.addIssue({ code: "custom", path: [field], message: `${field} must be relative to workspaceRoot` });
      continue;
    }
    const resolved = path.resolve(root, value);
    const relative = path.relative(root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      ctx.addIssue({ code: "custom", path: [field], message: `${field} must stay inside workspaceRoot` });
    }
  }
});

export const AgentProjectSchema = z
  .object({
    id: z.string().regex(ID_REGEX),
    name: z.string().min(1),
    presets: z.array(AgentPresetSchema).optional(),
    playwright: AgentPlaywrightProjectSchema.optional(),
  })
  .refine((p) => (p.presets && p.presets.length > 0) || Boolean(p.playwright), {
    message: "Project must configure at least one preset or a playwright section",
  });

export const AgentConfigSchema = z.object({
  agentId: z.string().min(1).max(128),
  serverUrl: z.string().url(),
  agentToken: z.string().min(16),
  pollIntervalSeconds: z.number().int().min(1).max(60).default(30),
  projects: z.array(AgentProjectSchema).min(1),
});

export function parseAgentConfig(raw: unknown): AgentConfig {
  return AgentConfigSchema.parse(raw);
}

export async function loadAgentConfig(
  configPath: string,
): Promise<AgentConfig> {
  const absolutePath = path.resolve(configPath);
  const content = await fs.readFile(absolutePath, "utf-8");
  const raw = JSON.parse(content);
  return parseAgentConfig(raw);
}

export function resolveExecutable(
  command: string,
  platform = process.platform,
): string {
  if (platform === "win32") {
    const lower = command.toLowerCase();
    if (
      (lower === "npm" || lower === "npx") &&
      !lower.endsWith(".cmd") &&
      !lower.endsWith(".exe")
    ) {
      return `${command}.cmd`;
    }
  }
  return command;
}

export function expandPresetEnvironment(
  env: Record<string, string>,
  source: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => {
      const expanded = value.replace(
        /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
        (_match, name: string) => {
          const resolved = source[name];
          if (resolved == null) {
            throw new Error(
              `Missing environment variable ${name} for preset ${key}`,
            );
          }
          return resolved;
        },
      );
      return [key, expanded];
    }),
  );
}

export function resolvePreset(
  config: AgentConfig,
  projectId: string,
  presetId: string,
): ResolvedPreset {
  const project = config.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found in agent config`);
  }

  const presets = project.presets || [];
  const preset = presets.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(
      `Preset ${presetId} not found in project ${projectId} configuration`,
    );
  }

  return {
    projectId: project.id,
    presetId: preset.id,
    name: preset.name,
    description: preset.description,
    command: preset.command,
    args: preset.args ?? [],
    cwd: preset.cwd,
    env: expandPresetEnvironment(preset.env ?? {}),
    timeoutSeconds: preset.timeoutSeconds ?? 300,
    metadata: preset.metadata,
  };
}

export function buildCatalogFromConfig(
  config: AgentConfig,
): import("./types.js").TestProjectCatalog {
  return {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    projects: config.projects
      .filter((proj) => proj.presets && proj.presets.length > 0)
      .map((proj) => ({
        id: proj.id,
        name: proj.name,
        presets: (proj.presets || []).map((preset) => ({
          id: preset.id,
          name: preset.name,
          description: preset.description,
          commandPreview: `${preset.command} ${(preset.args || []).join(" ")}`.trim(),
          timeoutSeconds: preset.timeoutSeconds ?? 300,
          category: preset.metadata.category,
          srsIds: [...preset.metadata.srsIds],
          risk: preset.metadata.risk,
          databaseTarget: preset.metadata.databaseTarget,
        })),
      })),
  };
}
