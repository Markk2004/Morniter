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

const DEFAULT_WORKSPACE_CODE = `import { test, expect } from "@playwright/test";

test("Basic sanity check", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await expect(page).toHaveTitle(/.*Monitor.*/i);
});
`;

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
  isSubmitting: boolean;
  isJobRunning: boolean;
  canRun: boolean;
  browserCapabilities: {
    chromium?: boolean;
    firefox?: boolean;
    webkit?: boolean;
  };
  headedAvailable: boolean;

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextSequenceRef = useRef<number>(-1);
  const sourceRequestRef = useRef(0);

  const projects = useMemo(() => catalog?.projects ?? [], [catalog]);
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) ?? (projects[0] || null);
  }, [projects, selectedProjectId]);

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

          if (catData.catalog?.projects?.length > 0) {
            const firstProj = catData.catalog.projects[0];
            setSelectedProjectId(firstProj.id);
            setSelectedTestIds([]);
          }
        }

        if (jobsRes.ok) {
          const jobsData = await jobsRes.json();
          if (Array.isArray(jobsData.jobs)) {
            setHistory(jobsData.jobs);
          }
        }
      } catch {
        // ignore
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
      }
    } catch {
      // ignore
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
      const allIds = currentProject.testGroups?.flatMap((g) =>
        g.tests.map((t) => t.id),
      ) ?? [];
      setSelectedTestIds(allIds);
    }
  }, [currentProject]);

  const deselectAllTests = useCallback(() => {
    setSelectedTestIds([]);
  }, []);

  // Browser toggling
  const toggleBrowser = useCallback((browser: BrowserName) => {
    setSelectedBrowsers((prev) => {
      if (prev.includes(browser)) {
        if (prev.length === 1) return prev;
        return prev.filter((b) => b !== browser);
      }
      return [...prev, browser];
    });
  }, []);

  // Code editor updates
  const setEditorCode = useCallback((code: string) => {
    setEditorCodeState(code);
    setEditorDirty(true);
  }, []);

  const resetEditorCode = useCallback(() => {
    setEditorCodeState(DEFAULT_WORKSPACE_CODE);
    setEditorDirty(false);
  }, []);

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
    if (!activeJobId) return;

    let isCancelled = false;

    const pollJob = async () => {
      try {
        const res = await fetch(
          `/api/playwright-runner/jobs/${activeJobId}?afterSequence=${nextSequenceRef.current}&limit=100`,
        );
        if (isCancelled || !res.ok) return;

        const data = await res.json();
        setActiveJob(data.job);

        if (Array.isArray(data.logs) && data.logs.length > 0) {
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

        if (typeof data.nextSequence === "number") {
          nextSequenceRef.current = data.nextSequence;
        }

        if (
          data.job.status === "passed" ||
          data.job.status === "failed" ||
          data.job.status === "cancelled" ||
          data.job.status === "timed_out"
        ) {
          void refreshHistory();
        }
      } catch {
        // ignore
      }
    };

    const interval = setInterval(pollJob, 1000);
    void pollJob();

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [activeJobId, refreshHistory]);

  // Run Job
  const canRun = Boolean(
    isUnlocked &&
      presence?.state === "online" &&
      selectedProjectId &&
      selectedBrowsers.length > 0 &&
      (source === "project-test"
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
        return false;
      }

      const job = await res.json();
      nextSequenceRef.current = -1;
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
    isSubmitting,
    isJobRunning,
    canRun,
    browserCapabilities,
    headedAvailable,

    selectProject,
    setSource,
    toggleTest,
    selectAllTests,
    deselectAllTests,
    toggleBrowser,
    setRunMode,
    setEditorCode,
    resetEditorCode,
    loadTestSource,
    run,
    cancelActiveJob,
    refreshCatalog,
    refreshHistory,
    refreshUnlock,
  };
}

export default usePlaywrightRunner;
