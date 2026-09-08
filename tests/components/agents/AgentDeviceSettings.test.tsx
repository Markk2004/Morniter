// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgentDeviceSettings } from "@/components/agents/AgentDeviceSettings";

describe("AgentDeviceSettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("creates a short-lived pairing code without rendering a device token", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/test-runner/lock")) {
        return new Response(JSON.stringify({ unlocked: true }), { status: 200 });
      }
      if (url.includes("/api/playwright-runner/agents/pairing-code") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ code: "ABC-123", expiresAt: new Date(Date.now() + 600_000).toISOString() }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ devices: [] }), { status: 200 });
    });

    render(<AgentDeviceSettings />);

    await waitFor(() => expect(screen.getByText("ยังไม่มีเครื่องที่จับคู่")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "สร้าง Pairing Code" }));

    await waitFor(() => expect(screen.getByText("ABC-123")).toBeInTheDocument());
    expect(screen.queryByText(/deviceToken/i)).not.toBeInTheDocument();
  });

  it("lists a device and revokes it after confirmation", async () => {
    const fetchMock = vi.mocked(fetch);
    let revoked = false;
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/test-runner/lock")) {
        return new Response(JSON.stringify({ unlocked: true }), { status: 200 });
      }
      if (url.includes("/revoke") && init?.method === "POST") {
        revoked = true;
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          devices: revoked ? [] : [{
            deviceId: "8d8f9f41-08f1-4df9-9f24-0f3b26b3f2ae",
            agentId: "projectsts-win-01",
            status: "online",
            createdAt: "2026-09-08T10:00:00.000Z",
            lastSeenAt: "2026-09-08T10:05:00.000Z",
          }],
        }),
        { status: 200 },
      );
    });

    render(<AgentDeviceSettings />);

    await waitFor(() => expect(screen.getByText("projectsts-win-01")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(screen.getByText("ยังไม่มีเครื่องที่จับคู่")).toBeInTheDocument());
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("projectsts-win-01"));
  });
});
