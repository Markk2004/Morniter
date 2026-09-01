import type {
  TestProjectCatalog,
  TestJob,
  TestProgress,
  ExecutionResult,
  PlaywrightCatalog,
  PlaywrightJob,
  PlaywrightExecutionResult,
  BrowserExecutionResult,
} from "./types.js";

export interface LogBatchPayloadEntry {
  stream: "stdout" | "stderr" | "system";
  message: string;
  browser?: string;
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
      "x-agent-id": this.agentId,
    };
  }

  // Legacy preset runner methods
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

  // New Playwright runner methods
  async pollPlaywright(
    catalogVersion: string,
    catalog?: PlaywrightCatalog,
    capabilities?: { browsers?: { chromium?: boolean; firefox?: boolean; webkit?: boolean }; headed?: boolean; workspaceExecution?: boolean },
  ): Promise<PlaywrightJob | null> {
    const url = `${this.serverUrl}/api/playwright-runner/agent/poll`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        agentId: this.agentId,
        catalogVersion,
        catalog,
        capabilities,
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

    const data = (await res.json()) as { job?: PlaywrightJob };
    return data.job ?? null;
  }

  async heartbeatPlaywright(
    jobId: string,
    browserResults?: BrowserExecutionResult[],
  ): Promise<{ cancelRequested: boolean }> {
    const url = `${this.serverUrl}/api/playwright-runner/agent/jobs/${jobId}/heartbeat`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        observedAt: new Date().toISOString(),
        browserResults,
      }),
    });

    if (!res.ok) {
      return { cancelRequested: false };
    }

    return (await res.json()) as { cancelRequested: boolean };
  }

  async appendPlaywrightLogs(
    jobId: string,
    sequenceStart: number,
    entries: LogBatchPayloadEntry[],
    browserResults?: BrowserExecutionResult[],
  ): Promise<{ sequenceStart: number; nextSequence: number; truncated: boolean }> {
    const url = `${this.serverUrl}/api/playwright-runner/agent/jobs/${jobId}/logs`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        sequenceStart,
        entries,
        browserResults,
      }),
    });

    if (!res.ok) {
      let errorReason = "";
      try {
        const errJson = (await res.json()) as { error?: string };
        if (errJson && typeof errJson.error === "string") {
          errorReason = `: ${errJson.error.slice(0, 120)}`;
        }
      } catch {
        // Ignore body parse errors
      }
      throw new Error(`Failed to append Playwright logs: HTTP ${res.status}${errorReason}`);
    }

    return (await res.json()) as { sequenceStart: number; nextSequence: number; truncated: boolean };
  }

  async completePlaywright(jobId: string, result: PlaywrightExecutionResult): Promise<void> {
    const url = `${this.serverUrl}/api/playwright-runner/agent/jobs/${jobId}/complete`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        status: result.status,
        sessionCloseReason: result.sessionCloseReason,
        browserResults: result.browserResults,
        runnerResults: result.runnerResults,
        artifacts: result.artifacts,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        error: result.error,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to complete Playwright job: HTTP ${res.status}`);
    }
  }

  async pollMutation(): Promise<import("./types.js").RecipeSaveMutation | null> {
    const url = `${this.serverUrl}/api/playwright-runner/agent/mutations/poll`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ agentId: this.agentId }),
    });

    if (!res.ok || res.status === 204) {
      return null;
    }

    const data = (await res.json()) as { mutation?: import("./types.js").RecipeSaveMutation };
    return data.mutation ?? null;
  }

  async completeMutation(
    mutationId: string,
    leaseToken: string,
    result: {
      status: "succeeded" | "conflict" | "rejected" | "failed";
      newRevision?: string;
      writtenFiles?: string[];
      error?: string;
    },
  ): Promise<void> {
    const url = `${this.serverUrl}/api/playwright-runner/agent/mutations/${mutationId}/complete`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ leaseToken, ...result }),
    });

    if (!res.ok) {
      throw new Error(`Failed to complete mutation: HTTP ${res.status}`);
    }
  }
}
