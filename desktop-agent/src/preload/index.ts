import { contextBridge, ipcRenderer } from "electron";
import type { MorniterAgentApi } from "../shared/preload-api";

const api: MorniterAgentApi = {
  getState: () => ipcRenderer.invoke("agent:get-state"),
  saveSettings: (settings) => ipcRenderer.invoke("agent:save-settings", settings),
  enroll: (serverUrl, pairingCode, agentId, deviceId) => ipcRenderer.invoke("agent:enroll", serverUrl, pairingCode, agentId, deviceId),
  validateProject: (project) => ipcRenderer.invoke("agent:validate-project", project),
  startAgent: () => ipcRenderer.invoke("agent:start"),
  stopAgent: () => ipcRenderer.invoke("agent:stop"),
  restartAgent: () => ipcRenderer.invoke("agent:restart"),
  testConnection: (serverUrl) => ipcRenderer.invoke("agent:test-connection", serverUrl),
  scanTests: () => ipcRenderer.invoke("agent:scan-tests"),
  setStartWithWindows: (enabled) => ipcRenderer.invoke("agent:set-startup", enabled),
  openMorniter: () => ipcRenderer.invoke("agent:open-morniter"),
  readSafeLogs: () => ipcRenderer.invoke("agent:read-safe-logs"),
  subscribeState: (listener) => { const handler = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state); ipcRenderer.on("agent:state", handler); return () => ipcRenderer.removeListener("agent:state", handler); },
};

contextBridge.exposeInMainWorld("morniterAgent", api);
