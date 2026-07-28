"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  TestProjectCatalog,
  AgentPresence,
  TestJob,
  TestLogLine,
} from "@/lib/test-runner/types";
import { isActiveStatus, isTerminalStatus } from "@/lib/test-runner/lifecycle";
import { fetchNoStore } from "@/lib/http/fetch-no-store";

const ACTIVE_POLL_MS = 1_000;
const IDLE_POLL_MS = 5_000;

export function useTestRunner() {
  const [catalog, setCatalog] = useState<TestProjectCatalog | null>(null);
  const [presence, setPresence] = useState<AgentPresence | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const [activeJob, setActiveJob] = useState<TestJob | null>(null);
  const [terminalLines, setTerminalLines] = useState<TestLogLine[]>([]);
  const [nextSequence, setNextSequence] = useState(0);
  const [history, setHistory] = useState<TestJob[]>([]);

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isPollingRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);
  const activeJobRef = useRef<TestJob | null>(null);
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

  // Fetch catalog & agent presence
  const fetchCatalogAndPresence = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetchNoStore("/api/test-runner/catalog", { signal });
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
      // Keep existing catalog
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  // Fetch job list history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetchNoStore("/api/test-runner/jobs");
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
      if (!currentId || !activeJobRef.current || !isActiveStatus(activeJobRef.current.status)) {
        return;
      }

      const seq = nextSeqRef.current;
      const res = await fetchNoStore(
        `/api/test-runner/jobs/${currentId}?afterSequence=${seq - 1}&limit=200`,
        { signal },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.job !== undefined) {
          const previousStatus = activeJobRef.current?.status;
          setActiveJob((prev) =>
            JSON.stringify(prev) === JSON.stringify(data.job) ? prev : data.job ?? null,
          );
          if (previousStatus && isActiveStatus(previousStatus) && isTerminalStatus(data.job.status)) {
            await fetchHistory();
          }
        }
        if (data.lines && data.lines.length > 0) {
          setTerminalLines((prev) => {
            const known = new Set(prev.map((line) => line.sequence));
            const incoming = data.lines.filter(
              (line: TestLogLine) => !known.has(line.sequence),
            );
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
      // Network error, keep existing state
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
          const delayMs = activeJobRef.current && isActiveStatus(activeJobRef.current.status)
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

  // Enqueue job with client-side Idempotency-Key
  const createJob = async (projectId: string, presetId: string) => {
    setIsSubmitting(true);
    setActionError(null);

    const idempotencyKey = `run-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    try {
      const res = await fetchNoStore("/api/test-runner/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ projectId, presetId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || "Failed to create job");
        if (data.code === "ACTIVE_JOB_EXISTS" && data.activeJob) {
          setActiveJob(data.activeJob);
        }
        return false;
      }

      setActiveJob(data);
      setTerminalLines([]);
      setNextSequence(0);
      await fetchHistory();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create job";
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request cancel job
  const cancelJob = async (jobId: string) => {
    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await fetchNoStore(`/api/test-runner/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to cancel job");
        return false;
      }
      setActiveJob(data);
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

  // Unlock execution session
  const unlockSession = async (password: string) => {
    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await fetchNoStore("/api/test-runner/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Execution unlock failed");
        return false;
      }

      setIsUnlocked(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Execution unlock failed";
      setActionError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const isJobRunning = Boolean(activeJob && isActiveStatus(activeJob.status));

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
    unlockSession,
    refreshHistory: fetchHistory,
  };
}
