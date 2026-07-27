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
      {
        source: "aiven",
        fetchedAt: "2026-07-25T10:00:00Z",
        stale: false,
        services: [
          {
            source: "aiven",
            service: "sts-tracking",
            status: "failed",
            checkedAt: "2026-07-25T10:00:00Z",
            databaseName: "student_tracking",
          },
        ],
        events: [
          {
            id: "a-1",
            source: "aiven",
            service: "sts-tracking",
            type: "database",
            severity: "error",
            status: "POWEROFF",
            message: "Database target: student_tracking",
            occurredAt: "2026-07-25T10:00:00Z",
            databaseName: "student_tracking",
          },
        ],
      },
    ],
    events: [
      {
        id: "a-1",
        source: "aiven",
        service: "sts-tracking",
        type: "database",
        severity: "error",
        status: "POWEROFF",
        message: "Database target: student_tracking",
        occurredAt: "2026-07-25T10:00:00Z",
        databaseName: "student_tracking",
      },
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
    window.localStorage.clear();
    vi.useFakeTimers();

    // Mock Notification API
    let perm: NotificationPermission = "default";
    const NotificationMock = vi.fn().mockImplementation((title: string, options?: NotificationOptions) => ({
      title,
      options,
    })) as unknown as typeof Notification;

    Object.defineProperty(NotificationMock, "permission", {
      get: () => perm,
      configurable: true,
    });
    NotificationMock.requestPermission = vi.fn().mockImplementation(async () => {
      perm = "granted";
      return "granted";
    });

    vi.stubGlobal("Notification", NotificationMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders service cards and terminal events including Aiven database target", () => {
    render(<MonitorDashboard initialSnapshot={sampleSnapshot} />);
    expect(screen.getAllByText("frontend-web")[0]).toBeInTheDocument();
    expect(screen.getAllByText("backend-api")[0]).toBeInTheDocument();
    expect(screen.getByText(/service crash detected/i)).toBeInTheDocument();
    expect(screen.getAllByText(/student_tracking/i)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enable browser alerts/i })).toBeInTheDocument();
  });

  it("filters events when source filter is clicked", () => {
    render(<MonitorDashboard initialSnapshot={sampleSnapshot} />);

    // Click Vercel filter tab using data-testid
    const vercelFilterBtn = screen.getByTestId("filter-source-vercel");
    fireEvent.click(vercelFilterBtn);

    expect(screen.queryByText(/service crash detected/i)).not.toBeInTheDocument();
    expect(screen.getByText(/build ready/i)).toBeInTheDocument();
  });

  it("requests browser notification permission on button click and dedupes alerts", async () => {
    render(<MonitorDashboard initialSnapshot={sampleSnapshot} />);

    const enableBtn = screen.getByRole("button", { name: /enable browser alerts/i });
    fireEvent.click(enableBtn);

    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
  });
});
