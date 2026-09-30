"use client";

import React from "react";
import { getAllFunctionTemplates } from "@/lib/playwright-runner/function-templates";

interface CodeWorkspaceProps {
  code: string;
  onChange: (code: string) => void;
  dirty?: boolean;
  onReset?: () => void;
  onCreateDraft?: () => void;
  disabled?: boolean;
  activeTitle?: string;
  isLoading?: boolean;
}

const STS_TEMPLATES = getAllFunctionTemplates().map((tpl) => ({
  name: `${tpl.id} · ${tpl.shortName}`,
  fullName: tpl.name,
  code: tpl.code,
}));

const GENERIC_TEMPLATES = [
  {
    name: "Basic Navigation",
    code: `// ==============================================================
// 🧭 ทดสอบการเข้าถึงหน้าเว็บและการตรวจสอบ URL (Basic Navigation)
// วัตถุประสงค์: ตรวจสอบว่าระบบเปิดหน้าเว็บได้ถูกต้อง และ URL ไม่เกิดข้อผิดพลาด
// ==============================================================
import { test, expect } from "@playwright/test";

// กำหนด Scenario สำหรับการทดสอบ (ฟังก์ชันรับ context { page } ของเบราว์เซอร์)
test("Page title and navigation", async ({ page }) => {
  // 1. นำทาง Browser ไปยังหน้าแรกของเว็บไซต์ (Home Page: /)
  await page.goto("/");

  // 2. ตรวจสอบเงื่อนไข (Assertion): ตรวจสอบว่า URL ตอบกลับสำเร็จและไม่ว่างเปล่า
  await expect(page).toHaveURL(/.+/);
});
`,
  },
  {
    name: "Form Fill & Auth",
    code: `// ==============================================================
// 🔐 ทดสอบการกรอกฟอร์มและการยืนยันตัวตน (Form Fill & Authentication)
// วัตถุประสงค์: จำลองการกรอกข้อมูลผู้ใช้งาน รหัสผ่าน และการคลิกปุ่มเข้าสู่ระบบ
// ==============================================================
import { test, expect } from "@playwright/test";

// กำหนด Scenario ทดสอบขั้นตอนการล็อกอิน
test("Login flow verification", async ({ page }) => {
  // 1. นำทาง Browser ไปยังหน้าเข้าสู่ระบบ (/login)
  await page.goto("/login");

  // 2. ค้นหาองค์ประกอบของฟอร์ม (Username และ Password Input)
  const username = page.locator("#login-username, input[type='text'], input[name='username']");
  const password = page.locator("#login-password, input[type='password'], input[name='password']");

  // 3. ตรวจสอบว่าพบฟิลด์กรอกข้อมูลหรือไม่ แล้วจำลองการพิมพ์ข้อมูลของผู้ใช้
  if (await username.count() > 0) {
    // 3.1 กรอกชื่อผู้ใช้ตัวอย่าง
    await username.first().fill("test-user");

    // 3.2 กรอกรหัสผ่านตัวอย่าง
    await password.first().fill("password123");

    // 4. จำลองการคลิกปุ่ม Submit หรือปุ่มเข้าสู่ระบบ
    await page.locator("#login-submit, button[type='submit']").first().click();
  }

  // 5. ตรวจสอบเงื่อนไขผลลัพธ์: ต้องไม่ถูกนำทางไปยังหน้าข้อผิดพลาด (/error)
  await expect(page).not.toHaveURL(/\\/error/);
});
`,
  },
  {
    name: "API Health Check",
    code: `// ==============================================================
// 🩺 ทดสอบความพร้อมของระบบเซิร์ฟเวอร์ (API Health Check)
// วัตถุประสงค์: ส่งคำขอ HTTP ตรงไปยัง Backend Endpoint เพื่อตรวจเช็คสถานะการทำงาน
// ==============================================================
import { test, expect } from "@playwright/test";

// กำหนด Scenario สำหรับการทดสอบ API ผ่าน { request } context
test("Health check endpoint", async ({ request }) => {
  // 1. ส่งคำขอแบบ GET ไปยัง Endpoint /api/health
  const res = await request.get("/api/health");

  // 2. ตรวจสอบ HTTP Status Code: ต้องตอบกลับสถานะปกติ (ไม่ใช่ Error 5xx)
  expect(res.status()).toBeLessThan(500);
});
`,
  },
];

const ALL_TEMPLATES = [...STS_TEMPLATES, ...GENERIC_TEMPLATES];

export function CodeWorkspace({
  code,
  onChange,
  dirty = false,
  onReset,
  onCreateDraft,
  disabled = false,
  activeTitle,
  isLoading = false,
}: CodeWorkspaceProps) {
  const lineCount = code ? code.split("\n").length : 1;
  const byteSize = typeof window !== "undefined" ? new Blob([code]).size : code.length;
  const maxBytes = 200000;

  const lineNumbersText = React.useMemo(() => {
    const count = Math.max(lineCount, 12);
    const lines: string[] = [];
    for (let i = 1; i <= count; i++) {
      lines.push(String(i));
    }
    return lines.join("\n");
  }, [lineCount]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newCode = code.substring(0, start) + "  " + code.substring(end);
      onChange(newCode);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-sm overflow-hidden flex flex-col">
      {/* Editor Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-bold text-slate-200 shrink-0">
            📝 Code Workspace
          </span>
          {activeTitle && (
            <span
              className="max-w-[280px] truncate px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono"
              title={activeTitle}
            >
              {activeTitle}
            </span>
          )}
          {isLoading && (
            <span className="text-[10px] font-mono text-indigo-400 animate-pulse shrink-0">
              Loading spec...
            </span>
          )}
          {dirty && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono shrink-0">
              Draft Modified
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Template picker */}
          <select
            aria-label="Insert template"
            disabled={disabled}
            onChange={(e) => {
              const selectedTpl = ALL_TEMPLATES.find((t) => t.name === e.target.value);
              if (selectedTpl) {
                onChange(selectedTpl.code);
              }
            }}
            defaultValue=""
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="" disabled>
              + เลือกเทมเพลตฟังก์ชั่น
            </option>
            <optgroup label="📋 ProjectSTS Functions (FN-01 ถึง FN-11)">
              {STS_TEMPLATES.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="🌐 เทมเพลตพื้นฐานทั่วไป">
              {GENERIC_TEMPLATES.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </select>

          {onCreateDraft && (
            <button
              type="button"
              disabled={disabled}
              onClick={onCreateDraft}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 hover:bg-indigo-900/50 hover:text-white rounded transition-colors cursor-pointer"
            >
              <span>✨</span>
              <span>Create Draft</span>
            </button>
          )}

          {onReset && dirty && (
            <button
              type="button"
              disabled={disabled}
              onClick={onReset}
              className="px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            >
              Reset
            </button>
          )}

          <div className="text-[10px] font-mono text-slate-400 border-l border-slate-800 pl-2">
            <span>{lineCount} lines</span>
            <span className="mx-1">•</span>
            <span className={byteSize > maxBytes ? "text-rose-400" : ""}>
              {(byteSize / 1024).toFixed(1)} KB
            </span>
          </div>
        </div>
      </div>

      {/* Editor Body with smooth transition */}
      <div
        className={`relative flex min-h-[260px] max-h-[440px] bg-slate-950/90 font-mono text-xs transition-opacity duration-200 ${
          isLoading ? "opacity-60" : "opacity-100"
        }`}
      >
        {/* Line Numbers - single fast DOM node */}
        <pre
          aria-hidden="true"
          className="select-none py-3 px-2 text-right text-slate-600 bg-slate-950 border-r border-slate-800/80 font-mono text-xs leading-relaxed whitespace-pre m-0"
        >
          {lineNumbersText}
        </pre>

        {/* Code Textarea */}
        <textarea
          aria-label="Playwright Test Code"
          value={code}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full flex-1 p-3 bg-transparent text-slate-100 placeholder:text-slate-600 resize-none font-mono text-xs leading-relaxed focus:outline-none disabled:opacity-50"
          placeholder="// Write your Playwright test or load a spec from the Test Explorer..."
        />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-1.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>Runs as isolated spec in temporary workspace</span>
        <span>TypeScript / ESM syntax</span>
      </div>
    </section>
  );
}

export default CodeWorkspace;
