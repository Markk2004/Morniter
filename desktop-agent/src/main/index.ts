import { app, BrowserWindow, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { writeSettingsAtomic, readSettings } from "./settings-store";
import { enrollDevice } from "./pairing-client";
import { validateLocalProject } from "./project-validator";
import { AgentSupervisor } from "./agent-supervisor";
import { DesktopAgentSettingsSchema } from "../shared/settings";
import { AgentTray } from "./tray";

let windowRef: BrowserWindow | null = null;
let tray: AgentTray | null = null;
let isQuitting = false;
app.setName("Morniter Local Agent");
app.setAppUserModelId("com.softdeath.morniter.agent");
const supervisor = new AgentSupervisor();
const safeLogs: string[] = [];

function result(ok: boolean, message: string, code?: string) { return { ok, message, ...(code ? { code } : {}) }; }
function broadcast(state: ReturnType<AgentSupervisor["state"]>) { windowRef?.webContents.send("agent:state", state); }

function rendererFileUrl(): string { return pathToFileURL(path.join(__dirname, "../renderer/index.html")).toString(); }

function isTrustedRendererUrl(url: string): boolean {
  if (url === rendererFileUrl()) return true;
  const configuredDevUrl = process.env.ELECTRON_RENDERER_URL;
  if (!configuredDevUrl) return false;
  try { return new URL(url).origin === new URL(configuredDevUrl).origin; } catch { return false; }
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedRendererUrl(event.senderFrame?.url || "")) throw new Error("UNTRUSTED_RENDERER");
}

function showWindow(): void {
  if (!windowRef) createWindow();
  windowRef?.show();
  windowRef?.focus();
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 980, height: 720, minWidth: 360, minHeight: 560,
    backgroundColor: "#070b12", show: false,
    webPreferences: { preload: path.join(__dirname, "../preload/index.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  windowRef.once("ready-to-show", () => windowRef?.show());
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void windowRef.loadURL(devUrl);
  else void windowRef.loadFile(path.join(__dirname, "../renderer/index.html"));
  windowRef.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  windowRef.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  windowRef.webContents.setWindowOpenHandler(({ url }) => {
    void openAllowedUrl(url);
    return { action: "deny" };
  });
  windowRef.on("close", (event) => {
    if (!isQuitting) { event.preventDefault(); windowRef?.hide(); }
  });
  windowRef.on("closed", () => { windowRef = null; });
}

async function openAllowedUrl(url: string) {
  try {
    const settings = await readSettings();
    if (!settings || new URL(url).origin !== new URL(settings.serverUrl).origin) return result(false, "URL ไม่ได้รับอนุญาต", "URL_NOT_ALLOWED");
    await shell.openExternal(url);
    return result(true, "เปิด Morniter แล้ว");
  } catch { return result(false, "URL ไม่ถูกต้อง", "URL_NOT_ALLOWED"); }
}

function registerIpc() {
  ipcMain.handle("agent:get-state", (event) => { assertTrustedSender(event); return supervisor.state(); });
  ipcMain.handle("agent:save-settings", async (event, raw: unknown) => {
    assertTrustedSender(event);
    try { const settings = DesktopAgentSettingsSchema.parse(raw); await writeSettingsAtomic(settings); return result(true, "บันทึกการตั้งค่าแล้ว"); }
    catch { return result(false, "การตั้งค่าไม่ถูกต้อง", "SETTINGS_INVALID"); }
  });
  ipcMain.handle("agent:enroll", async (event, serverUrl: string, pairingCode: string, agentId: string, deviceId: string) => {
    assertTrustedSender(event);
    try { const device = await enrollDevice({ serverUrl, pairingCode, agentId, deviceId: deviceId || randomUUID() }); return { ok: true, message: "จับคู่เครื่องสำเร็จ", device }; }
    catch (error) { const code = error instanceof Error ? error.message : "ENROLLMENT_FAILED"; return result(false, "จับคู่เครื่องไม่สำเร็จ", code); }
  });
  ipcMain.handle("agent:validate-project", async (event, project: { workspaceRoot: string; testRoot: string }) => {
    assertTrustedSender(event);
    try { const checked = await validateLocalProject(project); return checked.ok ? { ok: true, message: checked.hasPlaywright ? "พบ Playwright พร้อมใช้งาน" : "พบโฟลเดอร์ test แต่ยังไม่พบ Playwright" } : result(false, "โปรเจกต์ยังไม่พร้อม", checked.code); }
    catch { return result(false, "ตรวจสอบโปรเจกต์ไม่สำเร็จ", "PROJECT_CHECK_FAILED"); }
  });
  ipcMain.handle("agent:start", async (event) => { assertTrustedSender(event); try { await supervisor.start(); return result(true, "Agent เริ่มทำงานแล้ว"); } catch { return result(false, "เริ่ม Agent ไม่สำเร็จ", "AGENT_START_FAILED"); } });
  ipcMain.handle("agent:stop", async (event) => { assertTrustedSender(event); await supervisor.stop(); return result(true, "หยุด Agent แล้ว"); });
  ipcMain.handle("agent:restart", async (event) => { assertTrustedSender(event); await supervisor.stop(); try { await supervisor.start(); return result(true, "เริ่ม Agent ใหม่แล้ว"); } catch { return result(false, "เริ่ม Agent ใหม่ไม่สำเร็จ", "AGENT_RESTART_FAILED"); } });
  ipcMain.handle("agent:test-connection", async (event, serverUrl?: string) => { assertTrustedSender(event); const target = serverUrl || (await readSettings())?.serverUrl; if (!target) return result(false, "ยังไม่ได้ตั้งค่า Agent", "AGENT_NOT_CONFIGURED"); try { const parsed = new URL(target); if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) return result(false, "ต้องใช้ HTTPS หรือ localhost", "SERVER_URL_MUST_USE_HTTPS"); const response = await fetch(new URL("/api/test-runner/lock", parsed), { cache: "no-store" }); return response.ok ? result(true, "เชื่อมต่อ Morniter ได้") : result(false, "เซิร์ฟเวอร์ตอบกลับไม่สำเร็จ", "SERVER_UNAVAILABLE"); } catch { return result(false, "เชื่อมต่อ Morniter ไม่ได้", "SERVER_UNAVAILABLE"); } });
  ipcMain.handle("agent:scan-tests", async (event) => { assertTrustedSender(event); const settings = await readSettings(); if (!settings) return result(false, "ยังไม่ได้ตั้งค่า Agent", "AGENT_NOT_CONFIGURED"); const results = await Promise.all(settings.projects.map((project) => validateLocalProject(project))); return results.every((item) => item.ok) ? result(true, "ตรวจสอบ test root แล้ว") : result(false, "มีโปรเจกต์ที่ยังไม่พร้อม", "PROJECT_CHECK_FAILED"); });
  ipcMain.handle("agent:set-startup", async (event, enabled: boolean) => { assertTrustedSender(event); app.setLoginItemSettings({ openAtLogin: Boolean(enabled) }); return result(true, enabled ? "เปิดเริ่มพร้อม Windows แล้ว" : "ปิดเริ่มพร้อม Windows แล้ว"); });
  ipcMain.handle("agent:open-morniter", async (event) => { assertTrustedSender(event); const settings = await readSettings(); return settings ? openAllowedUrl(settings.serverUrl) : result(false, "ยังไม่ได้ตั้งค่า Agent", "AGENT_NOT_CONFIGURED"); });
  ipcMain.handle("agent:read-safe-logs", (event) => { assertTrustedSender(event); return { lines: safeLogs.slice(-200) }; });
}

app.whenReady().then(() => {
  supervisor.subscribe((state) => { safeLogs.push(`[Agent] ${state.state}${state.message ? `: ${state.message}` : ""}`); broadcast(state); tray?.update(state); });
  registerIpc();
  createWindow();
  tray = new AgentTray({
    showWindow,
    openMorniter: async () => { const settings = await readSettings(); if (settings) await openAllowedUrl(settings.serverUrl); },
    start: async () => { try { await supervisor.start(); } catch { /* state is broadcast to the window */ } },
    stop: () => supervisor.stop(),
    restart: async () => { await supervisor.stop(); try { await supervisor.start(); } catch { /* state is broadcast to the window */ } },
    testConnection: async () => { const settings = await readSettings(); if (settings) await fetch(new URL("/api/test-runner/lock", settings.serverUrl), { cache: "no-store" }).catch(() => undefined); },
    scanTests: async () => { const settings = await readSettings(); if (settings) await Promise.all(settings.projects.map((project) => validateLocalProject(project))); },
    setStartWithWindows: async (enabled) => { app.setLoginItemSettings({ openAtLogin: enabled }); },
    quit: () => app.quit(),
  });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { /* Keep the Agent alive in the tray. */ });
app.on("before-quit", (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;
  void supervisor.stop().finally(() => { tray?.destroy(); app.quit(); });
});
