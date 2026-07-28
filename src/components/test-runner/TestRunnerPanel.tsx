"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ExecutionUnlock from "./ExecutionUnlock";
import JobTerminal from "./JobTerminal";
import JobHistory from "./JobHistory";
import type {
  TestProjectCatalog,
  TestJob,
  TestLogLine,
} from "@/lib/test-runner/types";

export default function TestRunnerPanel() {
  const [online, setOnline] = useState(false);
  const [catalog, setCatalog] = useState<TestProjectCatalog | null>(null);
  const [jobs, setJobs] = useState<TestJob[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const [activeJob, setActiveJob] = useState<TestJob | null>(null);
  const [logLines, setLogLines] = useState<TestLogLine[]>([]);
  const lastSequenceRef = useRef<number>(-1);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch catalog & online status
  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/test-runner/catalog");
      if (res.ok) {
        const data = await res.json();
        setOnline(data.online);
        setCatalog(data.catalog);

        // Pre-select first project & preset if not already selected
        if (data.catalog?.projects?.length > 0) {
          const firstProj = data.catalog.projects[0];
          setSelectedProjectId((prev) => prev || firstProj.id);
          if (firstProj.presets?.length > 0) {
            setSelectedPresetId((prev) => prev || firstProj.presets[0].id);
          }
        }
      }
    } catch {
      setOnline(false);
    }
  }, []);

  // Fetch job history
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/test-runner/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Poll active job details & new log lines
  const pollActiveJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(
        `/api/test-runner/jobs/${jobId}?afterSequence=${lastSequenceRef.current}`,
      );
      if (res.ok) {
        const data: { job: TestJob; lines: TestLogLine[] } = await res.json();
        setActiveJob(data.job);

        if (data.lines && data.lines.length > 0) {
          setLogLines((prev) => [...prev, ...data.lines]);
          const maxSeq = Math.max(...data.lines.map((l) => l.sequence));
          lastSequenceRef.current = maxSeq;
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await fetchCatalog();
      if (active) {
        await fetchJobs();
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchCatalog, fetchJobs]);

  // Interval polling
  useEffect(() => {
    const isJobActive =
      activeJob && (activeJob.status === "queued" || activeJob.status === "running");

    const intervalMs = isJobActive ? 2000 : 60000;
    const timer = setInterval(() => {
      if (isJobActive && activeJob) {
        pollActiveJob(activeJob.id);
      } else {
        fetchCatalog();
        fetchJobs();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [activeJob, fetchCatalog, fetchJobs, pollActiveJob]);

  // Handle project select change
  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = catalog?.projects.find((p) => p.id === projId);
    if (proj && proj.presets.length > 0) {
      setSelectedPresetId(proj.presets[0].id);
    } else {
      setSelectedPresetId("");
    }
  };

  // Run selected preset
  const handleRunPreset = async () => {
    if (!selectedProjectId || !selectedPresetId) return;

    setLoadingAction(true);
    setActionError(null);

    try {
      const res = await fetch("/api/test-runner/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProjectId,
          presetId: selectedPresetId,
        }),
      });

      if (res.status === 403) {
        setIsUnlocked(false);
        setActionError("Execution session expired or required. Unlock execution first.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || "Failed to enqueue test job.");
        return;
      }

      const job: TestJob = await res.json();
      setActiveJob(job);
      setLogLines([]);
      lastSequenceRef.current = -1;
      fetchJobs();
    } catch {
      setActionError("Network error attempting to enqueue test job.");
    } finally {
      setLoadingAction(false);
    }
  };

  // Cancel running job
  const handleCancelJob = async () => {
    if (!activeJob) return;
    setLoadingAction(true);

    try {
      const res = await fetch(`/api/test-runner/jobs/${activeJob.id}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveJob(updated);
        fetchJobs();
      }
    } catch {
      // Ignore
    } finally {
      setLoadingAction(false);
    }
  };

  // Lock session
  const handleLock = async () => {
    try {
      await fetch("/api/test-runner/lock", { method: "POST" });
    } catch {
      // Ignore
    }
    setIsUnlocked(false);
  };

  // Select historical job to view logs
  const handleSelectJob = (job: TestJob) => {
    setActiveJob(job);
    setLogLines([]);
    lastSequenceRef.current = -1;
    pollActiveJob(job.id);
  };

  const selectedProject = catalog?.projects.find((p) => p.id === selectedProjectId);
  const selectedPreset = selectedProject?.presets.find((p) => p.id === selectedPresetId);

  const isJobRunning = Boolean(
    activeJob && (activeJob.status === "queued" || activeJob.status === "running"),
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span>⚡ Test Runner Console</span>
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                online
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  online ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              {online ? "Local Agent Online" : "Local Agent Offline"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Execute verified test presets on Windows Local Agent via secure Redis queue.
          </p>
        </div>

        {isUnlocked && (
          <button
            onClick={handleLock}
            className="self-start sm:self-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            🔒 Lock Execution
          </button>
        )}
      </div>

      {/* Unlock Step-Up Card if locked */}
      {!isUnlocked && (
        <ExecutionUnlock onUnlocked={() => setIsUnlocked(true)} />
      )}

      {/* Preset Controls */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Project Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Target Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              disabled={!online || isJobRunning}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 disabled:opacity-50"
            >
              {catalog?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          {/* Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Test Preset</label>
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              disabled={!online || isJobRunning || !selectedProject}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 disabled:opacity-50"
            >
              {selectedProject?.presets.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Read-Only Command Preview */}
        {selectedPreset && (
          <div className="p-3 bg-slate-900/90 border border-slate-800/80 rounded-lg space-y-1 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Read-Only Execution Contract Preview</span>
              <span>Timeout: {selectedPreset.timeoutSeconds}s</span>
            </div>
            <div className="text-sky-300 font-semibold">{selectedPreset.commandPreview}</div>
            <div className="text-[11px] text-slate-500">{selectedPreset.description}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {!isJobRunning ? (
            <button
              onClick={handleRunPreset}
              disabled={!online || !isUnlocked || !selectedPresetId || loadingAction}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-sky-950/50 flex items-center gap-2"
            >
              ▶ Run Selected Preset
            </button>
          ) : (
            <button
              onClick={handleCancelJob}
              disabled={loadingAction}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              🛑 Cancel Execution
            </button>
          )}

          {activeJob && (
            <div className="text-xs font-mono text-slate-400">
              Active Job: <span className="text-slate-200">{activeJob.id}</span> (
              <span className="uppercase text-sky-400">{activeJob.status}</span>)
            </div>
          )}
        </div>

        {actionError && <p className="text-xs text-rose-400 font-mono">{actionError}</p>}
      </div>

      {/* Execution Terminal */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Execution Log Stream
          </h4>
          {activeJob?.truncated && (
            <span className="text-[11px] text-amber-400">Log output truncated</span>
          )}
        </div>
        <JobTerminal
          lines={logLines}
          isRunning={Boolean(isJobRunning)}
          truncated={activeJob?.truncated ? true : undefined}
        />
      </div>

      {/* History Drawer */}
      <JobHistory
        jobs={jobs}
        activeJobId={activeJob?.id}
        onSelectJob={handleSelectJob}
      />
    </div>
  );
}
