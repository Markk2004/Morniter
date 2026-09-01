"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type {
  BrowserName,
  PlaywrightCatalog,
  PlaywrightJob,
  PlaywrightProjectCatalog,
  PlaywrightSource,
  RunMode,
  BrowserExecutionResult,
} from "@/lib/playwright-runner/types";
import type { TestLogLine, AgentPresence } from "@/lib/test-runner/types";
import type { RecipeDraft, ReusableFlow, RecipeAction } from "@/lib/playwright-runner/recipe-types";
import { renderRecipeToPlaywrightCode } from "@/lib/playwright-runner/recipe-renderer";
import { analyzeSourceForPlaywrightDraft } from "@/lib/playwright-runner/source-analyzer";

const DEFAULT_WORKSPACE_CODE = `import { test, expect } from "@playwright/test";

test("Basic sanity check", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await expect(page).toHaveTitle(/.*Monitor.*/i);
});
`;

async function computeSha256Hex(text: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "";
}

export interface UsePlaywrightRunnerResult {
  catalog: PlaywrightCatalog | null;
  projects: PlaywrightProjectCatalog[];
  currentProject: PlaywrightProjectCatalog | null;
  presence: AgentPresence | null;
  isUnlocked: boolean;
  selectedProjectId: string | null;
  source: PlaywrightSource;
  selectedTestIds: string[];
  selectedBrowsers: BrowserName[];
  runMode: RunMode;
  editorCode: string;
  editorDirty: boolean;
  activeJob: PlaywrightJob | null;
  terminalLines: TestLogLine[];
  history: PlaywrightJob[];
  browserResults: BrowserExecutionResult[];
  loadingCatalog: boolean;
  catalogError: boolean;
  isSubmitting: boolean;
  isJobRunning: boolean;
  canRun: boolean;
  browserCapabilities: {
    chromium?: boolean;
    firefox?: boolean;
    webkit?: boolean;
  };
  headedAvailable: boolean;
  isRecipeBuilderOpen: boolean;
  recipeDraft: RecipeDraft | null;
  reusableFlows: ReusableFlow[];
  isDraftVerified: boolean;
  isSavingRecipe: boolean;
  saveRecipeError: string | null;
  saveRecipeSuccess: boolean;
  runError: string | null;

  selectProject: (id: string) => void;
  setSource: (source: PlaywrightSource) => void;
  toggleTest: (id: string) => void;
  selectAllTests: () => void;
  deselectAllTests: () => void;
  toggleBrowser: (browser: BrowserName) => void;
  setRunMode: (mode: RunMode) => void;
  setEditorCode: (code: string) => void;
  resetEditorCode: () => void;
  loadTestSource: (testId: string) => Promise<void>;
  openRecipeBuilder: (seed?: { testId?: string; relativePath?: string; title?: string; functionId?: string }) => void;
  closeRecipeBuilder: () => void;
  updateRecipeDraft: (draft: RecipeDraft) => void;
  saveRecipeDraft: () => Promise<boolean>;
  run: () => Promise<boolean>;
  cancelActiveJob: () => Promise<boolean>;
  refreshCatalog: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshUnlock: () => Promise<void>;
}

export function usePlaywrightRunner(): UsePlaywrightRunnerResult {
  const [catalog, setCatalog] = useState<PlaywrightCatalog | null>(null);
  const [presence, setPresence] = useState<AgentPresence | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [source, setSource] = useState<PlaywrightSource>("project-test");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [selectedBrowsers, setSelectedBrowsers] = useState<BrowserName[]>(["chromium"]);
  const [runMode, setRunMode] = useState<RunMode>("headless");
  const [editorCode, setEditorCodeState] = useState(DEFAULT_WORKSPACE_CODE);
  const [editorDirty, setEditorDirty] = useState(false);
  const [activeJob, setActiveJob] = useState<PlaywrightJob | null>(null);
  const [terminalLines, setTerminalLines] = useState<TestLogLine[]>([]);
  const [history, setHistory] = useState<PlaywrightJob[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecipeBuilderOpen, setIsRecipeBuilderOpen] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [saveRecipeError, setSaveRecipeError] = useState<string | null>(null);
  const [saveRecipeSuccess, setSaveRecipeSuccess] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const nextSequenceRef = useRef<number>(-1);
  const sourceRequestRef = useRef(0);

  const projects = useMemo(() => catalog?.projects ?? [], [catalog]);
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) ?? (projects[0] || null);
  }, [projects, selectedProjectId]);

  const reusableFlows = useMemo<ReusableFlow[]>(() => {
    return [
      {
        id: "flow-login-uat",
        name: "Login as UAT user",
        description: "Authenticate using STS_UAT_USERNAME and STS_UAT_PASSWORD",
        actions: [
          { kind: "goto", url: "/login" },
          {
            kind: "fill",
            target: { kind: "label", text: "Username" },
            value: "STS_UAT_USERNAME",
            isSecretEnv: true,
          },
          {
            kind: "fill",
            target: { kind: "label", text: "Password" },
            value: "STS_UAT_PASSWORD",
            isSecretEnv: true,
          },
          {
            kind: "click",
            target: { kind: "role", role: "button", name: "Sign In" },
          },
        ],
      },
    ];
  }, []);

  const browserCapabilities = useMemo(() => {
    return (
      currentProject?.capabilities?.browsers ?? {
        chromium: true,
        firefox: true,
        webkit: true,
      }
    );
  }, [currentProject]);

  const headedAvailable = currentProject?.capabilities?.headed !== false;
  const workspaceAvailable = currentProject?.capabilities?.workspaceExecution !== false;

  // Compute if current draft is verified passing
  const isDraftVerified = useMemo(() => {
    if (!isRecipeBuilderOpen || !recipeDraft || !activeJob) return false;
    return (
      activeJob.source === "workspace" &&
      activeJob.status === "passed" &&
      activeJob.code?.trim() === editorCode.trim()
    );
  }, [isRecipeBuilderOpen, recipeDraft, activeJob, editorCode]);

  // Initial load
  useEffect(() => {
    let isMounted = true;

    const loadInitial = async () => {
      try {
        const [lockRes, catRes, jobsRes] = await Promise.all([
          fetch("/api/test-runner/lock"),
          fetch("/api/playwright-runner/catalog"),
          fetch("/api/playwright-runner/jobs"),
        ]);

        if (!isMounted) return;

        if (lockRes.ok) {
          const lockData = await lockRes.json();
          setIsUnlocked(Boolean(lockData.unlocked));
        }

        if (catRes.ok) {
          const catData = await catRes.json();
          setCatalog(catData.catalog);
          setPresence(catData.presence);
          setCatalogError(false);

          if (catData.catalog?.projects?.length > 0) {
            const firstProj = catData.catalog.projects[0];
            setSelectedProjectId(firstProj.id);
            setSelectedTestIds([]);
          }
        } else {
          setCatalogError(true);
        }

        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          if (Array.isArray(jobsData.jobs)) {
            setHistory(jobsData.jobs);
            const runningJob = jobsData.jobs.find(
              (j: PlaywrightJob) =>
                j.status === "queued" ||
                j.status === "claimed" ||
                j.status === "preparing" ||
                j.status === "running" ||
                j.status === "cancel_requested",
            );
            if (runningJob) {
              setActiveJob(runningJob);
            }
          }
        }
      } catch {
        if (isMounted) setCatalogError(true);
      } finally {
        if (isMounted) setLoadingCatalog(false);
      }
    };

    void loadInitial();

    return () => {
      isMounted = false;
    };
  }, []);

  // Check Unlock status
  const refreshUnlock = useCallback(async () => {
    try {
      const res = await fetch("/api/test-runner/lock");
      if (res.ok) {
        const data = await res.json();
        setIsUnlocked(Boolean(data.unlocked));
        if (data.unlocked) {
          setRunError(null);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Catalog & Presence
  const refreshCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/playwright-runner/catalog");
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.catalog);
        setPresence(data.presence);
        setCatalogError(false);

        if (data.catalog?.projects?.length > 0) {
          setSelectedProjectId((prev) => {
            if (prev && data.catalog.projects.some((p: PlaywrightProjectCatalog) => p.id === prev)) {
              return prev;
            }
            const firstProj = data.catalog.projects[0];
            setSelectedTestIds([]);
            return firstProj.id;
          });
        }
      } else {
        setCatalogError(true);
      }
    } catch {
      setCatalogError(true);
    }
  }, []);

  // Fetch History
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/playwright-runner/jobs");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.jobs)) {
          setHistory(data.jobs);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Project selector handler
  const selectProject = useCallback(
    (id: string) => {
      sourceRequestRef.current += 1;
      setSelectedProjectId(id);
      setSelectedTestIds([]);
      setEditorCodeState(DEFAULT_WORKSPACE_CODE);
      setEditorDirty(false);
      setSource("project-test");
      setIsRecipeBuilderOpen(false);
      setRecipeDraft(null);
      setSaveRecipeError(null);
      setSaveRecipeSuccess(false);
    },
    [],
  );

  // Test toggling
  const toggleTest = useCallback((id: string) => {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const selectAllTests = useCallback(() => {
    if (currentProject) {
      const coverageTests = currentProject.coverageGroups?.flatMap((g) => g.tests) ?? [];
      const standardTests = currentProject.tests ?? [];
      const allTests = coverageTests.length > 0 ? coverageTests : standardTests;
      const allIds = allTests
        .filter((t) => !("executable" in t) || (t as { executable: boolean }).executable !== false)
        .map((test) => test.id);
      setSelectedTestIds(allIds);
    }
  }, [currentProject]);

  const deselectAllTests = useCallback(() => {
    setSelectedTestIds([]);
  }, []);

  // Source switching
  const handleSetSource = useCallback((newSource: PlaywrightSource) => {
    setSource(newSource);
    if (newSource === "workspace" && runMode === "interactive") {
      setRunMode("headless");
    }
  }, [runMode]);

  // Mode switching
  const handleSetRunMode = useCallback((mode: RunMode) => {
    setRunMode(mode);
    if (mode === "interactive") {
      setSource("project-test");
      setIsRecipeBuilderOpen(false);
      setSelectedBrowsers((prev) => {
        if (prev.includes("chromium")) return ["chromium"];
        return prev.length > 0 ? [prev[0]] : ["chromium"];
      });
    }
  }, []);

  // Browser toggling
  const toggleBrowser = useCallback((browser: BrowserName) => {
    setSelectedBrowsers((prev) => {
      if (runMode === "interactive") {
        return [browser];
      }
      if (prev.includes(browser)) {
        if (prev.length === 1) return prev;
        return prev.filter((b) => b !== browser);
      }
      return [...prev, browser];
    });
  }, [runMode]);

  // Code editor updates
  const setEditorCode = useCallback((code: string) => {
    setEditorCodeState(code);
    setEditorDirty(true);
  }, []);

  const resetEditorCode = useCallback(() => {
    setEditorCodeState(DEFAULT_WORKSPACE_CODE);
    setEditorDirty(false);
  }, []);

  // Recipe Builder Handlers
  const updateRecipeDraft = useCallback(
    (updated: RecipeDraft) => {
      setRecipeDraft(updated);
      setSaveRecipeError(null);
      setSaveRecipeSuccess(false);
      try {
        const rendered = renderRecipeToPlaywrightCode(updated, reusableFlows);
        setEditorCodeState(rendered);
        setEditorDirty(true);
      } catch {
        // ignore render errors during typing
      }
    },
    [reusableFlows],
  );

  const openRecipeBuilder = useCallback(
    (seed?: { testId?: string; relativePath?: string; title?: string; functionId?: string; functionName?: string }) => {
      setSaveRecipeError(null);
      setSaveRecipeSuccess(false);

      const cleanTitle = seed?.title || "New Automated Test";
      const fnId = seed?.functionId || (currentProject?.coverageGroups?.[0]?.id ?? "");
      const sourceCode = (seed?.relativePath && currentProject?.sourceByPath?.[seed.relativePath]) || "";

      const analysis = analyzeSourceForPlaywrightDraft({
        sourceCode,
        relativePath: seed?.relativePath,
        testTitle: cleanTitle,
        functionId: fnId,
        functionName: seed?.functionName,
        reusableFlows,
      });

      const actions: RecipeAction[] = analysis.actions.map((act) => {
        if (act.kind === "goto") {
          return { kind: "goto", url: act.url || "/", evidence: act.evidence, confidence: act.confidence };
        }
        if (act.kind === "use-flow") {
          return { kind: "use-flow", flowId: act.flowId || "", evidence: act.evidence, confidence: act.confidence };
        }
        if (act.kind === "fill") {
          return {
            kind: "fill",
            target: { kind: "label", text: act.target || "" },
            value: act.value || "",
            evidence: act.evidence,
            confidence: act.confidence,
          };
        }
        if (act.kind === "click") {
          return {
            kind: "click",
            target: { kind: "role", role: "button", name: act.target || "" },
            evidence: act.evidence,
            confidence: act.confidence,
          };
        }
        if (act.kind === "assert") {
          if (act.assertionKind === "url-matches") {
            return {
              kind: "expect-url",
              url: act.assertionValue || "/",
              matchType: "contains",
              evidence: act.evidence,
              confidence: act.confidence,
            };
          }
          if (act.assertionKind === "heading-visible") {
            return {
              kind: "expect-visible",
              target: { kind: "role", role: "heading", name: act.assertionName || "" },
              evidence: act.evidence,
              confidence: act.confidence,
            };
          }
          return {
            kind: "expect-visible",
            target: { kind: "text", text: act.assertionName || "" },
            evidence: act.evidence,
            confidence: act.confidence,
          };
        }
        return { kind: "goto", url: "/", evidence: act.evidence, confidence: act.confidence };
      });

      const cleanupActions: RecipeAction[] | undefined =
        analysis.risk === "mutating"
          ? [
              {
                kind: "click",
                target: { kind: "role", role: "button", name: "Delete" },
                evidence: "Cleanup placeholder for mutating action (Review required)",
                confidence: "medium",
              },
            ]
          : undefined;

      const draft: RecipeDraft = {
        id: `recipe-${Date.now().toString(36)}`,
        title: cleanTitle,
        functionId: fnId,
        sourceTestId: seed?.testId,
        sourceRelativePath: seed?.relativePath,
        output: analysis.suggestedOutput,
        risk: analysis.risk,
        actions: actions.length > 0 ? actions : [{ kind: "goto", url: "/" }],
        cleanupActions,
      };

      setRecipeDraft(draft);
      setIsRecipeBuilderOpen(true);
      setSource("workspace");
      const rendered = renderRecipeToPlaywrightCode(draft, reusableFlows);
      setEditorCodeState(rendered);
      setEditorDirty(true);
    },
    [reusableFlows, currentProject],
  );

  const closeRecipeBuilder = useCallback(() => {
    setIsRecipeBuilderOpen(false);
  }, []);

  // Save recipe draft as automated test
  const saveRecipeDraft = useCallback(async (): Promise<boolean> => {
    if (!recipeDraft || !selectedProjectId || !activeJob || !isDraftVerified) {
      setSaveRecipeError("Please test and verify the draft in the browser before saving.");
      return false;
    }

    setIsSavingRecipe(true);
    setSaveRecipeError(null);
    setSaveRecipeSuccess(false);

    try {
      const renderedCodeHash = await computeSha256Hex(editorCode);
      const baseRevision = currentProject?.mapRevision || catalog?.version || "initial";

      const payload = {
        projectId: selectedProjectId,
        agentId: presence?.agentId,
        baseRevision,
        recipe: recipeDraft,
        verifiedJobId: activeJob.id,
        renderedCodeHash,
      };

      const res = await fetch("/api/playwright-runner/mutations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setSaveRecipeError(errJson.error || `Save request failed (HTTP ${res.status})`);
        return false;
      }

      const { mutation } = await res.json();
      const mutationId = mutation.id;

      // Poll mutation status until terminal
      let terminal = false;
      let finalSuccess = false;

      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const statusRes = await fetch(`/api/playwright-runner/mutations/${mutationId}`);
        if (!statusRes.ok) continue;

        const statusData = await statusRes.json();
        const mut = statusData.mutation;
        if (mut.status === "succeeded") {
          terminal = true;
          finalSuccess = true;
          break;
        }
        if (mut.status === "conflict" || mut.status === "rejected" || mut.status === "failed") {
          terminal = true;
          setSaveRecipeError(mut.error || `Mutation failed with status: ${mut.status}`);
          break;
        }
      }

      if (finalSuccess) {
        setSaveRecipeSuccess(true);
        await refreshCatalog();
        return true;
      }

      if (!terminal) {
        setSaveRecipeError("Mutation timed out waiting for Local Agent to process.");
      }

      return false;
    } catch (err) {
      setSaveRecipeError(err instanceof Error ? err.message : "Save failed");
      return false;
    } finally {
      setIsSavingRecipe(false);
    }
  }, [
    recipeDraft,
    selectedProjectId,
    activeJob,
    isDraftVerified,
    editorCode,
    catalog,
    currentProject,
    presence,
    refreshCatalog,
  ]);

  // Load test source code into editor
  const loadTestSource = useCallback(
    async (testId: string) => {
      if (!selectedProjectId) return;
      const requestId = ++sourceRequestRef.current;
      const projectId = selectedProjectId;
      try {
        const res = await fetch(
          `/api/playwright-runner/source?projectId=${encodeURIComponent(
            projectId,
          )}&testId=${encodeURIComponent(testId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (requestId === sourceRequestRef.current && typeof data.content === "string") {
            setEditorCodeState(data.content);
            setEditorDirty(false);
            setSource("workspace");
          }
        }
      } catch {
        // ignore
      }
    },
    [selectedProjectId],
  );

  // Active Job Polling
  const activeJobId = activeJob?.id ?? null;
  const isJobRunning = Boolean(
    activeJob &&
      (activeJob.status === "queued" ||
        activeJob.status === "claimed" ||
        activeJob.status === "preparing" ||
        activeJob.status === "running" ||
        activeJob.status === "cancel_requested"),
  );

  useEffect(() => {
    if (!activeJobId || !isJobRunning) return;

    let isCancelled = false;
    let terminalReconciled = false;
    let emptyReconcileAttempts = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (delayMs: number) => {
      if (isCancelled || terminalReconciled) return;
      timerId = setTimeout(pollJob, delayMs);
    };

    const pollJob = async () => {
      if (isCancelled || terminalReconciled) return;

      try {
        const cursor = nextSequenceRef.current;
        const res = await fetch(
          `/api/playwright-runner/jobs/${activeJobId}?cursor=${cursor}&limit=100`,
        );
        if (isCancelled || !res.ok) {
          scheduleNext(1000);
          return;
        }

        const data = await res.json();
        setActiveJob(data.job);

        let receivedLogsCount = 0;
        if (Array.isArray(data.logs) && data.logs.length > 0) {
          receivedLogsCount = data.logs.length;
          setTerminalLines((prev) => {
            const existingKeys = new Set(
              prev.map((p) => `${p.sequence}-${p.timestamp}`),
            );
            const newEntries = data.logs
              .filter(
                (l: { sequence: number; timestamp: string }) =>
                  !existingKeys.has(`${l.sequence}-${l.timestamp}`),
              )
              .map(
                (l: {
                  sequence: number;
                  timestamp: string;
                  stream: "stdout" | "stderr" | "system";
                  message?: string;
                  text?: string;
                }) => ({
                  sequence: l.sequence,
                  timestamp: l.timestamp,
                  stream: l.stream,
                  message: l.message || l.text || "",
                }),
              );

            const combined = [...prev, ...newEntries];
            return combined.slice(-300);
          });
        }

        const prevSeq = nextSequenceRef.current;
        if (typeof data.nextSequence === "number") {
          nextSequenceRef.current = data.nextSequence;
        }

        const isTerminal =
          data.job.status === "passed" ||
          data.job.status === "failed" ||
          data.job.status === "cancelled" ||
          data.job.status === "timed_out";

        if (isTerminal) {
          if (data.hasMore) {
            scheduleNext(0);
            return;
          }

          if (receivedLogsCount > 0 || nextSequenceRef.current > prevSeq) {
            emptyReconcileAttempts = 0;
            scheduleNext(250);
            return;
          }

          emptyReconcileAttempts += 1;
          if (emptyReconcileAttempts < 3) {
            scheduleNext(250);
            return;
          }

          terminalReconciled = true;
          void refreshHistory();
          return;
        }

        scheduleNext(1000);
      } catch {
        scheduleNext(1000);
      }
    };

    void pollJob();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [activeJobId, isJobRunning, refreshHistory]);

  // Run Job
  const canRun = Boolean(
    isUnlocked &&
      presence?.state === "online" &&
      selectedProjectId &&
      selectedBrowsers.length > 0 &&
      (runMode === "interactive"
        ? source === "project-test" && selectedTestIds.length > 0 && selectedBrowsers.length === 1
        : source === "project-test"
          ? selectedTestIds.length > 0
          : workspaceAvailable && editorCode.trim().length > 0),
  );

  const run = useCallback(async (): Promise<boolean> => {
    if (!canRun || !selectedProjectId) return false;

    setIsSubmitting(true);
    try {
      const payload =
        source === "project-test"
          ? {
              projectId: selectedProjectId,
              source: "project-test",
              testIds: selectedTestIds,
              browsers: selectedBrowsers,
              mode: runMode,
              agentId: presence?.agentId,
            }
          : {
              projectId: selectedProjectId,
              source: "workspace",
              code: editorCode,
              risk: isRecipeBuilderOpen && recipeDraft ? recipeDraft.risk : "read-only",
              recipeId: isRecipeBuilderOpen && recipeDraft ? recipeDraft.id : undefined,
              browsers: selectedBrowsers,
              mode: runMode,
              agentId: presence?.agentId,
            };

      const res = await fetch("/api/playwright-runner/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 409) {
          const errData = await res.json().catch(() => ({}));
          if (errData.activeJobId) {
            const jobRes = await fetch(`/api/playwright-runner/jobs/${errData.activeJobId}`);
            if (jobRes.ok) {
              const jobData = await jobRes.json();
              if (jobData.job) {
                setActiveJob(jobData.job);
                nextSequenceRef.current = 0;
                setTerminalLines((prev) => [
                  ...prev,
                  {
                    sequence: 0,
                    timestamp: new Date().toISOString(),
                    stream: "system",
                    message: `[system] Reattached to already active job ${errData.activeJobId} (${jobData.job.status})`,
                  },
                ]);
                return true;
              }
            }
          }
        }
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403 && errorData.code === "EXECUTION_REQUIRED") {
          setIsUnlocked(false);
          setRunError("Execution permission expired. Unlock execution and run again.");
          return false;
        }
        setRunError("Unable to start the test run.");
        return false;
      }

      const job = await res.json();
      nextSequenceRef.current = 0;
      setTerminalLines([
        {
          sequence: 0,
          timestamp: new Date().toISOString(),
          stream: "system",
          message: `[system] Submitted Playwright job ${job.id} (${source}) for ${selectedBrowsers.join(", ")} in ${runMode} mode`,
        },
      ]);
      setActiveJob(job);
      return true;
    } catch {
      setRunError("Unable to start the test run.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canRun,
    selectedProjectId,
    source,
    selectedTestIds,
    selectedBrowsers,
    runMode,
    presence,
    editorCode,
    isRecipeBuilderOpen,
    recipeDraft,
  ]);

  // Cancel Job
  const cancelActiveJob = useCallback(async (): Promise<boolean> => {
    if (!activeJob) return false;
    try {
      const res = await fetch(`/api/playwright-runner/jobs/${activeJob.id}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        setActiveJob((prev) =>
          prev ? { ...prev, status: "cancel_requested" } : null,
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [activeJob]);

  return {
    catalog,
    projects,
    currentProject,
    presence,
    isUnlocked,
    selectedProjectId,
    source,
    selectedTestIds,
    selectedBrowsers,
    runMode,
    editorCode,
    editorDirty,
    activeJob,
    terminalLines,
    history,
    browserResults: activeJob?.browserResults ?? [],
    loadingCatalog,
    catalogError,
    isSubmitting,
    isJobRunning,
    canRun,
    browserCapabilities,
    headedAvailable,
    isRecipeBuilderOpen,
    recipeDraft,
    reusableFlows,
    isDraftVerified,
    isSavingRecipe,
    saveRecipeError,
    saveRecipeSuccess,
    runError,

    selectProject,
    setSource: handleSetSource,
    toggleTest,
    selectAllTests,
    deselectAllTests,
    toggleBrowser,
    setRunMode: handleSetRunMode,
    setEditorCode,
    resetEditorCode,
    loadTestSource,
    openRecipeBuilder,
    closeRecipeBuilder,
    updateRecipeDraft,
    saveRecipeDraft,
    run,
    cancelActiveJob,
    refreshCatalog,
    refreshHistory,
    refreshUnlock,
  };
}

export default usePlaywrightRunner;
