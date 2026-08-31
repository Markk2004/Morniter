import type { AutomationMap } from "./types.js";

export interface SourceAnalysisInput {
  sourceCode?: string;
  relativePath?: string;
  testTitle?: string;
  functionId?: string;
  functionName?: string;
  reusableFlows?: Array<{ id: string; name: string }>;
  map?: Partial<AutomationMap>;
}

export interface AnalyzedStepCandidate {
  kind: "goto" | "click" | "fill" | "assert" | "use-flow" | "wait";
  url?: string;
  target?: string;
  value?: string;
  flowId?: string;
  assertionKind?: "role-visible" | "heading-visible" | "text-visible" | "url-matches";
  assertionRole?: "button" | "heading" | "link" | "textbox" | "alert" | "status";
  assertionName?: string;
  assertionValue?: string;
  evidence?: string;
  confidence?: "high" | "medium" | "low";
  reviewRequired?: boolean;
}

export interface SourceAnalysisResult {
  title: string;
  functionId?: string;
  suggestedOutput: string;
  risk: "read-only" | "mutating";
  actions: AnalyzedStepCandidate[];
  summary: {
    extractedRoutes: string[];
    extractedLocators: string[];
    extractedAssertions: string[];
    flowSuggested?: string;
    overallConfidence: "high" | "medium" | "low";
  };
}

export function analyzeSourceForPlaywrightDraft(
  input: SourceAnalysisInput,
): SourceAnalysisResult {
  const source = input.sourceCode || "";
  const cleanTitle = input.testTitle || input.functionName || "New Automated Test";
  const fnId = input.functionId || "general";
  const fnSlug = fnId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const titleSlug =
    cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "custom-test";

  const suggestedOutput = `frontend/e2e/generated/${fnSlug}/${titleSlug}.spec.ts`;

  const extractedRoutes: string[] = [];
  const extractedLocators: string[] = [];
  const extractedAssertions: string[] = [];
  const actions: AnalyzedStepCandidate[] = [];

  // 1. Check for Reusable Flow (e.g. Login Flow)
  const isAuthRequired =
    fnId.toLowerCase().includes("auth") ||
    fnId.toLowerCase().includes("fn-sts-01") ||
    cleanTitle.toLowerCase().includes("auth") ||
    cleanTitle.toLowerCase().includes("login") ||
    cleanTitle.toLowerCase().includes("protected") ||
    cleanTitle.toLowerCase().includes("profile") ||
    cleanTitle.toLowerCase().includes("admin") ||
    source.toLowerCase().includes("auth") ||
    source.toLowerCase().includes("bearer");

  let flowSuggested: string | undefined;
  const flows = input.reusableFlows || (input.map?.reusableFlows as Array<{ id: string; name: string }> | undefined);
  if (isAuthRequired && flows && flows.length > 0) {
    const loginFlow = flows.find(
      (f) => typeof f?.id === "string" && (f.id.includes("login") || f.id.includes("auth")),
    );
    if (loginFlow) {
      flowSuggested = loginFlow.id;
      actions.push({
        kind: "use-flow",
        flowId: loginFlow.id,
        evidence: `Suggested flow '${loginFlow.name}' for authenticated function ${fnId}`,
        confidence: "high",
      });
    }
  }

  // 2. Extract Route Candidates
  const routeRegexes = [
    /page\.goto\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /pushState\([^,]+,[^,]+,\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /router\.push\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /fetch\(\s*["'`]([^"'`]+)["'`]/g,
    /(?:get|post|put|delete|patch)\(\s*["'`]([^"'`]+)["'`]/g,
    /request\([^)]*\)\s*\.\s*(?:get|post|put|delete|patch)\(\s*["'`]([^"'`]+)["'`]/g,
  ];

  for (const regex of routeRegexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const url = match[1];
      if (url && url.startsWith("/") && !extractedRoutes.includes(url)) {
        extractedRoutes.push(url);
      }
    }
  }

  if (extractedRoutes.length > 0) {
    actions.push({
      kind: "goto",
      url: extractedRoutes[0],
      evidence: `Extracted route '${extractedRoutes[0]}' from source code`,
      confidence: "high",
    });
  } else {
    // Check if there is a known route pattern
    const fallbackRoute = `/${fnSlug.replace(/^fn-/, "").replace(/-\d+$/, "")}`;
    actions.push({
      kind: "goto",
      url: fallbackRoute,
      evidence: "Suggested base route from function metadata (Review required)",
      confidence: "low",
      reviewRequired: true,
    });
  }

  // 3. Extract Locators & Form Interactions
  const fillRegex = /getByLabel\(\s*["'`]([^"'`]+)["'`]\s*\)\.fill\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  let fillMatch: RegExpExecArray | null;
  while ((fillMatch = fillRegex.exec(source)) !== null) {
    const label = fillMatch[1];
    const val = fillMatch[2];
    extractedLocators.push(label);
    actions.push({
      kind: "fill",
      target: `input[aria-label='${label}']`,
      value: val,
      evidence: `Extracted fill action on label '${label}'`,
      confidence: "high",
    });
  }

  const clickRegex = /(?:fireEvent\.click|userEvent\.click|click)\([^)]*getByRole\(\s*["'`]([^"'`]+)["'`],\s*\{\s*name:\s*["'`]([^"'`]+)["'`]\s*\}\)/g;
  let clickMatch: RegExpExecArray | null;
  while ((clickMatch = clickRegex.exec(source)) !== null) {
    const role = clickMatch[1];
    const name = clickMatch[2];
    extractedLocators.push(`${role}:${name}`);
    actions.push({
      kind: "click",
      target: `role=${role}[name='${name}']`,
      evidence: `Extracted click on ${role} '${name}'`,
      confidence: "high",
    });
  }

  // 4. Extract Assertions
  // Heading assertions
  const headingRegex = /(?:getByRole\(\s*["'`]heading["'`],\s*\{\s*name:\s*["'`]([^"'`]+)["'`]\s*\}|screen\.getByText\(\s*["'`]([^"'`]+)["'`]\s*\))/g;
  let assertMatch: RegExpExecArray | null;
  while ((assertMatch = headingRegex.exec(source)) !== null) {
    const name = assertMatch[1] || assertMatch[2];
    if (name && !extractedAssertions.includes(name)) {
      extractedAssertions.push(name);
      if (assertMatch[1]) {
        actions.push({
          kind: "assert",
          assertionKind: "heading-visible",
          assertionName: name,
          evidence: `Extracted heading assertion for '${name}'`,
          confidence: "high",
        });
      } else {
        actions.push({
          kind: "assert",
          assertionKind: "text-visible",
          assertionName: name,
          evidence: `Extracted text visibility assertion for '${name}'`,
          confidence: "high",
        });
      }
    }
  }

  // HTTP status assertion
  if (/expect\([^)]*status[^)]*\)\.toBe\(20\d\)/.test(source)) {
    if (extractedRoutes.length > 0) {
      actions.push({
        kind: "assert",
        assertionKind: "url-matches",
        assertionValue: extractedRoutes[0],
        evidence: "HTTP 20x response expected on route",
        confidence: "medium",
      });
    }
  }

  // If no assertions found, add fallback assertion
  if (extractedAssertions.length === 0) {
    actions.push({
      kind: "assert",
      assertionKind: "heading-visible",
      assertionName: cleanTitle,
      evidence: `Expected heading assertion for '${cleanTitle}' (Review required)`,
      confidence: "low",
      reviewRequired: true,
    });
  }

  // 5. Determine Risk
  const isMutating =
    /(?:post|put|delete|patch|mutation|create|update|remove|destroy)/i.test(source) ||
    cleanTitle.toLowerCase().includes("create") ||
    cleanTitle.toLowerCase().includes("delete") ||
    cleanTitle.toLowerCase().includes("update");

  const risk = isMutating ? "mutating" : "read-only";

  // If mutating, add a cleanup placeholder requiring review
  if (isMutating) {
    actions.push({
      kind: "click",
      target: "button:has-text('Delete')",
      evidence: "Required cleanup step for mutating action (Review required)",
      confidence: "medium",
      reviewRequired: true,
    });
  }

  const overallConfidence =
    actions.every((a) => a.confidence === "high") && actions.length >= 2
      ? "high"
      : actions.some((a) => a.confidence === "high")
        ? "medium"
        : "low";

  return {
    title: cleanTitle,
    functionId: input.functionId,
    suggestedOutput,
    risk,
    actions,
    summary: {
      extractedRoutes,
      extractedLocators,
      extractedAssertions,
      flowSuggested,
      overallConfidence,
    },
  };
}
