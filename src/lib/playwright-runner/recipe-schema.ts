import { z } from "zod";

export const RecipeLocatorSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("role"),
    role: z.enum(["button", "link", "textbox", "heading", "checkbox", "combobox", "option", "radio"]),
    name: z.string().optional(),
    exact: z.boolean().optional(),
  }).strict(),
  z.object({
    kind: z.literal("label"),
    text: z.string().min(1),
    exact: z.boolean().optional(),
  }).strict(),
  z.object({
    kind: z.literal("text"),
    text: z.string().min(1),
    exact: z.boolean().optional(),
  }).strict(),
  z.object({
    kind: z.literal("test-id"),
    id: z.string().min(1),
  }).strict(),
]);

export const RecipeActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("goto"),
    url: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("fill"),
    target: RecipeLocatorSchema,
    value: z.string().min(1),
    isSecretEnv: z.boolean().optional(),
  }).strict(),
  z.object({
    kind: z.literal("click"),
    target: RecipeLocatorSchema,
  }).strict(),
  z.object({
    kind: z.literal("select"),
    target: RecipeLocatorSchema,
    value: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("expect-visible"),
    target: RecipeLocatorSchema,
    timeoutMs: z.number().int().positive().optional(),
  }).strict(),
  z.object({
    kind: z.literal("expect-url"),
    url: z.string().min(1),
    matchType: z.enum(["exact", "contains"]).optional(),
  }).strict(),
  z.object({
    kind: z.literal("expect-text"),
    target: RecipeLocatorSchema,
    text: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("use-flow"),
    flowId: z.string().min(1),
  }).strict(),
]);

export const ReusableFlowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  actions: z.array(RecipeActionSchema).min(1),
}).strict();

export const RecipeDraftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  sourceTestId: z.string().optional(),
  sourceRelativePath: z.string().optional(),
  functionId: z.string().min(1),
  output: z.string().min(1),
  risk: z.enum(["read-only", "mutating"]),
  actions: z.array(RecipeActionSchema).min(1),
  cleanupActions: z.array(RecipeActionSchema).optional(),
}).strict().superRefine((data, ctx) => {
  if (data.risk === "mutating") {
    if (!data.cleanupActions || data.cleanupActions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mutating recipes must define cleanupActions",
        path: ["cleanupActions"],
      });
    }
  }
});
