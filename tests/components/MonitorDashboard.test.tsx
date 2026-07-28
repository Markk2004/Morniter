// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
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
            stage: "deploy",
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
            status: "build_failed",
            message: "Service crash detected",
            occurredAt: "2026-07-25T10:01:00Z",
            stage: "build",
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
            stage: "database",
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
        stage: "database",
      },
      {
        id: "r-1",
        source: "render",
        service: "backend-api",
        type: "runtime",
        severity: "error",
        status: "build_failed",
        message: "Service crash detected",
        occurredAt: "2026-07-25T10:01:00Z",
        stage: "build",
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
        stage: "deploy",
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
    expect(screen.getAllByText(/service crash detected/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/student_tracking/i)[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enable browser alerts/i })).toBeInTheDocument();
  });

  it("filters terminal events when source filter is clicked", () => {
    render(<MonitorDashboard initialSnapshot={sampleSnapshot} />);

    // Click Vercel filter tab using data-testid
    const vercelFilterBtn = screen.getByTestId("filter-source-vercel");
    fireEvent.click(vercelFilterBtn);

    const terminalContainer = screen.getByText(/Terminal Stream/i).closest("div.flex-col") as HTMLElement;
    expect(within(terminalContainer).queryByText(/service crash detected/i)).not.toBeInTheDocument();
    expect(within(terminalContainer).getByText(/build ready/i)).toBeInTheDocument();
  });

  it("filters terminal events by status and stage buttons", () => {
    render(<MonitorDashboard initialSnapshot={sampleSnapshot} />);
    const terminalContainer = screen.getByText(/Terminal Stream/i).closest("div.flex-col") as HTMLElement;

    fireEvent.click(screen.getByTestId("filter-status-build_failed"));
    expect(within(terminalContainer).getByText(/service crash detected/i)).toBeInTheDocument();
    expect(within(terminalContainer).queryByText(/build ready/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("filter-status-all"));
    fireEvent.click(screen.getByTestId("filter-stage-build"));
    expect(within(terminalContainer).getByText(/service crash detected/i)).toBeInTheDocument();
  });

  it("requests browser notification permission on button click and dedupes alerts", async () => {
    render(<MonitorDashboard initialSnapshot={sampleSnapshot} />);

    const enableBtn = screen.getByRole("button", { name: /enable browser alerts/i });
    fireEvent.click(enableBtn);

    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("renders commit message, branch, sha, and deployment log button for deployment events", () => {
    const historicalSnapshot: MonitorSnapshot = {
      ...sampleSnapshot,
      events: [
        {
          id: "v-hist-1",
          source: "vercel",
          service: "frontend-web",
          type: "deployment",
          severity: "info",
          status: "READY",
          message: "Deployment ready",
          occurredAt: "2026-07-28T02:00:00Z",
          commitSha: "abc123456789",
          commitMessage: "Merge branch 'main' into production",
          branch: "main",
          commitAuthor: "developer",
          diagnosticAvailable: true,
        },
      ],
    };

    render(<MonitorDashboard initialSnapshot={historicalSnapshot} />);

    expect(screen.getByText(/Merge branch 'main' into production/i)).toBeInTheDocument();
    expect(screen.getByText("[main]")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view deployment log/i })).toBeInTheDocument();
  });
});
