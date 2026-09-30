import { spawn } from "child_process";

/**
 * Returns candidate window titles to match for an already-open Morniter browser window or tab.
 */
export function getCandidateWindowTitles(serverUrl?: string): string[] {
  const titles = new Set<string>(["Project Monitor", "Morniter"]);

  if (serverUrl) {
    try {
      const parsed = new URL(serverUrl);
      if (parsed.hostname && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
        titles.add(parsed.hostname);
        const sub = parsed.hostname.split(".")[0];
        if (sub && sub.length > 2) {
          titles.add(sub);
        }
      } else if (parsed.host) {
        titles.add(parsed.host);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return Array.from(titles);
}

/**
 * Executes a Windows PowerShell script to find and bring an existing window
 * matching any candidate title to the foreground.
 */
export function activateWin32Window(titles: string[]): Promise<boolean> {
  if (titles.length === 0) return Promise.resolve(false);

  return new Promise((resolve) => {
    const escapedTitles = titles
      .map((t) => `'${t.replace(/'/g, "''")}'`)
      .join(", ");

    const script = `
$titles = @(${escapedTitles});
$wshell = New-Object -ComObject WScript.Shell;
$found = $false;
foreach ($t in $titles) {
  try {
    if ($wshell.AppActivate($t)) {
      $found = $true;
      break;
    }
  } catch {}
}
if ($found) { exit 0 } else { exit 1 }
`;

    try {
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        {
          windowsHide: true,
          timeout: 3000,
          stdio: "ignore",
        },
      );

      child.on("close", (code) => {
        resolve(code === 0);
      });

      child.on("error", () => {
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Tries to focus an already open Morniter browser tab or window.
 * Returns true if an existing window was activated, false otherwise.
 */
export async function focusExistingMorniterWindow(
  serverUrl?: string,
  executor?: (titles: string[]) => Promise<boolean>,
): Promise<boolean> {
  const titles = getCandidateWindowTitles(serverUrl);

  if (executor) {
    return executor(titles);
  }

  if (process.platform === "win32") {
    return activateWin32Window(titles);
  }

  return false;
}
