// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MonitorShell } from "@/components/monitor/MonitorShell";
import { usePathname } from "next/navigation";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("MonitorShell", () => {
  it("renders the cat logo in the header", () => {
    vi.mocked(usePathname).mockReturnValue("/monitor");
    render(
      <MonitorShell displayName="Monitor Operator">
        <div>Content</div>
      </MonitorShell>,
    );

    expect(screen.getByRole("img", { name: "Project Monitor logo" })).toBeInTheDocument();
  });

  it("marks Logs active on /monitor", () => {
    vi.mocked(usePathname).mockReturnValue("/monitor");
    render(
      <MonitorShell displayName="Monitor Operator">
        <div>Content</div>
      </MonitorShell>,
    );

    const logsLink = screen.getByRole("link", { name: "Logs" });
    const testsLink = screen.getByRole("link", { name: "Tests" });

    expect(logsLink).toHaveAttribute("aria-current", "page");
    expect(testsLink).not.toHaveAttribute("aria-current");
  });

  it("marks Tests active on /monitor/tests", () => {
    vi.mocked(usePathname).mockReturnValue("/monitor/tests");
    render(
      <MonitorShell displayName="Monitor Operator">
        <div>Content</div>
      </MonitorShell>,
    );

    const logsLink = screen.getByRole("link", { name: "Logs" });
    const testsLink = screen.getByRole("link", { name: "Tests" });

    expect(testsLink).toHaveAttribute("aria-current", "page");
    expect(logsLink).not.toHaveAttribute("aria-current");
  });

  it("uses max-w-none on /monitor/tests and max-w-7xl on /monitor", () => {
    vi.mocked(usePathname).mockReturnValue("/monitor/tests");
    const { rerender } = render(
      <MonitorShell displayName="Monitor Operator">
        <div>Content</div>
      </MonitorShell>,
    );

    const testsWorkspace = screen.getByTestId("monitor-page-workspace");
    expect(testsWorkspace).toHaveClass("max-w-none");

    vi.mocked(usePathname).mockReturnValue("/monitor");
    rerender(
      <MonitorShell displayName="Monitor Operator">
        <div>Content</div>
      </MonitorShell>,
    );

    const logsWorkspace = screen.getByTestId("monitor-page-workspace");
    expect(logsWorkspace).toHaveClass("max-w-7xl");
  });
});
