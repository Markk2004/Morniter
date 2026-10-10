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
import { getFunctionTemplate, STS_FUNCTION_TEMPLATES, STS_SUB_TEMPLATES } from "@/lib/playwright-runner/function-templates";
import { extractTestExecutionSummary, formatTerminalSummary } from "@/lib/playwright-runner/progress-parser";
import type { HistoricalJobItem } from "@/components/test-runner/JobHistory";

export function getDefaultWorkspaceCode(projectId?: string | null): string {
  if (projectId?.toLowerCase().includes("sts")) {
    return `// ==============================================================
// 🧪 ชุดทดสอบระบบ ProjectSTS: ตรวจสอบหน้าเข้าสู่ระบบและแบบฟอร์ม
// วัตถุประสงค์: ตรวจสอบความพร้อมของหน้า Login, ช่องกรอก Username และการเชื่อมต่อ
// ==============================================================
import { test, expect } from "@playwright/test";

// กำหนด Scenario ทดสอบการเข้าถึงหน้าเข้าสู่ระบบ (Login Page Sanity Check)
test("ProjectSTS navigation sanity check", async ({ page }) => {
  // 1. สั่งให้ Browser เปิดไปยังหน้า /login ของระบบ STS
  await page.goto("/login");

  // 2. ตรวจสอบเงื่อนไข: URL ของหน้าเว็บต้องตรงกับเส้นทาง /login
  await expect(page).toHaveURL(/.*\\/login/);

  // 3. ตรวจสอบว่าช่องกรอกชื่อผู้ใช้ (Username Input) แสดงผลและพร้อมรับการพิมพ์
  await expect(page.locator("#login-username, input[type='text'], input[name='username']").first()).toBeVisible();
});
`;
  }
  return `// ==============================================================
// 🌐 ชุดทดสอบเริ่มต้น (Playwright Basic Sanity Check)
// วัตถุประสงค์: ตรวจสอบการเปิดหน้าเว็บหลัก และความพร้อมของ Page Context
// ==============================================================
import { test, expect } from "@playwright/test";

// กำหนด Scenario สำหรับการทดสอบความพร้อมพื้นฐาน
test("Basic sanity check", async ({ page }) => {
  // 1. เปิดหน้าแรกของเว็บไซต์ (Home Page: /)
  await page.goto("/");

  // 2. ตรวจสอบว่า Browser Page Context พร้อมทำงาน
  await expect(page).toBeDefined();
});
`;
}

const DEFAULT_WORKSPACE_CODE = `// ==============================================================
// 🌐 ชุดทดสอบเริ่มต้น (Playwright Basic Sanity Check)
// วัตถุประสงค์: ตรวจสอบการเปิดหน้าเว็บหลัก และความพร้อมของ Page Context
// ==============================================================
import { test, expect } from "@playwright/test";

test("Basic sanity check", async ({ page }) => {
  // 1. เปิดหน้าแรกของเว็บไซต์ (Home Page: /)
  await page.goto("/");

  // 2. ตรวจสอบว่า Browser Page Context พร้อมทำงาน
  await expect(page).toBeDefined();
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
    msedge?: boolean;
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

  activeSourceTestId: string | null;
  activeTestTitle?: string;
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
  loadFunctionSource: (functionIdOrGroupId: string) => Promise<void>;
  loadJobCodeIntoWorkspace: (job: HistoricalJobItem | PlaywrightJob) => Promise<void>;
  loadingSourceTestId: string | null;
  prefetchTestSource: (testId: string) => void;
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
  const [loadingSourceTestId, setLoadingSourceTestId] = useState<string | null>(null);
  const [activeSourceTestId, setActiveSourceTestId] = useState<string | null>(null);

  const nextSequenceRef = useRef<number>(-1);
  const sourceRequestRef = useRef(0);
  const sourceCacheRef = useRef<Map<string, string>>(new Map());

  const projects = useMemo(() => catalog?.projects ?? [], [catalog]);
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) ?? (projects[0] || null);
  }, [projects, selectedProjectId]);

  const findTestItem = useCallback(
    (testId: string) => {
      if (!currentProject) return null;
      const canonical = [
        ...(currentProject.tests || []),
        ...(currentProject.testGroups?.flatMap((g) => g.tests) || []),
      ];
      const coverage = currentProject.coverageGroups?.flatMap((g) => g.tests) || [];
      return canonical.find((t) => t.id === testId) || coverage.find((t) => t.id === testId) || null;
    },
    [currentProject],
  );

  const activeTestTitle = useMemo(() => {
    if (!activeSourceTestId) return undefined;
    const item = findTestItem(activeSourceTestId);
    if (item) return `${item.title} (${item.relativePath})`;
    const tpl = getFunctionTemplate(activeSourceTestId);
    if (tpl) return `${tpl.name} (${tpl.relativePath})`;
    return undefined;
  }, [activeSourceTestId, findTestItem]);

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
    // Standard Playwright browsers (Chromium, Firefox, WebKit, Edge) are always supported and selectable
    return {
      chromium: true,
      firefox: true,
      webkit: true,
      msedge: true,
    };
  }, []);

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
            setEditorCodeState(getDefaultWorkspaceCode(firstProj.id));
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

  // Auto-refresh catalog & lock when user returns/focuses the Morniter tab
  useEffect(() => {
    const handleFocus = () => {
      void refreshCatalog();
      void refreshUnlock();
    };

    window.addEventListener("focus", handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshCatalog, refreshUnlock]);

  // Periodic polling when catalog is not yet ready or in error state (e.g. waiting for Local Agent to connect)
  // Adjusted to 15000ms and paused when tab is hidden to preserve Upstash command limits
  useEffect(() => {
    if (catalog && !catalogError && presence?.state === "online") return;

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refreshCatalog();
    }, 15000);

    return () => clearInterval(timer);
  }, [catalog, catalogError, presence?.state, refreshCatalog]);

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
      setActiveSourceTestId(null);
      setEditorCodeState(getDefaultWorkspaceCode(id));
      setEditorDirty(false);
      setSource("project-test");
      setIsRecipeBuilderOpen(false);
      setRecipeDraft(null);
      setSaveRecipeError(null);
      setSaveRecipeSuccess(false);
    },
    [],
  );

  // Source switching
  const handleSetSource = useCallback((newSource: PlaywrightSource) => {
    setSource(newSource);
    if (newSource === "workspace" && runMode === "interactive") {
      setRunMode("headless");
    }
  }, [runMode]);

  // Reset cache on project switch
  useEffect(() => {
    sourceCacheRef.current.clear();
    setLoadingSourceTestId(null);
    setActiveSourceTestId(null);
  }, [selectedProjectId]);

  // Load test source code into editor (0ms instant if cached or specific sub-part)
  const loadTestSource = useCallback(
    async (testId: string) => {
      if (!selectedProjectId) return;

      setActiveSourceTestId(testId);

      const testItem = findTestItem(testId);
      const cached = sourceCacheRef.current.get(testId);

      if (cached) {
        if (editorDirty && typeof window !== "undefined") {
          const proceed = window.confirm(
            "คุณมีโค้ดที่แก้ไขค้างอยู่ ต้องการละทิ้งการแก้ไขแล้วเปิดโค้ดใหม่หรือไม่?",
          );
          if (!proceed) return;
        }
        setEditorCodeState(cached);
        setEditorDirty(false);
        setSource("workspace");
        return;
      }

      if (editorDirty && typeof window !== "undefined") {
        const proceed = window.confirm(
          "คุณมีโค้ดที่แก้ไขค้างอยู่ ต้องการละทิ้งการแก้ไขแล้วเปิดโค้ดใหม่หรือไม่?",
        );
        if (!proceed) return;
      }

      // Check if this test corresponds to an isolated sub-part template
      const specificTpl = getFunctionTemplate(testId) || getFunctionTemplate(testItem?.title || "");
      const isSubPart =
        specificTpl &&
        (specificTpl.id in STS_SUB_TEMPLATES ||
          specificTpl.id.includes("PART") ||
          specificTpl.id.includes("ROLES") ||
          specificTpl.id.includes("INVALID") ||
          specificTpl.id.includes("EMPTY") ||
          testItem?.title?.includes("INVALID") ||
          testItem?.title?.includes("EMPTY") ||
          testItem?.title?.includes("ROLE") ||
          testItem?.title?.includes("succeeds"));

      if (isSubPart && specificTpl) {
        sourceCacheRef.current.set(testId, specificTpl.code);
        setEditorCodeState(specificTpl.code);
        setEditorDirty(false);
        setSource("workspace");
        return;
      }

      const requestId = ++sourceRequestRef.current;
      const projectId = selectedProjectId;
      setLoadingSourceTestId(testId);

      try {
        const res = await fetch(
          `/api/playwright-runner/source?projectId=${encodeURIComponent(
            projectId,
          )}&testId=${encodeURIComponent(testId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (requestId === sourceRequestRef.current && typeof data.content === "string") {
            sourceCacheRef.current.set(testId, data.content);
            setEditorCodeState(data.content);
            setEditorDirty(false);
            setSource("workspace");
          }
        } else {
          // Graceful fallback to function template if source API returns 404
          const fallbackTpl = getFunctionTemplate(testItem?.title || testId);
          if (fallbackTpl && requestId === sourceRequestRef.current) {
            sourceCacheRef.current.set(testId, fallbackTpl.code);
            setEditorCodeState(fallbackTpl.code);
            setEditorDirty(false);
            setSource("workspace");
          }
        }
      } catch {
        const fallbackTpl = getFunctionTemplate(testItem?.title || testId);
        if (fallbackTpl && requestId === sourceRequestRef.current) {
          sourceCacheRef.current.set(testId, fallbackTpl.code);
          setEditorCodeState(fallbackTpl.code);
          setEditorDirty(false);
          setSource("workspace");
        }
      } finally {
        if (requestId === sourceRequestRef.current) {
          setLoadingSourceTestId(null);
        }
      }
    },
    [selectedProjectId, findTestItem, editorDirty],
  );

  // Load full function test suite or template into workspace editor
  const loadFunctionSource = useCallback(
    async (functionIdOrGroupId: string) => {
      setActiveSourceTestId(functionIdOrGroupId);

      const template = getFunctionTemplate(functionIdOrGroupId);
      const cached =
        sourceCacheRef.current.get(functionIdOrGroupId) ||
        (template?.relativePath ? sourceCacheRef.current.get(template.relativePath) : undefined);

      if (cached) {
        if (editorDirty && typeof window !== "undefined") {
          const proceed = window.confirm(
            "คุณมีโค้ดที่แก้ไขค้างอยู่ ต้องการละทิ้งการแก้ไขแล้วเปิดโค้ดใหม่หรือไม่?",
          );
          if (!proceed) return;
        }
        setEditorCodeState(cached);
        setEditorDirty(false);
        setSource("workspace");
        return;
      }

      if (editorDirty && typeof window !== "undefined") {
        const proceed = window.confirm(
          "คุณมีโค้ดที่แก้ไขค้างอยู่ ต้องการละทิ้งการแก้ไขแล้วเปิดโค้ดใหม่หรือไม่?",
        );
        if (!proceed) return;
      }

      // 1. If function template exists for STS, use its self-contained template code
      if (template) {
        sourceCacheRef.current.set(functionIdOrGroupId, template.code);
        if (template.relativePath) {
          sourceCacheRef.current.set(template.relativePath, template.code);
        }
        setEditorCodeState(template.code);
        setEditorDirty(false);
        setSource("workspace");
        return;
      }

      // 2. Search for any test belonging to this function in currentProject
      if (currentProject) {
        const allTests = [
          ...(currentProject.tests || []),
          ...(currentProject.testGroups?.flatMap((g) => g.tests) || []),
          ...(currentProject.coverageGroups?.flatMap((g) => g.tests) || []),
        ];
        const match = allTests.find(
          (t) =>
            ("functionId" in t && (t as { functionId?: string }).functionId === functionIdOrGroupId) ||
            t.title.toUpperCase().includes(functionIdOrGroupId.toUpperCase()),
        );
        if (match) {
          const matchContent =
            sourceCacheRef.current.get(match.id) ||
            sourceCacheRef.current.get(match.relativePath) ||
            currentProject.sourceByPath?.[match.relativePath];
          if (matchContent) {
            sourceCacheRef.current.set(functionIdOrGroupId, matchContent);
            setEditorCodeState(matchContent);
            setEditorDirty(false);
            setSource("workspace");
            return;
          }
          await loadTestSource(match.id);
          return;
        }
      }
    },
    [editorDirty, currentProject, loadTestSource],
  );

  // Load code from historical test job into workspace editor
  const loadJobCodeIntoWorkspace = useCallback(
    async (job: HistoricalJobItem | PlaywrightJob) => {
      if (editorDirty && typeof window !== "undefined") {
        const proceed = window.confirm(
          "คุณมีโค้ดที่แก้ไขค้างอยู่ ต้องการละทิ้งการแก้ไขแล้วโหลดโค้ดจากประวัตินี้หรือไม่?",
        );
        if (!proceed) return;
      }

      if (job.code && job.code.trim().length > 0) {
        setEditorCodeState(job.code);
        setEditorDirty(false);
        setSource("workspace");
        return;
      }

      // If code was not stored directly, look for function template or test source
      const targetName = job.presetName || (job.testIds && job.testIds[0]);
      if (targetName) {
        const tpl = getFunctionTemplate(targetName);
        if (tpl) {
          setEditorCodeState(tpl.code);
          setEditorDirty(false);
          setSource("workspace");
          return;
        }
      }

      if (job.testIds && job.testIds.length > 0) {
        await loadTestSource(job.testIds[0]);
      }
    },
    [editorDirty, loadTestSource],
  );

  // Background prefetch
  const prefetchTestSource = useCallback(
    (testId: string) => {
      if (!selectedProjectId) return;
      const testItem = findTestItem(testId);
      if (
        sourceCacheRef.current.has(testId) ||
        (testItem?.relativePath && sourceCacheRef.current.has(testItem.relativePath))
      ) {
        return;
      }

      const runPrefetch = async () => {
        try {
          const res = await fetch(
            `/api/playwright-runner/source?projectId=${encodeURIComponent(
              selectedProjectId,
            )}&testId=${encodeURIComponent(testId)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (typeof data.content === "string") {
              sourceCacheRef.current.set(testId, data.content);
            }
          }
        } catch {
          // ignore background prefetch errors
        }
      };

      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(() => {
          void runPrefetch();
        });
      } else {
        setTimeout(() => {
          void runPrefetch();
        }, 30);
      }
    },
    [selectedProjectId, findTestItem, currentProject],
  );

  // Test toggling
  const toggleTest = useCallback(
    (id: string) => {
      setSelectedTestIds((prev) => {
        const isSelected = prev.includes(id);
        if (!isSelected) {
          void loadTestSource(id);
          return [...prev, id];
        }
        return prev.filter((item) => item !== id);
      });
    },
    [loadTestSource],
  );

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
    if (activeSourceTestId) {
      const cached = sourceCacheRef.current.get(activeSourceTestId);
      if (cached) {
        setEditorCodeState(cached);
        setEditorDirty(false);
        return;
      }
      const tpl = getFunctionTemplate(activeSourceTestId);
      if (tpl) {
        setEditorCodeState(tpl.code);
        setEditorDirty(false);
        return;
      }
    }
    setEditorCodeState(getDefaultWorkspaceCode(selectedProjectId));
    setEditorDirty(false);
  }, [selectedProjectId, activeSourceTestId]);

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
    let cancelPollAttempts = 0;
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
          data.job.status === "timed_out" ||
          data.job.status === "session_closed";

        if (isTerminal) {
          if (data.job.status === "cancelled" || data.job.status === "session_closed") {
            terminalReconciled = true;
            void refreshHistory();
            return;
          }

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
          // Ensure terminal displays summary box if not already present
          setTerminalLines((prev) => {
            const hasSummary = prev.some((l) => l.message.includes("TEST EXECUTION & UAT SUMMARY"));
            if (hasSummary) return prev;
            const logStrings = prev.map((l) => l.message);
            const summary = extractTestExecutionSummary(data.job, logStrings);
            const summaryLines = formatTerminalSummary(summary, { browsers: data.job.browsers });
            const nowIso = new Date().toISOString();
            const newLines: TestLogLine[] = summaryLines.map((text) => ({
              sequence: (nextSequenceRef.current += 1),
              timestamp: nowIso,
              stream: "system",
              message: text,
            }));
            return [...prev, ...newLines].slice(-300);
          });
          void refreshHistory();
          return;
        }

        const isCancelRequested = data.job.status === "cancel_requested";
        if (isCancelRequested) {
          cancelPollAttempts += 1;
          if (cancelPollAttempts >= 8) {
            // Auto force cancel after ~1.2s in cancel_requested
            void fetch(`/api/playwright-runner/jobs/${activeJobId}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ force: true }),
            }).catch(() => {});
          }
        } else {
          cancelPollAttempts = 0;
        }
        scheduleNext(isCancelRequested ? 150 : 1000);
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
      const isAlreadyRequested = activeJob.status === "cancel_requested";
      setActiveJob((prev) =>
        prev ? { ...prev, status: isAlreadyRequested ? "cancelled" : "cancel_requested" } : null,
      );
      setTerminalLines((prev) => [
        ...prev,
        {
          sequence: (nextSequenceRef.current += 1),
          timestamp: new Date().toISOString(),
          stream: "system",
          message: isAlreadyRequested
            ? "[system] Forcing instant cancellation..."
            : "[system] Cancellation requested...",
        },
      ]);
      const shouldForce = isAlreadyRequested || activeJob.mode === "interactive";
      const res = await fetch(`/api/playwright-runner/jobs/${activeJob.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: shouldForce }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.job?.status === "cancelled" || data.job?.status === "session_closed") {
          setActiveJob(data.job);
          void refreshHistory();
        } else if (data.job) {
          setActiveJob(data.job);
        }
        return true;
      }
      const errData = await res.json().catch(() => ({}));
      setTerminalLines((prev) => [
        ...prev,
        {
          sequence: (nextSequenceRef.current += 1),
          timestamp: new Date().toISOString(),
          stream: "system",
          message: `[system] Cancellation note: ${errData.error || res.statusText || "HTTP " + res.status}`,
        },
      ]);
      return false;
    } catch {
      return false;
    }
  }, [activeJob, refreshHistory]);

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

    activeSourceTestId,
    activeTestTitle,
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
    loadFunctionSource,
    loadJobCodeIntoWorkspace,
    loadingSourceTestId,
    prefetchTestSource,
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
