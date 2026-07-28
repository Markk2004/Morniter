// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { LiveTestTerminal } from "@/components/test-runner/LiveTestTerminal";
import type { TestLogLine } from "@/lib/test-runner/types";

afterEach(() => {
  cleanup();
});

describe("LiveTestTerminal", () => {
  it("renders at most 300 tagged lines", () => {
    const lines: TestLogLine[] = Array.from({ length: 1200 }, (_, sequence) => ({
      sequence,
      stream: sequence % 2 === 0 ? "stdout" : "stderr",
      message: `log line ${sequence}`,
      timestamp: "2026-07-28T10:00:00.000Z",
    }));

    render(<LiveTestTerminal lines={lines} />);

    const renderedLines = screen.getAllByTestId("terminal-line");
    expect(renderedLines).toHaveLength(300);
    expect(screen.getByTestId("terminal-hidden-count")).toHaveTextContent("900 older lines hidden");
  });

  it("loads older lines and triggers onLoadOlder callback", () => {
    const onLoadOlder = vi.fn();
    const lines: TestLogLine[] = [
      { sequence: 0, stream: "stdout", message: "Step 1", timestamp: "2026-07-28T10:00:00.000Z" },
    ];

    render(<LiveTestTerminal lines={lines} hasOlder onLoadOlder={onLoadOlder} />);

    const loadBtn = screen.getByRole("button", { name: "Load older logs" });
    fireEvent.click(loadBtn);
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
  });
});
