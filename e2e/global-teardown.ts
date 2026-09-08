import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { PLAYWRIGHT_SERVER_PID_FILE } from "./global-setup";

export default async function globalTeardown(): Promise<void> {
  let pidText: string;
  try {
    pidText = (await readFile(PLAYWRIGHT_SERVER_PID_FILE, "utf8")).trim();
  } catch {
    return;
  }

  try {
    if (!/^\d+$/.test(pidText)) throw new Error("invalid server pid");

    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/PID", pidText, "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } catch {
        // The server may have exited naturally; teardown is idempotent.
        try {
          process.kill(Number(pidText), "SIGKILL");
        } catch {
          // Ignore an already-closed process.
        }
      }
    } else {
      process.kill(Number(pidText), "SIGTERM");
    }
  } finally {
    await rm(PLAYWRIGHT_SERVER_PID_FILE, { force: true });
  }
}
