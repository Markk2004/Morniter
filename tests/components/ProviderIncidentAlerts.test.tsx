// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProviderIncidentAlerts from "@/components/monitor/ProviderIncidentAlerts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProviderIncidentAlerts", () => {
  it("renders healthy state with no hydration mismatch", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    });

    const { container } = render(
      <ProviderIncidentAlerts services={[]} events={[]} />,
    );

    expect(screen.getByText(/Services Status Monitor:/i)).toBeInTheDocument();
    expect(screen.getByText(/ALL HEALTHY/i)).toBeInTheDocument();

    // After mount useEffect runs
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: /Enable browser alerts/i })).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it("renders incidents and allows requesting notification permission", async () => {
    const requestMock = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: requestMock,
    });

    render(
      <ProviderIncidentAlerts
        services={[
          {
            source: "render",
            service: "backend-api",
            status: "degraded",
            checkedAt: new Date().toISOString(),
          },
        ]}
        events={[
          {
            id: "evt-1",
            source: "render",
            service: "backend-api",
            type: "deployment",
            severity: "warning",
            status: "building",
            message: "Build timed out",
            occurredAt: new Date().toISOString(),
          },
        ]}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/RENDER INCIDENT/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enable browser alerts/i })).toBeInTheDocument();
  });
});
