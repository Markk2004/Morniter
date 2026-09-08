import path from "node:path";
import { z } from "zod";

const ID_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const LocalProjectSchema = z.object({
  id: z.string().regex(ID_REGEX),
  name: z.string().min(1).max(120),
  workspaceRoot: z.string().refine(path.isAbsolute, "workspaceRoot must be absolute"),
  testRoot: z.string().min(1).default("e2e"),
  config: z.string().optional(),
  automationMap: z.string().optional(),
  allowedBrowsers: z.array(z.enum(["chromium", "firefox", "webkit"])).default(["chromium"]),
  allowHeaded: z.boolean().default(true),
  allowWorkspaceExecution: z.boolean().default(true),
  maxTimeoutSeconds: z.number().int().min(1).max(1800).default(600),
  envAllowlist: z.array(z.string()).default([]),
  allowedBaseUrls: z.array(z.string()).default([]),
}).superRefine((project, ctx) => {
  const root = path.resolve(project.workspaceRoot);
  for (const [field, value] of [["testRoot", project.testRoot], ["config", project.config], ["automationMap", project.automationMap]] as const) {
    if (!value || path.isAbsolute(value)) {
      if (value && path.isAbsolute(value)) ctx.addIssue({ code: "custom", path: [field], message: `${field} must be relative` });
      continue;
    }
    const relative = path.relative(root, path.resolve(root, value));
    if (relative.startsWith("..") || path.isAbsolute(relative)) ctx.addIssue({ code: "custom", path: [field], message: `${field} escapes workspaceRoot` });
  }
});

export const DesktopAgentSettingsSchema = z.object({
  version: z.literal(1),
  serverUrl: z.string().url().refine((value) => value.startsWith("https://") || value.startsWith("http://localhost"), "serverUrl must use HTTPS"),
  agentId: z.string().regex(ID_REGEX),
  deviceId: z.string().uuid(),
  startWithWindows: z.boolean().default(true),
  projects: z.array(LocalProjectSchema).min(1).max(20),
}).strict();

export type DesktopAgentSettings = z.infer<typeof DesktopAgentSettingsSchema>;
export type LocalProject = z.infer<typeof LocalProjectSchema>;
