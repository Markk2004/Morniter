// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MonitorDashboard from "@/components/monitor/MonitorDashboard";
import type { MonitorSnapshot } from "@/lib/monitor/types";

describe("MonitorDashboard UI", () => {
  const sampleSnapshot: MonitorSnapshot = {
    generatedAt: "2026-07-25T10:00:00Z",
    refreshAfterSeconds: 15,
    partial: false,
    providers: [
      {
        source: "vercel",
        fetchedAt: "2026-07-25T10:00:00Z",
        stale: false,
        services: [{ source: "vercel", service: "frontend-web", status: "healthy", checkedAt: "2026-07-25T10:00:00Z" }],
        events: [
          {
            id: "v-1",
            source: "vercel",
            service: "frontend-web",
            type: "deployment",
            severity: "info",
            status: "READY",
            message: "Build ready",
            occurredAt: "2026-07-25T10:00:00Z",
          },
        ],
      },
      {
        source: "render",
        fetchedAt: "2026-07-25T10:00:00Z",
        stale: false,
        services: [{ source: "render", service: "backend-api", status: "failed", checkedAt: "2026-07-25T10:00:00Z" }],
        events: [
          {
            id: "r-1",
            source: "render",
            service: "backend-api",
            type: "runtime",
            severity: "error",
            status: "FAILED",
            message: "Service crash detected",
            occurredAt: "2026-07-25T10:01:00Z",
          },
        ],
      },
    ],
    events: [
      {
        id: "r-1",
        source: "render",
        service: "backend-api",
        type: "runtime",
        severity: "error",
        status: "FAILED",
        message: "Service crash detected",
        occurredAt: "2026-07-25T10:01:00Z",
      },
      {
        id: "v-1",
        source: "vercel",
        service: "frontend-web",
        type: "deployment",
        severity: "info",
        status: "READY",
        message: "Build ready",
        occurredAt: "2026-07-25T10:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders service cards and terminal events", () => {
    render(<MonitorDashboard initialSnapshot={sampleSnapshot} />);
    expect(screen.getAllByText("frontend-web")[0]).toBeInTheDocument();
    expect(screen.getAllByText("backend-api")[0]).toBeInTheDocument();
    expect(screen.getByText(/service crash detected/i)).toBeInTheDocument();
  });

  it("filters events when source filter is clicked", () => {
    render(<MonitorDashboard initialSnapshot={sampleSnapshot} />);

    // Click Vercel filter tab using data-testid
    const vercelFilterBtn = screen.getByTestId("filter-source-vercel");
    fireEvent.click(vercelFilterBtn);

    expect(screen.queryByText(/service crash detected/i)).not.toBeInTheDocument();
    expect(screen.getByText(/build ready/i)).toBeInTheDocument();
  });
});
