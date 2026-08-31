export type TestCategory = "automated" | "execution" | "uat";
export type TestRisk = "safe" | "mutating" | "read-only";
export type DatabaseTarget = "none" | "defaultdb" | "production";

export interface TestPresetMetadata {
  category: TestCategory;
  srsIds: string[];
  risk: TestRisk;
  databaseTarget: DatabaseTarget;
}

export interface AgentPresetConfig {
  id: string;
  name: string;
  description: string;
  command: string;
  args?: string[];
  cwd: string;
  env?: Record<string, string>;
  timeoutSeconds?: number;
  metadata: TestPresetMetadata;
}

export interface AgentPlaywrightProjectConfig {
  enabled?: boolean;
  workspaceRoot: string;
  testRoot?: string;
  config?: string;
  automationMap?: string;
  generateMissingTests?: boolean;
  allowedBrowsers?: ("chromium" | "firefox" | "webkit")[];
  allowHeaded?: boolean;
  allowWorkspaceExecution?: boolean;
  maxTimeoutSeconds?: number;
  envAllowlist?: string[];
  allowedBaseUrls?: string[];
}

export interface AgentProjectConfig {
  id: string;
  name: string;
  presets?: AgentPresetConfig[];
  playwright?: AgentPlaywrightProjectConfig;
}

export type BrowserName = "chromium" | "firefox" | "webkit";
export type RunMode = "headless" | "headed";

export interface BrowserExecutionResult {
  browser: BrowserName;
  status: "waiting" | "running" | "passed" | "failed" | "cancelled";
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
}

export interface PlaywrightTestDescriptor {
  id: string;
  title: string;
  group: string;
  relativePath: string;
  line?: number;
  tags?: string[];
}

export type NativeRunner = "playwright" | "generated-playwright" | "node-test" | "jest" | "jest-e2e";
export type DiscoveredTestRunner = NativeRunner;
export type TestOrigin = "manual" | "generated";
export type MatchMethod = "explicit" | "source-id" | "path" | "title" | "keyword" | "unmatched";

export interface RunnerProfile {
  id: string;
  runner: NativeRunner;
  workingDirectory: string;
  config?: string;
  envAllowlist?: string[];
}

export interface AutomationScanRoot {
  path: string;
  runner: Exclude<NativeRunner, "generated-playwright">;
  executionProfileId?: string;
  executable: boolean;
}

export interface AutomationFunctionRule {
  id: string;
  name: string;
  keywords: string[];
}

export interface AutomationRecipeAssertion {
  kind: "role-visible" | "heading-visible" | "text-visible" | "url-matches";
  role?: "button" | "link" | "textbox";
  name?: string;
  value?: string;
}

export interface AutomationRecipe {
  id: string;
  output: string;
  route: string;
  assertions: AutomationRecipeAssertion[];
}

export interface AutomationCoverageTarget {
  id: string;
  functionId: string;
  title: string;
  automation: "playwright" | "unsupported";
  recipeId?: string;
}

export interface TestTargetConfig {
  id: string;
  label: string;
  baseUrl: string;
  allowMutating: boolean;
}

export interface CatalogTestTarget {
  id: string;
  label: string;
  allowMutating: boolean;
}

export interface AutomationMap {
  version: 1 | 2;
  projectId: string;
  testTarget?: TestTargetConfig;
  runnerProfiles?: RunnerProfile[];
  scanRoots: AutomationScanRoot[];
  excludeDirectories: string[];
  generatedRoot: string;
  functions: AutomationFunctionRule[];
  explicitMappings: Array<{ path: string; functionId: string }>;
  coverageTargets: AutomationCoverageTarget[];
  recipes: AutomationRecipe[];
  reusableFlows?: Array<{ id: string; name: string; description?: string; actions?: unknown[] }>;
  productionHostDenylist?: string[];
}

export interface DiscoveredProjectTest {
  id: string;
  relativePath: string;
  title: string;
  runner: DiscoveredTestRunner;
  executionProfileId?: string;
  executable: boolean;
  origin: TestOrigin;
  sourceIds: string[];
  searchText: string;
}

export interface MatchedProjectTest extends DiscoveredProjectTest {
  functionId: string;
  functionName: string;
  matchedBy: MatchMethod[];
  confidence: "high" | "medium" | "low";
  score: number;
}

export interface CoverageGap {
  targetId: string;
  functionId: string;
  title: string;
  status: "missing-recipe" | "ready-to-generate" | "unsupported" | "stale-generated";
  recipeId?: string;
}

export interface UatFunctionCoverage {
  id: string;
  name: string;
  tests: MatchedProjectTest[];
  gaps: CoverageGap[];
}

export type CatalogTestRunner = DiscoveredTestRunner;

export interface ProjectCoverageTest {
  id: string;
  title: string;
  relativePath: string;
  runner: CatalogTestRunner;
  executionProfileId?: string;
  executable: boolean;
  risk?: "read-only" | "mutating";
  origin: TestOrigin;
  confidence: "high" | "medium" | "low";
  matchedBy: MatchMethod[];
}

export interface ProjectCoverageGap {
  targetId: string;
  title: string;
  status: CoverageGap["status"];
}

export interface ProjectCoverageGroup {
  id: string;
  name: string;
  functionId?: string;
  functionName?: string;
  tests: ProjectCoverageTest[];
  gaps: ProjectCoverageGap[];
}

export interface PlaywrightProjectCatalog {
  id: string;
  name: string;
  mapRevision?: string;
  testTarget?: CatalogTestTarget;
  rootLabel?: string;
  capabilities?: {
    browsers?: {
      chromium?: boolean;
      firefox?: boolean;
      webkit?: boolean;
    };
    headed?: boolean;
    workspaceExecution?: boolean;
  };
  runnerProfiles?: RunnerProfile[];
  testGroups?: {
    name: string;
    tests: PlaywrightTestDescriptor[];
  }[];
  tests?: PlaywrightTestDescriptor[];
  /** Agent-to-server source cache keyed once per relative test file. */
  sourceByPath?: Record<string, string>;
  scanPathLabel?: string;
  coverageGroups?: ProjectCoverageGroup[];
}

export interface PlaywrightCatalog {
  version: string;
  updatedAt: string;
  projects: PlaywrightProjectCatalog[];
}

export interface NativeGroupResult {
  runner: NativeRunner;
  executionProfileId: string;
  status: "passed" | "failed" | "cancelled" | "timed_out";
  testIds: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode?: number;
  error?: string;
}

export interface PlaywrightJob {
  id: string;
  agentId: string;
  projectId: string;
  source: "project-test" | "workspace";
  testIds?: string[];
  code?: string;
  risk?: "read-only" | "mutating";
  recipeId?: string;
  browsers: BrowserName[];
  mode: RunMode;
  status: "queued" | "claimed" | "preparing" | "running" | "passed" | "failed" | "cancel_requested" | "cancelled" | "timed_out";
  browserResults: BrowserExecutionResult[];
  runnerResults?: NativeGroupResult[];
  lastHeartbeatAt?: string;
  cancelRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  artifacts?: Array<{
    id: string;
    jobId: string;
    type: "trace" | "screenshot" | "video" | "report";
    browser?: BrowserName;
    testId?: string;
    filename: string;
    size: number;
    downloadUrl?: string;
    createdAt: string;
  }>;
  error?: string;
}

export interface PlaywrightExecutionResult {
  status: "passed" | "failed" | "cancelled" | "timed_out";
  browserResults: BrowserExecutionResult[];
  runnerResults?: NativeGroupResult[];
  artifacts?: Array<{
    id: string;
    jobId: string;
    type: "trace" | "screenshot" | "video" | "report";
    browser?: BrowserName;
    testId?: string;
    filename: string;
    size: number;
    downloadUrl?: string;
    createdAt: string;
  }>;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  truncated: boolean;
  error?: string;
}

export interface RecipeSaveMutation {
  id: string;
  agentId: string;
  projectId: string;
  baseRevision: string;
  recipe: import("./recipe-renderer.js").RecipeDraft;
  verifiedJobId?: string;
  renderedCodeHash?: string;
  leaseToken?: string;
  claimedAt?: string;
  leaseExpiresAt?: string;
  status: "queued" | "claimed" | "succeeded" | "conflict" | "rejected" | "failed";
  newRevision?: string;
  writtenFiles?: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AgentConfig {
  agentId: string;
  serverUrl: string;
  agentToken: string;
  pollIntervalSeconds?: number;
  projects: AgentProjectConfig[];
}

export interface ResolvedPreset {
  projectId: string;
  presetId: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeoutSeconds: number;
  metadata: TestPresetMetadata;
}

export type TestJobStatus =
  | "queued"
  | "claimed"
  | "running"
  | "passed"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "timed_out"
  | "agent_lost";

export type TestFramework = "jest" | "cypress" | "vitest" | "unknown";

export interface TestProgress {
  framework: TestFramework;
  completed: number | null;
  total: number | null;
  percentage: number | null;
  currentLabel?: string;
  updatedAt: string;
}

export interface ExecutionResult {
  status: "passed" | "failed" | "cancelled" | "timed_out";
  exitCode: number | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  truncated: boolean;
  error?: string;
}

export interface TestPreset {
  id: string;
  name: string;
  description: string;
  commandPreview: string;
  timeoutSeconds: number;
  category: TestCategory;
  srsIds: string[];
  risk: TestRisk;
  databaseTarget: DatabaseTarget;
}

export interface TestProject {
  id: string;
  name: string;
  presets: TestPreset[];
}

export interface TestProjectCatalog {
  version: string;
  updatedAt: string;
  projects: TestProject[];
}

export interface TestJob {
  id: string;
  idempotencyKey: string;
  agentId: string;
  projectId: string;
  presetId: string;
  presetName: string;
  category: TestCategory;
  srsIds: string[];
  risk: TestRisk;
  databaseTarget: DatabaseTarget;
  status: TestJobStatus;
  queuedAt: string;
  claimedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  leaseExpiresAt?: string;
  lastHeartbeatAt?: string;
  progress?: TestProgress;
  exitCode?: number | null;
  cancelRequested?: boolean;
  truncated?: boolean;
  logBytes?: number;
  logLines?: number;
  error?: string;
}
