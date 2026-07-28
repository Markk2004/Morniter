"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  TestProjectCatalog,
  AgentPresence,
  TestJob,
  TestLogLine,
} from "@/lib/test-runner/types";
import { isActiveStatus } from "@/lib/test-runner/lifecycle";

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
  const nextSeqRef = useRef(0);

  useEffect(() => {
    activeJobIdRef.current = activeJob?.id || null;
    nextSeqRef.current = nextSequence;
  }, [activeJob, nextSequence]);

  // Check execution unlock status
  const checkUnlockStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/test-runner/lock");
      if (res.ok) {
        const data = await res.json();
        setIsUnlocked(Boolean(data.unlocked));
      }
    } catch {
      // Keep existing unlock state
    }
  }, []);

  // Fetch catalog & agent presence
  const fetchCatalogAndPresence = useCallback(async () => {
    try {
      const res = await fetch("/api/test-runner/catalog");
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.catalog ?? null);
        setPresence(data.presence ?? null);
        if (data.activeJob) {
          setActiveJob(data.activeJob);
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
      const res = await fetch("/api/test-runner/jobs");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.jobs ?? []);
      }
    } catch {
      // Keep existing history
    }
  }, []);

  // Poll current active job and log lines
  const pollActiveJobAndLogs = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    try {
      const currentId = activeJobIdRef.current;
      if (!currentId) {
        await fetchCatalogAndPresence();
        await fetchHistory();
        return;
      }

      const seq = nextSeqRef.current;
      const res = await fetch(`/api/test-runner/jobs/${currentId}?afterSequence=${seq - 1}&limit=200`);
      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setActiveJob(data.job);
        }
        if (data.lines && data.lines.length > 0) {
          setTerminalLines((prev) => {
            const combined = [...prev, ...data.lines];
            return combined.slice(-1000);
          });
        }
        if (typeof data.nextSequence === "number") {
          setNextSequence(data.nextSequence);
        }
      }
    } catch {
      // Network error, keep existing state
    } finally {
      isPollingRef.current = false;
    }
  }, [fetchCatalogAndPresence, fetchHistory]);

  // Main polling interval (2 seconds)
  useEffect(() => {
    let active = true;

    (async () => {
      await checkUnlockStatus();
      if (!active) return;
      await fetchCatalogAndPresence();
      if (!active) return;
      await fetchHistory();
    })();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        pollActiveJobAndLogs();
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [checkUnlockStatus, fetchCatalogAndPresence, fetchHistory, pollActiveJobAndLogs]);

  // Enqueue job with client-side Idempotency-Key
  const createJob = async (projectId: string, presetId: string) => {
    setIsSubmitting(true);
    setActionError(null);

    const idempotencyKey = `run-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    try {
      const res = await fetch("/api/test-runner/jobs", {
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
      const res = await fetch(`/api/test-runner/jobs/${jobId}/cancel`, {
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
      const res = await fetch("/api/test-runner/auth", {
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
