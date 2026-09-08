import path from "node:path";
import { app, Menu, nativeImage, Tray } from "electron";
import type { AgentState, PublicAgentState } from "../shared/preload-api";

export interface TrayActions {
  showWindow(): void;
  openMorniter(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  testConnection(): Promise<void>;
  scanTests(): Promise<void>;
  setStartWithWindows(enabled: boolean): Promise<void>;
  quit(): void;
}

function iconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "morniter-agent-tray.png")
    : path.resolve(process.cwd(), "build", "morniter-agent-tray.png");
}

function stateLabel(state: AgentState): string {
  return { stopped: "หยุดอยู่", connecting: "กำลังเชื่อมต่อ", online: "ออนไลน์", running: "กำลังทำงาน", error: "มีข้อผิดพลาด" }[state];
}

export class AgentTray {
  private readonly tray: Tray;
  private state: PublicAgentState = { state: "stopped" };

  constructor(private readonly actions: TrayActions) {
    this.tray = new Tray(nativeImage.createFromPath(iconPath()));
    this.tray.setToolTip("Morniter Local Agent");
    this.tray.on("double-click", () => this.actions.showWindow());
    this.refreshMenu();
  }

  update(state: PublicAgentState): void {
    this.state = state;
    this.refreshMenu();
  }

  destroy(): void { this.tray.destroy(); }

  private refreshMenu(): void {
    const isActive = this.state.state === "online" || this.state.state === "running" || this.state.state === "connecting";
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: `Morniter Local Agent: ${stateLabel(this.state.state)}`, enabled: false },
      { type: "separator" },
      { label: "เปิดหน้าตั้งค่า", click: () => this.actions.showWindow() },
      { label: "เปิด Morniter", click: () => void this.actions.openMorniter() },
      { type: "separator" },
      { label: "เริ่ม Agent", enabled: !isActive, click: () => void this.actions.start() },
      { label: "หยุด Agent", enabled: isActive, click: () => void this.actions.stop() },
      { label: "เริ่มใหม่", enabled: isActive, click: () => void this.actions.restart() },
      { label: "ทดสอบการเชื่อมต่อ", click: () => void this.actions.testConnection() },
      { label: "สแกน test", click: () => void this.actions.scanTests() },
      { type: "separator" },
      { label: "เริ่มพร้อม Windows", type: "checkbox", checked: true, click: (item) => void this.actions.setStartWithWindows(item.checked) },
      { label: "ออกจาก Agent", click: () => this.actions.quit() },
    ]));
  }
}
