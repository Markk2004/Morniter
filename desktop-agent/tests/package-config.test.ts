import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

describe("desktop package contract", () => {
  it("uses a per-user NSIS installer and bundles the Agent", () => {
    expect(packageJson.main).toBe("out/main/index.js");
    expect(packageJson.build.appId).toBe("com.softdeath.morniter.agent");
    expect(packageJson.build.nsis.perMachine).toBe(false);
    expect(packageJson.build.extraResources).toEqual([
      { from: "build/agent", to: "agent" },
      { from: "build/morniter-agent-tray.png", to: "morniter-agent-tray.png" },
    ]);
  });

  it("offers an explicit choice for retaining app data during uninstall", () => {
    const script = fs.readFileSync(path.resolve(process.cwd(), "build/installer.nsh"), "utf8");
    expect(script).toContain("IDNO keepAgentData");
    expect(script).toContain("$APPDATA\\Morniter Local Agent");
  });
});
