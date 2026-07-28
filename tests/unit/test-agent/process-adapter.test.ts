import { describe, expect, it, vi } from "vitest";
import { resolveExecutable, terminateProcessTree } from "../../../agent/src/process-adapter";
import childProcess from "node:child_process";

describe("Agent Process Adapter", () => {
  it("resolves npm, npx, pnpm, and yarn to .cmd on Windows platform", () => {
    expect(resolveExecutable("npm", "win32")).toBe("npm.cmd");
    expect(resolveExecutable("npx", "win32")).toBe("npx.cmd");
    expect(resolveExecutable("pnpm", "win32")).toBe("pnpm.cmd");
    expect(resolveExecutable("yarn", "win32")).toBe("yarn.cmd");
    expect(resolveExecutable("node", "win32")).toBe("node");
  });

  it("leaves commands unchanged on non-Windows platforms", () => {
    expect(resolveExecutable("npm", "linux")).toBe("npm");
    expect(resolveExecutable("npx", "darwin")).toBe("npx");
  });

  it("calls taskkill /PID /T /F on Windows process tree termination", () => {
    const spy = vi
      .spyOn(childProcess, "spawnSync")
      .mockReturnValue({} as unknown as ReturnType<typeof childProcess.spawnSync>);
    terminateProcessTree(1234, "win32");
    expect(spy).toHaveBeenCalledWith(
      "taskkill.exe",
      ["/PID", "1234", "/T", "/F"],
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
    spy.mockRestore();
  });
});
