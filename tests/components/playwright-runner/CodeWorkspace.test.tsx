// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CodeWorkspace } from "@/components/playwright-runner/editor/CodeWorkspace";

afterEach(() => {
  cleanup();
});

describe("CodeWorkspace Component", () => {
  it("renders editor and updates code changes", () => {
    const onChange = vi.fn();
    render(
      <CodeWorkspace
        code="test('demo', () => {})"
        onChange={onChange}
        dirty={true}
      />,
    );

    expect(screen.getByText(/📝 Code Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Draft Modified/i)).toBeInTheDocument();

    const textarea = screen.getByLabelText(/Playwright Test Code/i);
    fireEvent.change(textarea, { target: { value: "test('updated', () => {})" } });
    expect(onChange).toHaveBeenCalledWith("test('updated', () => {})");
  });

  it("handles template insertion", () => {
    const onChange = vi.fn();
    render(<CodeWorkspace code="" onChange={onChange} />);

    const templateSelect = screen.getByLabelText(/Insert template/i);
    fireEvent.change(templateSelect, { target: { value: "Basic Navigation" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining("test(\"Page title and navigation\""),
    );
  });
});
