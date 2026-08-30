export type RecipeLocator =
  | { kind: "role"; role: "button" | "link" | "textbox" | "heading" | "checkbox" | "combobox" | "option" | "radio"; name?: string; exact?: boolean }
  | { kind: "label"; text: string; exact?: boolean }
  | { kind: "text"; text: string; exact?: boolean }
  | { kind: "test-id"; id: string };

export type RecipeAction =
  | { kind: "goto"; url: string }
  | { kind: "fill"; target: RecipeLocator; value: string; isSecretEnv?: boolean }
  | { kind: "click"; target: RecipeLocator }
  | { kind: "select"; target: RecipeLocator; value: string }
  | { kind: "expect-visible"; target: RecipeLocator; timeoutMs?: number }
  | { kind: "expect-url"; url: string; matchType?: "exact" | "contains" }
  | { kind: "expect-text"; target: RecipeLocator; text: string }
  | { kind: "use-flow"; flowId: string };

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
