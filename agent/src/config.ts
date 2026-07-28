import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AgentConfig, ResolvedPreset } from "./types.js";

const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

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
});

export const AgentProjectSchema = z.object({
  id: z.string().regex(ID_REGEX),
  name: z.string().min(1),
  presets: z.array(AgentPresetSchema).min(1),
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

export async function loadAgentConfig(configPath: string): Promise<AgentConfig> {
  const absolutePath = path.resolve(configPath);
  const content = await fs.readFile(absolutePath, "utf-8");
  const raw = JSON.parse(content);
  return parseAgentConfig(raw);
}

export function resolveExecutable(command: string, platform = process.platform): string {
  if (platform === "win32") {
    const lower = command.toLowerCase();
    if ((lower === "npm" || lower === "npx") && !lower.endsWith(".cmd") && !lower.endsWith(".exe")) {
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
      const expanded = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
        const resolved = source[name];
        if (resolved == null) {
          throw new Error(`Missing environment variable ${name} for preset ${key}`);
        }
        return resolved;
      });
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

  const preset = project.presets.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`Preset ${presetId} not found in project ${projectId} configuration`);
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
  };
}

export function buildCatalogFromConfig(config: AgentConfig): import("./types.js").TestProjectCatalog {
  return {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    projects: config.projects.map((proj) => ({
      id: proj.id,
      name: proj.name,
      presets: proj.presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        commandPreview: `${preset.command} ${(preset.args || []).join(" ")}`.trim(),
        timeoutSeconds: preset.timeoutSeconds ?? 300,
      })),
    })),
  };
}
