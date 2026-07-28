import type { TestProjectCatalog, TestJob, TestProgress, ExecutionResult } from "./types";

export interface LogBatchPayloadEntry {
  stream: "stdout" | "stderr" | "system";
  message: string;
}

export class AgentClient {
  constructor(
    private serverUrl: string,
    private agentToken: string,
    private agentId: string,
  ) {}

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.agentToken}`,
      "Content-Type": "application/json",
    };
  }

  async poll(catalogVersion: string, catalog?: TestProjectCatalog): Promise<TestJob | null> {
    const url = `${this.serverUrl}/api/test-runner/agent/poll`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        agentId: this.agentId,
        catalogVersion,
        catalog,
      }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Agent token authentication failed (401)");
      }
      return null;
    }

    if (res.status === 204) {
      return null;
    }

    const data = (await res.json()) as { job?: TestJob };
    return data.job ?? null;
  }

  async heartbeat(
    jobId: string,
    progress?: TestProgress,
  ): Promise<{ cancelRequested: boolean; leaseExpiresAt: string }> {
    const url = `${this.serverUrl}/api/test-runner/agent/jobs/${jobId}/heartbeat`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        observedAt: new Date().toISOString(),
        progress,
      }),
    });

    if (!res.ok) {
      return { cancelRequested: false, leaseExpiresAt: new Date(Date.now() + 45000).toISOString() };
    }

    return (await res.json()) as { cancelRequested: boolean; leaseExpiresAt: string };
  }

  async appendLogs(
    jobId: string,
    sequenceStart: number,
    entries: LogBatchPayloadEntry[],
    progress?: TestProgress,
  ): Promise<{ sequenceStart: number; nextSequence: number; truncated: boolean }> {
    const url = `${this.serverUrl}/api/test-runner/agent/jobs/${jobId}/logs`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        sequenceStart,
        entries,
        progress,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to append logs: HTTP ${res.status}`);
    }

    return (await res.json()) as { sequenceStart: number; nextSequence: number; truncated: boolean };
  }

  async complete(jobId: string, result: ExecutionResult): Promise<void> {
    const url = `${this.serverUrl}/api/test-runner/agent/jobs/${jobId}/complete`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        status: result.status,
        exitCode: result.exitCode,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        error: result.error,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to complete job: HTTP ${res.status}`);
    }
  }
}
