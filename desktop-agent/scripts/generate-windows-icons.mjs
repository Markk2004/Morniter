import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const source = path.resolve("..", "public", "icons", "icon-512.png");
const outputDir = path.resolve("build");
await fs.mkdir(outputDir, { recursive: true });

const sourceLiteral = source.replaceAll("'", "''");
const outputLiteral = path.join(outputDir, "morniter-agent.ico").replaceAll("'", "''");
const powershell = [
  "Add-Type -AssemblyName System.Drawing",
  `$image = [System.Drawing.Image]::FromFile('${sourceLiteral}')`,
  "$bitmap = New-Object System.Drawing.Bitmap 256, 256",
  "$graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
  "$graphics.DrawImage($image, 0, 0, 256, 256)",
  "$handle = $bitmap.GetHicon()",
  "$icon = [System.Drawing.Icon]::FromHandle($handle)",
  `$stream = [System.IO.File]::Create('${outputLiteral}')`,
  "$icon.Save($stream)",
  "$stream.Dispose(); $icon.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $image.Dispose()",
].join("; ");
try {
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powershell], { stdio: "inherit" });
} catch {
  throw new Error("Unable to generate a Windows ICO. Run this packaging step on Windows with System.Drawing available.");
}
await fs.copyFile(source, path.join(outputDir, "morniter-agent-tray.png"));
