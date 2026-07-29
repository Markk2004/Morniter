// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RedisStatusPanel } from "@/components/monitor/RedisStatusPanel";
import type { RedisStatusResponse } from "@/lib/test-runner/redis-status";

const healthyStatus: RedisStatusResponse = {
  status: "HEALTHY",
  checkedAt: "2026-07-29T00:00:00.000Z",
  latencyMs: 12,
  metrics: {
    totalCommandsProcessed: 4200,
    usedMemoryBytes: 2048,
    totalKeys: 12,
    uptimeSeconds: 3720,
  },
  appCommands: {
    total: 8,
    byCommand: { GET: 5, SET: 2, ZADD: 1 },
    windowStartedAt: "2026-07-29T00:00:00.000Z",
    windowDurationSeconds: 60,
  },
  error: null,
};

describe("RedisStatusPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows loading state", () => {
    render(<RedisStatusPanel data={null} isLoading />);

    expect(screen.getByText(/checking redis status/i)).toBeInTheDocument();
  });

  it("shows healthy metrics and command breakdown", () => {
    render(<RedisStatusPanel data={healthyStatus} isLoading={false} />);

    expect(screen.getByRole("heading", { name: /redis status/i })).toBeInTheDocument();
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    expect(screen.getByText("4,200")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText(/GET/)).toHaveTextContent("GET 5");
    expect(screen.getByText(/keys: 12/i)).toBeInTheDocument();
  });

  it("shows unavailable state without requiring a response", () => {
    render(<RedisStatusPanel data={null} isLoading={false} />);

    expect(screen.getByText("UNAVAILABLE")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable")).toHaveLength(4);
  });
});
