import fs from "node:fs/promises";
import path from "node:path";
import { app, utilityProcess, type UtilityProcess } from "electron";
import { readDeviceCredential } from "./credential-store";
import { readSettings } from "./settings-store";
import type { AgentState, PublicAgentState } from "../shared/preload-api";

type Listener = (state: PublicAgentState) => void;

export class AgentSupervisor {
  private child: UtilityProcess | null = null;
  private current: AgentState = "stopped";
  private listeners = new Set<Listener>();
  private stopping = false;
  private restartTimer: NodeJS.Timeout | null = null;
  private restartAttempt = 0;
  private readonly maxRestartAttempts = 5;

  state(): PublicAgentState { return { state: this.current }; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private setState(state: AgentState, message?: string) { this.current = state; const snapshot = { state, ...(message ? { message } : {}) }; for (const listener of this.listeners) listener(snapshot); }

  async start(): Promise<void> {
    if (this.child || this.restartTimer) return;
    const settings = await readSettings();
    const token = await readDeviceCredential();
    if (!settings || !token) throw new Error("AGENT_NOT_CONFIGURED");
    const configPath = path.join(app.getPath("userData"), "agent-config.json");
    const agentConfig = {
      agentId: settings.agentId,
      serverUrl: settings.serverUrl,
      agentToken: "device-token-from-secure-storage",
      deviceId: settings.deviceId,
      pollIntervalSeconds: 5,
      projects: settings.projects.map((project) => ({
        id: project.id,
        name: project.name,
        playwright: {
          workspaceRoot: project.workspaceRoot,
          testRoot: project.testRoot,
          config: project.config,
          automationMap: project.automationMap,
          allowedBrowsers: project.allowedBrowsers,
          allowHeaded: project.allowHeaded,
          allowWorkspaceExecution: project.allowWorkspaceExecution,
          maxTimeoutSeconds: project.maxTimeoutSeconds,
          envAllowlist: project.envAllowlist,
          allowedBaseUrls: project.allowedBaseUrls,
        },
      })),
    };
    await fs.writeFile(configPath, JSON.stringify(agentConfig), { encoding: "utf8", mode: 0o600 });
    this.stopping = false;
    this.setState("connecting");
    const entry = process.env.NODE_ENV === "development" ? path.resolve(process.cwd(), "../agent/dist/index.js") : path.join(process.resourcesPath, "agent", "index.cjs");
    this.child = utilityProcess.fork(entry, [], { env: { ...process.env, TEST_RUNNER_CONFIG: configPath, TEST_RUNNER_AGENT_TOKEN: token }, stdio: "pipe" });
    
    let stableTimer: NodeJS.Timeout | null = setTimeout(() => {
      this.restartAttempt = 0;
      stableTimer = null;
    }, 15_000);

    this.child.stdout?.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf8").trim();
      if (line.includes("started polling")) {
        this.setState("online");
      }
    });
    this.child.stderr?.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf8").trim();
      if (line) console.error(`[Agent stderr] ${line}`);
    });

    this.child.on("spawn", () => {
      // connecting -> wait for polling confirmation or set online after short grace period
      setTimeout(() => {
        if (this.child && !this.stopping && this.current === "connecting") {
          this.setState("online");
        }
      }, 1000);
    });
    this.child.on("error", () => { if (!this.stopping) this.setState("error", "Agent process error"); });
    this.child.on("exit", (code) => {
      if (stableTimer) { clearTimeout(stableTimer); stableTimer = null; }
      this.child = null;
      if (this.stopping || code === 0) {
        this.setState("stopped");
        return;
      }
      this.setState("error", "Agent stopped unexpectedly");
      this.scheduleRestart();
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    this.restartAttempt = 0;
    const child = this.child;
    if (!child) { this.setState("stopped"); return; }
    if (child.pid && process.platform === "win32") {
      try {
        const cp = await import("node:child_process");
        cp.spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          shell: false,
          windowsHide: true,
          stdio: "ignore",
        });
      } catch {
        // ignore
      }
    }
    child.kill();
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 2000);
      child.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
    this.child = null;
    this.setState("stopped");
  }

  private scheduleRestart(): void {
    if (this.stopping || this.restartTimer || this.restartAttempt >= this.maxRestartAttempts) {
      if (this.restartAttempt >= this.maxRestartAttempts) this.setState("error", "Agent หยุดซ้ำเกินจำนวนที่กำหนด");
      return;
    }
    const delayMs = Math.min(30_000, 1_000 * 2 ** this.restartAttempt);
    this.restartAttempt += 1;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.stopping || this.child) return;
      void this.start().catch((err) => {
        if (err instanceof Error && err.message === "AGENT_NOT_CONFIGURED") {
          this.setState("stopped");
          return;
        }
        this.scheduleRestart();
      });
    }, delayMs);
  }
}
