"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  PlaywrightCatalog,
  PlaywrightJob,
  PlaywrightJobRequest,
  PlaywrightLogChunk,
} from "@/lib/playwright-runner/types";
import { isPlaywrightActiveStatus } from "@/lib/playwright-runner/job-store-logic";
import { fetchNoStore } from "@/lib/http/fetch-no-store";

const ACTIVE_POLL_MS = 1_000;
const IDLE_POLL_MS = 5_000;

export interface AgentPresenceState {
  agentId: string;
  state: "online" | "lagging" | "offline";
  lastHeartbeatAt: string;
  activeJobId?: string;
  capabilities?: {
    browsers?: {
      chromium?: boolean;
      firefox?: boolean;
      webkit?: boolean;
    };
    headed?: boolean;
    workspaceExecution?: boolean;
  };
}

export function useTestRunner() {
  const [catalog, setCatalog] = useState<PlaywrightCatalog | null>(null);
  const [presence, setPresence] = useState<AgentPresenceState | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [activeJob, setActiveJob] = useState<PlaywrightJob | null>(null);
  const [terminalLines, setTerminalLines] = useState<PlaywrightLogChunk[]>([]);
  const [nextSequence, setNextSequence] = useState(0);
  const [history, setHistory] = useState<PlaywrightJob[]>([]);

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isPollingRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);
  const activeJobRef = useRef<PlaywrightJob | null>(null);
  const nextSeqRef = useRef(0);

  useEffect(() => {
    activeJobIdRef.current = activeJob?.id || null;
    activeJobRef.current = activeJob;
    nextSeqRef.current = nextSequence;
  }, [activeJob, nextSequence]);

  // Check execution unlock status
  const checkUnlockStatus = useCallback(async () => {
    try {
      const res = await fetchNoStore("/api/test-runner/lock");
      if (res.ok) {
        const data = await res.json();
        setIsUnlocked(Boolean(data.unlocked));
      }
    } catch {
      // Keep existing unlock state
    }
  }, []);

  // Fetch Playwright catalog & presence
  const fetchCatalogAndPresence = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetchNoStore("/api/playwright-runner/catalog", { signal });
      if (res.ok) {
        const data = await res.json();
        setCatalog((prev) =>
          JSON.stringify(prev) === JSON.stringify(data.catalog) ? prev : data.catalog ?? null,
        );
        setPresence((prev) =>
          JSON.stringify(prev) === JSON.stringify(data.presence) ? prev : data.presence ?? null,
        );
        if (data.activeJob !== undefined) {
          setActiveJob((prev) =>
            JSON.stringify(prev) === JSON.stringify(data.activeJob) ? prev : data.activeJob ?? null,
          );
        }
      }
    } catch {
      // Keep existing
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  // Fetch job list history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetchNoStore("/api/playwright-runner/jobs");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.jobs ?? []);
      }
    } catch {
      // Keep existing history
    }
  }, []);

  // Poll current active job and log lines
  const pollActiveJobAndLogs = useCallback(async (signal?: AbortSignal) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      await fetchCatalogAndPresence(signal);
      const currentId = activeJobIdRef.current;
      if (!currentId || !activeJobRef.current || !isPlaywrightActiveStatus(activeJobRef.current.status)) {
        return;
      }

      const seq = nextSeqRef.current;
      const res = await fetchNoStore(
        `/api/playwright-runner/jobs/${currentId}?afterSequence=${seq - 1}&limit=200`,
        { signal },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.job !== undefined) {
          const previousStatus = activeJobRef.current?.status;
          setActiveJob((prev) =>
            JSON.stringify(prev) === JSON.stringify(data.job) ? prev : data.job ?? null,
          );
          if (
            previousStatus &&
            isPlaywrightActiveStatus(previousStatus) &&
            !isPlaywrightActiveStatus(data.job.status)
          ) {
            await fetchHistory();
          }
        }
        if (data.logs && data.logs.length > 0) {
          setTerminalLines((prev) => {
            const known = new Set(prev.map((l) => l.sequence));
            const incoming = data.logs.filter((l: PlaywrightLogChunk) => !known.has(l.sequence));
            const combined = [...prev, ...incoming];
            return combined.slice(-1000);
          });
        }
        if (typeof data.nextSequence === "number") {
          setNextSequence(data.nextSequence);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    } finally {
      isPollingRef.current = false;
    }
  }, [fetchCatalogAndPresence, fetchHistory]);

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const clearScheduledPoll = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedulePoll = (delay = 0) => {
      if (disposed || document.visibilityState !== "visible" || timer) return;
      timer = setTimeout(async () => {
        timer = null;
        if (disposed || document.visibilityState !== "visible") return;
        controller = new AbortController();
        await pollActiveJobAndLogs(controller.signal);
        controller = null;
        if (!disposed && document.visibilityState === "visible") {
          const delayMs =
            activeJobRef.current && isPlaywrightActiveStatus(activeJobRef.current.status)
              ? ACTIVE_POLL_MS
              : IDLE_POLL_MS;
          schedulePoll(delayMs);
        }
      }, delay);
    };

    (async () => {
      await checkUnlockStatus();
      if (disposed) return;
      await fetchCatalogAndPresence();
      if (disposed) return;
      await fetchHistory();
      schedulePoll();
    })();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearScheduledPoll();
        controller?.abort();
        return;
      }
      schedulePoll();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      clearScheduledPoll();
      controller?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkUnlockStatus, fetchCatalogAndPresence, fetchHistory, pollActiveJobAndLogs]);

  // Create Playwright job
  const createJob = async (request: PlaywrightJobRequest) => {
    setIsSubmitting(true);
    setActionError(null);

    const idempotencyKey = `plw-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    try {
      const res = await fetchNoStore("/api/playwright-runner/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(request),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || "Failed to create Playwright job");
        if (data.code === "ACTIVE_JOB_EXISTS" && data.activeJobId) {
          // Re-fetch catalog to get active job
          await fetchCatalogAndPresence();
        }
        return false;
      }

      setActiveJob(data);
      setTerminalLines([]);
      setNextSequence(0);
      await fetchHistory();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create Playwright job";
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Playwright job
  const cancelJob = async (jobId: string) => {
    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await fetchNoStore(`/api/playwright-runner/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to cancel job");
        return false;
      }
      setActiveJob(data.job);
      await fetchHistory();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel job";
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const isJobRunning = Boolean(activeJob && isPlaywrightActiveStatus(activeJob.status));

  return {
    catalog,
    presence,
    isUnlocked,
    activeJob,
    terminalLines,
    history,
    loadingCatalog,
    isSubmitting,
    actionError,
    isJobRunning,
    createJob,
    cancelJob,
    refreshHistory: fetchHistory,
  };
}
