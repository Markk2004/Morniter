import { describe, it, expect, vi } from "vitest";
import {
  getCandidateWindowTitles,
  focusExistingMorniterWindow,
} from "../src/main/window-activator";

describe("Window Activator", () => {
  it("generates default candidate titles including Project Monitor and Morniter", () => {
    const titles = getCandidateWindowTitles();
    expect(titles).toContain("Project Monitor");
    expect(titles).toContain("Morniter");
  });

  it("extracts hostname and subdomain from production server URL", () => {
    const titles = getCandidateWindowTitles("https://monitorsoftdeath.vercel.app/monitor/tests");
    expect(titles).toContain("Project Monitor");
    expect(titles).toContain("Morniter");
    expect(titles).toContain("monitorsoftdeath.vercel.app");
    expect(titles).toContain("monitorsoftdeath");
  });

  it("extracts host and port for localhost server URL", () => {
    const titles = getCandidateWindowTitles("http://localhost:3000/settings");
    expect(titles).toContain("Project Monitor");
    expect(titles).toContain("Morniter");
    expect(titles).toContain("localhost:3000");
  });

  it("uses custom executor to test focusExistingMorniterWindow returns true on match", async () => {
    const mockExecutor = vi.fn().mockResolvedValue(true);
    const result = await focusExistingMorniterWindow(
      "https://monitorsoftdeath.vercel.app",
      mockExecutor,
    );

    expect(result).toBe(true);
    expect(mockExecutor).toHaveBeenCalledTimes(1);
    const passedTitles = mockExecutor.mock.calls[0][0];
    expect(passedTitles).toContain("Project Monitor");
    expect(passedTitles).toContain("monitorsoftdeath");
  });

  it("handles executor returning false when window is not found", async () => {
    const mockExecutor = vi.fn().mockResolvedValue(false);
    const result = await focusExistingMorniterWindow(
      "https://monitorsoftdeath.vercel.app",
      mockExecutor,
    );

    expect(result).toBe(false);
    expect(mockExecutor).toHaveBeenCalledTimes(1);
  });
});
