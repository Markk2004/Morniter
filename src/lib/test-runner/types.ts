export interface TestPreset {
  id: string;
  name: string;
  description: string;
  commandPreview: string;
  timeoutSeconds: number;
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

export type TestJobStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface TestJob {
  id: string;
  projectId: string;
  presetId: string;
  presetName: string;
  status: TestJobStatus;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
  agentId?: string;
  cancelRequested?: boolean;
  truncated?: boolean;
  error?: string;
}

export type TestLogStream = "stdout" | "stderr" | "system";

export interface TestLogLine {
  sequence: number;
  stream: TestLogStream;
  message: string;
  timestamp: string;
}

export interface TestLogChunk {
  jobId: string;
  lines: TestLogLine[];
  truncated?: boolean;
}
