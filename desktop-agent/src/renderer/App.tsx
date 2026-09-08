import { useEffect, useState } from "react";
import type { PublicAgentState, SetupResult } from "../shared/preload-api";

const steps = ["Welcome", "System Check", "Secure Pairing", "Project Setup", "Verification", "Completed"];
const initial = { serverUrl: "https://monitorsoftdeath.vercel.app", pairingCode: "", agentId: "windows-local-agent-1", deviceId: "", workspaceRoot: "", testRoot: "e2e" };

export function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("พร้อมตั้งค่า Local Agent");
  const [state, setState] = useState<PublicAgentState>({ state: "stopped" });

  useEffect(() => window.morniterAgent.subscribeState(setState), []);
  const update = (key: keyof typeof initial, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const run = async (action: () => Promise<SetupResult>) => { const result = await action(); setMessage(result.message); return result.ok; };

  async function waitForOnline(): Promise<boolean> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = await window.morniterAgent.getState();
      setState(current);
      if (current.state === "online" || current.state === "running") return true;
      if (current.state === "error") { setMessage(current.message || "Agent เริ่มทำงานไม่สำเร็จ"); return false; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    setMessage("Agent ยังไม่ Online ภายในเวลาที่กำหนด");
    return false;
  }

  async function next() {
    if (step === 1) { const ok = await run(() => window.morniterAgent.testConnection(form.serverUrl)); if (!ok) return; }
    if (step === 2) { const deviceId = form.deviceId || crypto.randomUUID(); setForm((current) => ({ ...current, deviceId })); const ok = await run(() => window.morniterAgent.enroll(form.serverUrl, form.pairingCode, form.agentId, deviceId)); if (!ok) return; }
    if (step === 3) { const ok = await run(() => window.morniterAgent.validateProject({ workspaceRoot: form.workspaceRoot, testRoot: form.testRoot })); if (!ok) return; }
    if (step === 4) { const settings = { version: 1 as const, serverUrl: form.serverUrl, agentId: form.agentId, deviceId: form.deviceId, startWithWindows: true, projects: [{ id: "projectsts", name: "ProjectSTS", workspaceRoot: form.workspaceRoot, testRoot: form.testRoot, allowedBrowsers: ["chromium" as const], allowHeaded: true, allowWorkspaceExecution: true, maxTimeoutSeconds: 600, envAllowlist: [], allowedBaseUrls: [] }] }; const saved = await run(() => window.morniterAgent.saveSettings(settings)); if (!saved) return; const startup = await run(() => window.morniterAgent.setStartWithWindows(true)); if (!startup) return; const started = await run(() => window.morniterAgent.startAgent()); if (!started || !(await waitForOnline())) return; }
    setStep((current) => Math.min(5, current + 1));
  }

  return <main className="app"><div className="shell">
    <div className="brand"><div className="brand-mark" role="img" aria-label="Morniter" /><div><div className="eyebrow">Morniter Local Agent</div><div className="muted">Windows setup</div></div></div>
    <div className="stepper">{steps.map((label, index) => <span className={`step ${index === step ? "active" : ""}`} key={label}>{index + 1}. {label}</span>)}</div>
    <div className="grid"><section className="card">
      {step === 0 && <><h1>เชื่อมเครื่องนี้กับ Morniter</h1><p className="muted" style={{ marginTop: 12 }}>ติดตั้งครั้งเดียว แล้วให้ Local Agent รับงาน test จาก Morniter บนเครื่องที่มี source code ของโปรเจกต์</p><div className="tip muted">ต้องเปิด Morniter → Settings → Agents เพื่อสร้าง Pairing Code ก่อน</div></>}
      {step === 1 && <><h2>ตรวจสอบระบบ</h2><p className="muted" style={{ marginTop: 10 }}>ตรวจสอบการเชื่อมต่อกับ server ก่อนจับคู่เครื่อง</p><label className="field">Morniter URL<input value={form.serverUrl} onChange={(e) => update("serverUrl", e.target.value)} /></label></>}
      {step === 2 && <><h2>จับคู่เครื่องอย่างปลอดภัย</h2><p className="muted" style={{ marginTop: 10 }}>Pairing Code ใช้ได้ครั้งเดียวและหมดอายุใน 10 นาที ระบบจะเก็บ credential แบบเข้ารหัสบนเครื่อง</p><label className="field">Agent ID<input value={form.agentId} onChange={(e) => update("agentId", e.target.value)} /></label><label className="field">Pairing Code<input value={form.pairingCode} onChange={(e) => update("pairingCode", e.target.value.toUpperCase())} placeholder="ABC-123" maxLength={7} /></label></>}
      {step === 3 && <><h2>เลือกโปรเจกต์ทดสอบ</h2><p className="muted" style={{ marginTop: 10 }}>เลือกโฟลเดอร์โปรเจกต์ที่มี Playwright tests เช่น ProjectSTS ระบบจะส่งเฉพาะ label และ relative path ไปที่ Morniter</p><label className="field">Workspace path<input value={form.workspaceRoot} onChange={(e) => update("workspaceRoot", e.target.value)} placeholder="C:\Projects\ProjectSTS" /></label><label className="field">Test root<input value={form.testRoot} onChange={(e) => update("testRoot", e.target.value)} /></label></>}
      {step === 4 && <><h2>ตรวจสอบครั้งสุดท้าย</h2><p className="muted" style={{ marginTop: 10 }}>บันทึกการตั้งค่าแบบไม่เก็บ token ในไฟล์ แล้วเริ่ม Agent</p><div className="tip muted">หลังขึ้น Online ให้กลับไปหน้า Tests ใน Morniter แล้วเลือก test เพื่อ Run ได้</div></>}
      {step === 5 && <><div className="status"><span className="dot" />ตั้งค่าเสร็จแล้ว</div><h1>Agent พร้อมใช้งาน</h1><p className="muted" style={{ marginTop: 12 }}>เปิด Morniter เป็น PWA แยกต่างหากได้ และ Agent จะทำงานต่อแม้ปิดหน้าต่างตั้งค่า</p><button className="primary" style={{ marginTop: 20 }} onClick={() => void window.morniterAgent.openMorniter()}>เปิด Morniter</button></>}
      {step < 5 && <div className="actions"><button disabled={step === 0} onClick={() => setStep((current) => current - 1)}>ย้อนกลับ</button><button className="primary" onClick={() => void next()}>{step === 4 ? "เริ่ม Agent" : "ดำเนินการต่อ"}</button></div>}
    </section><aside className="card"><div className="eyebrow">Live status</div><div className="status" style={{ marginTop: 16 }}><span className="dot" />{state.state}</div><p className="muted" style={{ marginTop: 12 }}>{message}</p><div className="tip muted">ใช้เครื่องเดียวต่อ Agent ID หนึ่งค่า หากต้องการย้ายเครื่อง ให้ Revoke เครื่องเก่าที่ Settings → Agents แล้วจับคู่ใหม่</div></aside></div>
  </div></main>;
}
