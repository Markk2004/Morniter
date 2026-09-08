import { spawn, type ChildProcess } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const PLAYWRIGHT_SERVER_PID_FILE = path.join(
  os.tmpdir(),
  "project-monitor-playwright-server.pid",
);

const SERVER_URL = "http://localhost:3100/";

async function waitForServer(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError = "server did not become available";

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Playwright test server exited before startup: ${lastError}`);
    }

    try {
      const response = await fetch(SERVER_URL);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Playwright test server: ${lastError}`);
}

export default async function globalSetup(): Promise<void> {
  const nextCli = path.resolve(process.cwd(), "node_modules/next/dist/bin/next");
  const child = spawn(process.execPath, [nextCli, "start", "-p", "3100"], {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let startupOutput = "";
  const collectOutput = (chunk: Buffer) => {
    startupOutput = `${startupOutput}${chunk.toString("utf8")}`.slice(-4_000);
  };
  child.stdout?.on("data", collectOutput);
  child.stderr?.on("data", collectOutput);

  try {
    await waitForServer(child);
    await writeFile(PLAYWRIGHT_SERVER_PID_FILE, String(child.pid), "utf8");
  } catch (error) {
    child.kill();
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${startupOutput}`);
  }
}

