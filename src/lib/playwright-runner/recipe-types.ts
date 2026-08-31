export type RecipeLocator =
  | { kind: "role"; role: "button" | "link" | "textbox" | "heading" | "checkbox" | "combobox" | "option" | "radio"; name?: string; exact?: boolean }
  | { kind: "label"; text: string; exact?: boolean }
  | { kind: "text"; text: string; exact?: boolean }
  | { kind: "test-id"; id: string };

export type RecipeAction =
  | { kind: "goto"; url: string; evidence?: string; confidence?: "high" | "medium" | "low" }
  | { kind: "fill"; target: RecipeLocator; value: string; isSecretEnv?: boolean; evidence?: string; confidence?: "high" | "medium" | "low" }
  | { kind: "click"; target: RecipeLocator; evidence?: string; confidence?: "high" | "medium" | "low" }
  | { kind: "select"; target: RecipeLocator; value: string; evidence?: string; confidence?: "high" | "medium" | "low" }
  | { kind: "expect-visible"; target: RecipeLocator; timeoutMs?: number; evidence?: string; confidence?: "high" | "medium" | "low" }
  | { kind: "expect-url"; url: string; matchType?: "exact" | "contains"; evidence?: string; confidence?: "high" | "medium" | "low" }
  | { kind: "expect-text"; target: RecipeLocator; text: string; evidence?: string; confidence?: "high" | "medium" | "low" }
  | { kind: "use-flow"; flowId: string; evidence?: string; confidence?: "high" | "medium" | "low" };

export interface ReusableFlow {
  id: string;
  name: string;
  description?: string;
  actions: RecipeAction[];
}

export interface RecipeDraft {
  id: string;
  title: string;
  description?: string;
  sourceTestId?: string;
  sourceRelativePath?: string;
  functionId: string;
  output: string;
  risk: "read-only" | "mutating";
  actions: RecipeAction[];
  cleanupActions?: RecipeAction[];
}

export interface RecipeValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}
