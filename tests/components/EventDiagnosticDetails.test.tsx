// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventDiagnosticDetails from "@/components/monitor/EventDiagnosticDetails";

describe("EventDiagnosticDetails", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads diagnostic lines when the user expands the event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          eventId: "render-dep_1",
          summary: "npm run build exited with code 1",
          truncated: false,
          lines: [
            {
              id: "log-1",
              stage: "build",
              level: "error",
              message: "npm run build exited with code 1",
              occurredAt: "2026-07-28T03:00:00Z",
            },
          ],
        }),
      }),
    );

    render(<EventDiagnosticDetails eventId="render-dep_1" />);
    fireEvent.click(screen.getByRole("button", { name: /view diagnostic details/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/exited with code 1/i)[0]).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/monitor/diagnostics?eventId=render-dep_1",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("shows a generic load error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    render(<EventDiagnosticDetails eventId="render-dep_1" />);
    fireEvent.click(screen.getByRole("button", { name: /view diagnostic details/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load diagnostic logs",
    );
  });

  it("collapses without refetching loaded diagnostics", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        eventId: "render-dep_1",
        summary: "Build failed",
        lines: [],
        truncated: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<EventDiagnosticDetails eventId="render-dep_1" />);

    fireEvent.click(screen.getByRole("button", { name: /view diagnostic details/i }));
    expect(await screen.findByText("Log output was truncated")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /hide diagnostic details/i }));
    fireEvent.click(screen.getByRole("button", { name: /view diagnostic details/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders 'View deployment log' when eventType is deployment", () => {
    render(<EventDiagnosticDetails eventId="vercel-dep_1" eventType="deployment" />);
    expect(screen.getByRole("button", { name: /view deployment log/i })).toBeInTheDocument();
  });

  it("shows rate limit error message when response status is 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    render(<EventDiagnosticDetails eventId="vercel-dep_1" eventType="deployment" />);
    fireEvent.click(screen.getByRole("button", { name: /view deployment log/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider rate limit reached. Try again later.",
    );
  });
});
