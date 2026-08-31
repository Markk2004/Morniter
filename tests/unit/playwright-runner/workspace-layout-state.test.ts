import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_LAYOUT,
  parseWorkspaceLayoutPreferences,
  serializeWorkspaceLayoutPreferences,
  clampExplorerWidth,
  clampTerminalHeight,
} from "@/components/playwright-runner/layout/workspace-layout-state";

describe("workspace layout preferences", () => {
  it("returns safe defaults when storage is missing or malformed", () => {
    expect(parseWorkspaceLayoutPreferences(null, 900)).toEqual(DEFAULT_WORKSPACE_LAYOUT);
    expect(parseWorkspaceLayoutPreferences("{", 900)).toEqual(DEFAULT_WORKSPACE_LAYOUT);
    expect(parseWorkspaceLayoutPreferences("null", 900)).toEqual(DEFAULT_WORKSPACE_LAYOUT);
    expect(parseWorkspaceLayoutPreferences("123", 900)).toEqual(DEFAULT_WORKSPACE_LAYOUT);
  });

  it("rejects an unsupported storage version", () => {
    const raw = JSON.stringify({ version: 99, explorerWidth: 400 });
    expect(parseWorkspaceLayoutPreferences(raw, 900)).toEqual(DEFAULT_WORKSPACE_LAYOUT);
  });

  it("clamps dimensions and validates the selected tab", () => {
    const raw = JSON.stringify({
      version: 1,
      explorerWidth: 900,
      terminalHeight: 900,
      terminalCollapsed: true,
      activeTab: "unknown",
    });
    expect(parseWorkspaceLayoutPreferences(raw, 800)).toEqual({
      version: 1,
      explorerWidth: 440,
      terminalHeight: 480,
      terminalCollapsed: true,
      activeTab: "explorer",
    });
  });

  it("clamps below minimum bounds correctly", () => {
    const raw = JSON.stringify({
      version: 1,
      explorerWidth: 100,
      terminalHeight: 50,
      terminalCollapsed: false,
      activeTab: "code",
    });
    expect(parseWorkspaceLayoutPreferences(raw, 800)).toEqual({
      version: 1,
      explorerWidth: 280,
      terminalHeight: 160,
      terminalCollapsed: false,
      activeTab: "code",
    });
  });

  it("safely treats non-boolean string 'false' or numbers in terminalCollapsed as false", () => {
    const raw = JSON.stringify({
      version: 1,
      explorerWidth: 320,
      terminalHeight: 240,
      terminalCollapsed: "false",
      activeTab: "explorer",
    });
    expect(parseWorkspaceLayoutPreferences(raw, 800).terminalCollapsed).toBe(false);
  });

  it("serializes only layout-safe fields", () => {
    const custom = {
      version: 1 as const,
      explorerWidth: 350,
      terminalHeight: 280,
      terminalCollapsed: true,
      activeTab: "terminal" as const,
      extraUnsafeField: "secret_token",
    };
    const serialized = serializeWorkspaceLayoutPreferences(custom);
    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      explorerWidth: 350,
      terminalHeight: 280,
      terminalCollapsed: true,
      activeTab: "terminal",
    });
  });

  it("clamps explorer width and terminal height helper functions directly", () => {
    expect(clampExplorerWidth(200)).toBe(280);
    expect(clampExplorerWidth(350)).toBe(350);
    expect(clampExplorerWidth(500)).toBe(440);

    expect(clampTerminalHeight(100, 1000)).toBe(160);
    expect(clampTerminalHeight(300, 1000)).toBe(300);
    expect(clampTerminalHeight(800, 1000)).toBe(600); // 60% of 1000
  });
});
