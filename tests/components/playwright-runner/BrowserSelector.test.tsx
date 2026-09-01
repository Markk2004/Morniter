// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BrowserSelector } from "@/components/playwright-runner/browser/BrowserSelector";
import { RunModeSelector } from "@/components/playwright-runner/browser/RunModeSelector";

afterEach(() => {
  cleanup();
});

describe("Browser & Mode Selectors", () => {
  it("toggles browser selections and indicates uninstalled browsers", () => {
    const onToggle = vi.fn();
    render(
      <BrowserSelector
        selected={["chromium"]}
        capabilities={{ chromium: true, firefox: true, webkit: false }}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText("Google Chrome")).toBeInTheDocument();
    expect(screen.getByText("Firefox")).toBeInTheDocument();
    expect(screen.getByText(/not installed/i)).toBeInTheDocument();

    const firefoxCheckbox = screen.getByLabelText("Firefox");
    fireEvent.click(firefoxCheckbox);
    expect(onToggle).toHaveBeenCalledWith("firefox");
  });

  it("uses plain-language Thai run mode labels while retaining Playwright terms in guidance", () => {
    const onChange = vi.fn();
    render(
      <RunModeSelector
        value="headless"
        headedAvailable={true}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("ทำงานเบื้องหลัง")).toBeInTheDocument();
    expect(screen.getByText("Headless · เร็ว เหมาะกับงานอัตโนมัติ")).toBeInTheDocument();

    const headedRadio = screen.getByRole("radio", { name: /แสดง Browser/i });
    fireEvent.click(headedRadio);
    expect(onChange).toHaveBeenCalledWith("headed");
    expect(screen.getByText("Headed · ดูขั้นตอนบนเครื่อง Agent")).toBeInTheDocument();
  });

  it("supports Interactive UI mode with desktop guidance", () => {
    const onChange = vi.fn();
    render(
      <RunModeSelector
        value="interactive"
        headedAvailable={true}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("Interactive UI")).toBeInTheDocument();
    expect(screen.getByText(/Playwright UI opens on the Windows computer/i)).toBeInTheDocument();
  });
});
