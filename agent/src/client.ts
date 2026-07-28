import type { TestJob } from "./types.js";

export class AgentClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(serverUrl: string, agentToken: string) {
    this.baseUrl = serverUrl.replace(/\/$/, "");
    this.token = agentToken;
  }

  private get headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.token}`,
      "content-type": "application/json",
    };
  }

  async poll(
    agentId: string,
    catalogVersion?: string,
    catalog?: unknown,
  ): Promise<{ job: TestJob } | null> {
    const res = await fetch(`${this.baseUrl}/api/test-runner/agent/poll`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ agentId, catalogVersion, catalog }),
    });

    if (res.status === 204) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Poll failed with status ${res.status}: ${text}`);
    }

    return (await res.json()) as { job: TestJob };
  }

  async appendLogs(
    jobId: string,
    sequence: number,
    stream: "stdout" | "stderr" | "system",
    lines: string[],
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/test-runner/agent/jobs/${jobId}/logs`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ jobId, sequence, stream, lines }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Append logs failed with status ${res.status}: ${text}`);
    }
  }

  async complete(
    jobId: string,
    result: {
      status: string;
      exitCode?: number | null;
      startedAt?: string;
      finishedAt?: string;
      error?: string;
    },
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/test-runner/agent/jobs/${jobId}/complete`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        jobId,
        status: result.status,
        exitCode: result.exitCode,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        error: result.error,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Complete job failed with status ${res.status}: ${text}`);
    }
  }
}
