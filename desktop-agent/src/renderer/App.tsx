import { useEffect, useState } from "react";
import type { PublicAgentState, SetupResult, RecentPathEntry } from "../shared/preload-api";
import type { DesktopAgentSettings } from "../shared/settings";

const steps = ["Welcome", "System Check", "Secure Pairing", "Project Setup", "Verification", "Completed"];
const FORM_STORAGE_KEY = "morniter_agent_form_cache";

const initial = {
  serverUrl: "https://monitorsoftdeath.vercel.app",
  pairingCode: "",
  agentId: "windows-local-agent-1",
  deviceId: "",
  workspaceRoot: "",
  testRoot: "e2e",
};

function getInitialForm() {
  try {
    const cached = localStorage.getItem(FORM_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...initial, ...parsed };
    }
  } catch {
    // ignore
  }
  return initial;
}

export function App() {
  const [viewMode, setViewMode] = useState<"dashboard" | "wizard" | "loading">("loading");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(getInitialForm);
  const [message, setMessage] = useState("พร้อมตั้งค่า Local Agent");
  const [state, setState] = useState<PublicAgentState>({ state: "stopped" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [recentPaths, setRecentPaths] = useState<RecentPathEntry[]>([]);

  useEffect(() => {
    const unsub = window.morniterAgent.subscribeState(setState);

    // Load recent paths and auto-fill if empty
    window.morniterAgent
      ?.getRecentPaths?.()
      .then((paths) => {
        if (Array.isArray(paths) && paths.length > 0) {
          setRecentPaths(paths);
          setForm((current) => {
            if (!current.workspaceRoot.trim()) {
              const next = {
                ...current,
                workspaceRoot: paths[0].workspaceRoot,
                testRoot: paths[0].testRoot || current.testRoot,
              };
              try {
                localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(next));
              } catch {
                // ignore
              }
              return next;
            }
            return current;
          });
        }
      })
      .catch(() => {
        // ignore
      });

    // Check if machine is already paired
    window.morniterAgent
      .isPaired()
      .then(async (paired) => {
        if (paired) {
          const saved = await window.morniterAgent.getSettings();
          if (saved) {
            const proj = saved.projects?.[0];
            setForm((current) => {
              const next = {
                ...current,
                serverUrl: saved.serverUrl || current.serverUrl,
                agentId: saved.agentId || current.agentId,
                deviceId: saved.deviceId || current.deviceId,
                workspaceRoot: proj?.workspaceRoot || current.workspaceRoot,
                testRoot: proj?.testRoot || current.testRoot,
              };
              try {
                localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(next));
              } catch {
                // ignore
              }
              return next;
            });
          }
          setViewMode("dashboard");

          // Auto start agent if currently stopped
          const curState = await window.morniterAgent.getState();
          setState(curState);
          if (curState.state === "stopped") {
            void window.morniterAgent.startAgent();
          }
        } else {
          setViewMode("wizard");
        }
      })
      .catch(() => {
        setViewMode("wizard");
      });

    return unsub;
  }, []);

  const update = (key: keyof typeof initial, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      try {
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const run = async (action: () => Promise<SetupResult>) => {
    const result = await action();
    setMessage(result.message);
    return result.ok;
  };

  async function handleSaveProject() {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const res = await window.morniterAgent.updateProject({
        workspaceRoot: form.workspaceRoot,
        testRoot: form.testRoot || "e2e",
      });
      if (res.ok) {
        setSaveFeedback(res.message || "บันทึกและซิงค์โปรเจกต์สำเร็จ");
        setMessage(res.message);
        if (form.workspaceRoot.trim()) {
          void window.morniterAgent
            ?.addRecentPath?.({
              workspaceRoot: form.workspaceRoot,
              testRoot: form.testRoot || "e2e",
            })
            .then((updated) => {
              if (Array.isArray(updated)) setRecentPaths(updated);
            });
        }
      } else {
        setSaveFeedback(`ข้อผิดพลาด: ${res.message}`);
        setMessage(res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
      setSaveFeedback(`ข้อผิดพลาด: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  }

  const handleSelectRecentPath = (item: RecentPathEntry) => {
    setForm((current) => {
      const next = {
        ...current,
        workspaceRoot: item.workspaceRoot,
        testRoot: item.testRoot || "e2e",
      };
      try {
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    void window.morniterAgent
      ?.addRecentPath?.(item)
      .then((updated) => {
        if (Array.isArray(updated)) setRecentPaths(updated);
      })
      .catch(() => {
        // ignore
      });
  };

  const handleRemoveRecentPath = async (e: React.MouseEvent, workspaceRoot: string) => {
    e.stopPropagation();
    try {
      const updated = await window.morniterAgent?.removeRecentPath?.(workspaceRoot);
      if (Array.isArray(updated)) setRecentPaths(updated);
    } catch {
      // ignore
    }
  };

  const renderRecentPaths = () => {
    if (!recentPaths || recentPaths.length === 0) return null;
    return (
      <div className="recent-paths-container">
        <div className="recent-paths-header">
          <span>🕒 ประวัติโฟลเดอร์ล่าสุด (Recent Paths)</span>
          <span className="recent-paths-count">{recentPaths.length} รายการ</span>
        </div>
        <div className="recent-paths-list">
          {recentPaths.map((item) => {
            const isSelected =
              form.workspaceRoot.trim().toLowerCase() === item.workspaceRoot.trim().toLowerCase();
            return (
              <div
                key={item.workspaceRoot}
                className={`recent-path-chip ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectRecentPath(item)}
                title={`คลิกเพื่อเลือก: ${item.workspaceRoot}\n(Test Root: ${item.testRoot})`}
              >
                <span className="recent-path-icon">📁</span>
                <span className="recent-path-text">{item.workspaceRoot}</span>
                {item.testRoot && (
                  <span className="recent-path-test-root">{item.testRoot}</span>
                )}
                <button
                  type="button"
                  className="recent-path-remove"
                  title="ลบจากประวัติ"
                  onClick={(e) => void handleRemoveRecentPath(e, item.workspaceRoot)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  async function handleUnpair() {
    if (!window.confirm("คุณต้องการยกเลิกการจับคู่เครื่องนี้กับ Morniter ใช่หรือไม่?\n(จะต้องสร้าง Pairing Code ใหม่จากหน้าเว็บเพื่อเชื่อมต่ออีกครั้ง)")) {
      return;
    }
    await window.morniterAgent.unpair();
    setForm((current) => {
      const next = { ...current, pairingCode: "", deviceId: crypto.randomUUID() };
      try {
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setViewMode("wizard");
    setStep(0);
    setMessage("ยกเลิกการจับคู่แล้ว พร้อมตั้งค่าใหม่");
  }

  async function waitForOnline(): Promise<boolean> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = await window.morniterAgent.getState();
      setState(current);
      if (current.state === "online" || current.state === "running") return true;
      if (current.state === "error") {
        setMessage(current.message || "Agent เริ่มทำงานไม่สำเร็จ");
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    setMessage("Agent ยังไม่ Online ภายในเวลาที่กำหนด");
    return false;
  }

  async function next() {
    if (step === 1) {
      const ok = await run(() => window.morniterAgent.testConnection(form.serverUrl));
      if (!ok) return;
    }
    if (step === 2) {
      const deviceId = form.deviceId || crypto.randomUUID();
      update("deviceId", deviceId);
      const ok = await run(() =>
        window.morniterAgent.enroll(form.serverUrl, form.pairingCode, form.agentId, deviceId),
      );
      if (!ok) return;
    }
    if (step === 3) {
      const ok = await run(() =>
        window.morniterAgent.validateProject({
          workspaceRoot: form.workspaceRoot,
          testRoot: form.testRoot,
        }),
      );
      if (!ok) return;

      if (form.workspaceRoot.trim()) {
        void window.morniterAgent
          ?.addRecentPath?.({
            workspaceRoot: form.workspaceRoot,
            testRoot: form.testRoot || "e2e",
          })
          .then((updated) => {
            if (Array.isArray(updated)) setRecentPaths(updated);
          });
      }

      try {
        const existing = await window.morniterAgent.getSettings();
        const existingProj = existing?.projects?.[0];
        const partialSettings: DesktopAgentSettings = {
          version: 1,
          serverUrl: form.serverUrl || existing?.serverUrl || "https://monitorsoftdeath.vercel.app",
          agentId: form.agentId || existing?.agentId || "windows-local-agent-1",
          deviceId: form.deviceId || existing?.deviceId || crypto.randomUUID(),
          startWithWindows: existing?.startWithWindows ?? true,
          projects: [
            {
              id: existingProj?.id || "projectsts",
              name: existingProj?.name || "ProjectSTS",
              workspaceRoot: form.workspaceRoot,
              testRoot: form.testRoot || "e2e",
              config: existingProj?.config || "playwright.sts.config.ts",
              automationMap: existingProj?.automationMap,
              allowedBrowsers: existingProj?.allowedBrowsers || [
                "chromium",
                "firefox",
                "webkit",
                "msedge",
              ],
              allowHeaded: existingProj?.allowHeaded ?? true,
              allowWorkspaceExecution: existingProj?.allowWorkspaceExecution ?? true,
              maxTimeoutSeconds: existingProj?.maxTimeoutSeconds ?? 600,
              envAllowlist: existingProj?.envAllowlist || [],
              allowedBaseUrls: existingProj?.allowedBaseUrls || [
                "http://localhost:3001",
                "https://monitorsoftdeath.vercel.app",
              ],
            },
          ],
        };
        await window.morniterAgent.saveSettings(partialSettings);
      } catch {
        // ignore
      }
    }
    if (step === 4) {
      const existing = await window.morniterAgent.getSettings();
      const existingProj = existing?.projects?.[0];
      const settings: DesktopAgentSettings = {
        version: 1,
        serverUrl: form.serverUrl,
        agentId: form.agentId,
        deviceId: form.deviceId || crypto.randomUUID(),
        startWithWindows: true,
        projects: [
          {
            id: existingProj?.id || "projectsts",
            name: existingProj?.name || "ProjectSTS",
            workspaceRoot: form.workspaceRoot,
            testRoot: form.testRoot || "e2e",
            config: existingProj?.config || "playwright.sts.config.ts",
            automationMap: existingProj?.automationMap,
            allowedBrowsers: existingProj?.allowedBrowsers || [
              "chromium",
              "firefox",
              "webkit",
              "msedge",
            ],
            allowHeaded: true,
            allowWorkspaceExecution: true,
            maxTimeoutSeconds: 600,
            envAllowlist: existingProj?.envAllowlist || [],
            allowedBaseUrls: existingProj?.allowedBaseUrls || [
              "http://localhost:3001",
              "https://monitorsoftdeath.vercel.app",
            ],
          },
        ],
      };
      const saved = await run(() => window.morniterAgent.saveSettings(settings));
      if (!saved) return;
      const startup = await run(() => window.morniterAgent.setStartWithWindows(true));
      if (!startup) return;
      const started = await run(() => window.morniterAgent.startAgent());
      if (!started || !(await waitForOnline())) return;

      // Automatically focus existing Morniter window on connection success
      void window.morniterAgent.openMorniter();
    }
    setStep((current) => Math.min(5, current + 1));
  }

  if (viewMode === "loading") {
    return (
      <main className="app">
        <div className="shell">
          <div className="card" style={{ textAlign: "center", padding: "40px" }}>
            <p className="muted">กำลังตรวจสอบการเชื่อมต่อเครื่องกับ Morniter...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="shell">
        <div className="brand">
          <div className="brand-mark" role="img" aria-label="Morniter" />
          <div>
            <div className="eyebrow">Morniter Local Agent</div>
            <div className="muted">
              {viewMode === "dashboard" ? "Connected Windows Runner" : "Windows setup"}
            </div>
          </div>
        </div>

        {viewMode === "dashboard" ? (
          /* ============================================================== */
          /* DASHBOARD VIEW (สำหรับเครื่องที่จับคู่แล้ว - ไม่ต้อง Pair ซ้ำ)   */
          /* ============================================================== */
          <div className="grid">
            <section className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h1>สถานะ Local Agent ประจำเครื่อง</h1>
                  <p className="muted" style={{ marginTop: 6, fontSize: "14px" }}>
                    เครื่องนี้จับคู่แล้ว พร้อมรับคำสั่งรัน Playwright จาก Morniter
                  </p>
                </div>
                <div className={`badge badge-${state.state}`}>
                  <span className={`dot ${state.state === "online" || state.state === "running" ? "pulse" : ""}`} />
                  {state.state.toUpperCase()}
                </div>
              </div>

              <div style={{ marginTop: 24, borderTop: "1px solid #223042", paddingTop: 20 }}>
                <h2>โฟลเดอร์โปรเจกต์ทดสอบ (Project Workspace)</h2>
                <p className="muted" style={{ marginTop: 6, fontSize: "13px" }}>
                  ระบุหรือเลือกโฟลเดอร์โปรเจกต์ที่มี Playwright tests เช่น ProjectSTS ระบบจะจดจำค่าไว้และซิงค์แคตตาล็อกเทสขึ้นเว็บทันที
                </p>

                <label className="field">
                  Workspace path
                  <div className="field-row">
                    <input
                      value={form.workspaceRoot}
                      onChange={(e) => update("workspaceRoot", e.target.value)}
                      placeholder="C:\Projects\ProjectSTS"
                    />
                    <button
                      type="button"
                      className="browse-btn"
                      onClick={async () => {
                        const selected = await window.morniterAgent.selectDirectory(form.workspaceRoot);
                        if (selected) update("workspaceRoot", selected);
                      }}
                    >
                      📁 เลือกโฟลเดอร์...
                    </button>
                  </div>
                </label>

                {renderRecentPaths()}

                <label className="field" style={{ marginTop: 12 }}>
                  Test root
                  <input
                    value={form.testRoot}
                    onChange={(e) => update("testRoot", e.target.value)}
                    placeholder="e2e"
                  />
                </label>

                <div style={{ display: "flex", gap: "10px", marginTop: "18px", alignItems: "center" }}>
                  <button
                    className="primary"
                    disabled={isSaving || !form.workspaceRoot.trim()}
                    onClick={() => void handleSaveProject()}
                  >
                    {isSaving ? "กำลังบันทึกและรีสตาร์ต..." : "💾 บันทึกและซิงค์โปรเจกต์"}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await window.morniterAgent.scanTests();
                      setMessage(res.message);
                    }}
                  >
                    🔄 สแกน Tests
                  </button>
                </div>

                {saveFeedback && (
                  <div className="success-msg">
                    {saveFeedback}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 28, borderTop: "1px solid #223042", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => void window.morniterAgent.openMorniter()}
                  title="สลับไปยังหน้าต่าง Morniter เดิมที่เปิดอยู่ หรือเปิดเบราว์เซอร์ใหม่หากยังไม่ได้เปิด"
                  style={{ background: "#1c2b3d", borderColor: "#38bdf8", color: "#38bdf8", fontWeight: 600 }}
                >
                  🚀 สลับไป Morniter เดิม
                </button>

                <button
                  type="button"
                  className="danger"
                  onClick={() => void handleUnpair()}
                >
                  ⚠️ จับคู่ใหม่ / เปลี่ยนเซิร์ฟเวอร์
                </button>
              </div>
            </section>

            <aside className="card">
              <div className="eyebrow">Connection Details</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: "8px" }}>
                <span className="meta-tag">Agent ID: {form.agentId || "windows-local-agent-1"}</span>
                <span className="meta-tag">Server: {form.serverUrl}</span>
              </div>

              <div className="eyebrow" style={{ marginTop: 24 }}>Agent Controls</div>
              <div style={{ marginTop: 12, display: "flex", gap: "8px" }}>
                {state.state === "stopped" ? (
                  <button
                    className="primary"
                    style={{ flex: 1 }}
                    onClick={async () => {
                      const res = await window.morniterAgent.startAgent();
                      setMessage(res.message);
                    }}
                  >
                    ▶️ เริ่ม Agent
                  </button>
                ) : (
                  <button
                    style={{ flex: 1, borderColor: "#ef444466", color: "#f87171" }}
                    onClick={async () => {
                      const res = await window.morniterAgent.stopAgent();
                      setMessage(res.message);
                    }}
                  >
                    ⏹️ หยุด Agent
                  </button>
                )}
                <button
                  onClick={async () => {
                    const res = await window.morniterAgent.restartAgent();
                    setMessage(res.message);
                  }}
                >
                  🔄 เริ่มใหม่
                </button>
              </div>

              <div className="eyebrow" style={{ marginTop: 24 }}>System Message</div>
              <p className="muted" style={{ marginTop: 8, fontSize: "13px" }}>
                {message}
              </p>

              <div className="tip muted" style={{ fontSize: "12px" }}>
                รองรับบราวเซอร์ Chrome, Firefox, Microsoft Edge และ WebKit แบบ Headed บนเครื่องนี้
              </div>
            </aside>
          </div>
        ) : (
          /* ============================================================== */
          /* WIZARD VIEW (สำหรับเครื่องใหม่ หรือเมื่อกด Re-pair)               */
          /* ============================================================== */
          <>
            <div className="stepper">
              {steps.map((label, index) => (
                <span className={`step ${index === step ? "active" : ""}`} key={label}>
                  {index + 1}. {label}
                </span>
              ))}
            </div>
            <div className="grid">
              <section className="card">
                {step === 0 && (
                  <>
                    <h1>เชื่อมเครื่องนี้กับ Morniter</h1>
                    <p className="muted" style={{ marginTop: 12 }}>
                      ติดตั้งครั้งเดียว แล้วให้ Local Agent รับงาน test จาก Morniter
                      บนเครื่องที่มี source code ของโปรเจกต์
                    </p>
                    <div className="tip muted">
                      ต้องเปิด Morniter → Settings → Agents เพื่อสร้าง Pairing Code ก่อน
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <h2>ตรวจสอบระบบ</h2>
                    <p className="muted" style={{ marginTop: 10 }}>
                      ตรวจสอบการเชื่อมต่อกับ server ก่อนจับคู่เครื่อง
                    </p>
                    <label className="field">
                      Morniter URL
                      <input
                        value={form.serverUrl}
                        onChange={(e) => update("serverUrl", e.target.value)}
                      />
                    </label>
                  </>
                )}
                {step === 2 && (
                  <>
                    <h2>จับคู่เครื่องอย่างปลอดภัย</h2>
                    <p className="muted" style={{ marginTop: 10 }}>
                      Pairing Code ใช้ได้ครั้งเดียวและหมดอายุใน 10 นาที
                      ระบบจะเก็บ credential แบบเข้ารหัสบนเครื่อง
                    </p>
                    <label className="field">
                      Agent ID
                      <input
                        value={form.agentId}
                        onChange={(e) => update("agentId", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Pairing Code
                      <input
                        value={form.pairingCode}
                        onChange={(e) => update("pairingCode", e.target.value.toUpperCase())}
                        placeholder="ABC-123"
                        maxLength={7}
                      />
                    </label>
                  </>
                )}
                {step === 3 && (
                  <>
                    <h2>เลือกโปรเจกต์ทดสอบ</h2>
                    <p className="muted" style={{ marginTop: 10 }}>
                      เลือกโฟลเดอร์โปรเจกต์ที่มี Playwright tests เช่น ProjectSTS
                      ระบบจะส่งเฉพาะ label และ relative path ไปที่ Morniter
                    </p>
                    <label className="field">
                      Workspace path
                      <div className="field-row">
                        <input
                          value={form.workspaceRoot}
                          onChange={(e) => update("workspaceRoot", e.target.value)}
                          placeholder="C:\Projects\ProjectSTS"
                        />
                        <button
                          type="button"
                          className="browse-btn"
                          onClick={async () => {
                            const selected = await window.morniterAgent.selectDirectory(
                              form.workspaceRoot,
                            );
                            if (selected) update("workspaceRoot", selected);
                          }}
                        >
                          📁 เลือกโฟลเดอร์...
                        </button>
                      </div>
                    </label>

                    {renderRecentPaths()}
                    <label className="field">
                      Test root
                      <input
                        value={form.testRoot}
                        onChange={(e) => update("testRoot", e.target.value)}
                        placeholder="e2e"
                      />
                    </label>
                  </>
                )}
                {step === 4 && (
                  <>
                    <h2>ตรวจสอบครั้งสุดท้าย</h2>
                    <p className="muted" style={{ marginTop: 10 }}>
                      บันทึกการตั้งค่าแบบไม่เก็บ token ในไฟล์ แล้วเริ่ม Agent
                    </p>
                    <div className="tip muted">
                      หลังขึ้น Online ให้กลับไปหน้า Tests ใน Morniter แล้วเลือก test เพื่อ Run ได้
                    </div>
                  </>
                )}
                {step === 5 && (
                  <>
                    <div className="status">
                      <span className="dot" />
                      ตั้งค่าเสร็จแล้ว
                    </div>
                    <h1>Agent พร้อมใช้งาน</h1>
                    <p className="muted" style={{ marginTop: 12 }}>
                      เปิด Morniter เป็น PWA แยกต่างหากได้ และ Agent
                      จะทำงานต่อแม้ปิดหน้าต่างตั้งค่า
                    </p>
                    <div style={{ display: "flex", gap: "10px", marginTop: 20 }}>
                      <button
                        className="primary"
                        onClick={() => setViewMode("dashboard")}
                      >
                        เข้าสู่ Dashboard
                      </button>
                      <button
                        onClick={() => void window.morniterAgent.openMorniter()}
                        title="สลับไปยังแท็บหรือหน้าต่าง Morniter เดิมที่เปิดอยู่"
                      >
                        สลับไป Morniter เดิม
                      </button>
                    </div>
                  </>
                )}
                {step < 5 && (
                  <div className="actions">
                    <button disabled={step === 0} onClick={() => setStep((current) => current - 1)}>
                      ย้อนกลับ
                    </button>
                    <button className="primary" onClick={() => void next()}>
                      {step === 4 ? "เริ่ม Agent" : "ดำเนินการต่อ"}
                    </button>
                  </div>
                )}
              </section>
              <aside className="card">
                <div className="eyebrow">Live status</div>
                <div className="status" style={{ marginTop: 16 }}>
                  <span className="dot" />
                  {state.state}
                </div>
                <p className="muted" style={{ marginTop: 12 }}>
                  {message}
                </p>
                <div className="tip muted">
                  ใช้เครื่องเดียวต่อ Agent ID หนึ่งค่า หากต้องการย้ายเครื่อง ให้ Revoke
                  เครื่องเก่าที่ Settings → Agents แล้วจับคู่ใหม่
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
