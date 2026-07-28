# Login UI Redesign Implementation Plan

> **For agentic workers:** Use this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Git operations are intentionally omitted; the user manages Git manually.

**Goal:** ปรับหน้า login ของ Morniter ให้เป็น production auth surface ที่อ่านง่าย ใช้งานได้บน desktop และมือถือ ไม่มี gradient color และยังคง authentication flow เดิม

**Architecture:** คง `LoginPage` เป็น client component เดิมและใช้ `BrandLogo` ที่มีอยู่ ไม่เพิ่ม UI dependency หรือแยก form เป็น abstraction ใหม่เพราะ flow มีเพียงชุดเดียว การเปลี่ยนแปลงจะจำกัดอยู่ที่โครงสร้างและ state presentation ของหน้า login ส่วน POST `/api/auth/login`, tab-session marker และ redirect ไป `/monitor` ต้องทำงานเหมือนเดิม

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest Testing Library, Playwright

## Inline Execution Status (2026-07-29)

- [x] Login page JSX changed to a solid, responsive two-zone auth surface with no gradient or blur.
- [x] Password accessibility contract added: autocomplete, described-by help text, invalid state and alert semantics.
- [x] Login component tests pass 4/4; full Vitest suite passes 48 files and 201 tests.
- [x] Lint, typecheck and production build pass.
- [x] Existing local server at `http://localhost:3000/login` verified at 1440px and 375px with no gradient, no horizontal overflow and disabled empty-submit state.
- [ ] `e2e/monitor.spec.ts` still needs a run after the existing Next dev server releases the workspace `.next` lock; no process was stopped automatically.

## Global Constraints

- หน้า login ต้องไม่มี class หรือ style ที่สร้าง gradient เช่น `bg-gradient-*`, `from-*`, `via-*`, `to-*`, `background-image: linear-gradient(...)` หรือ gradient text
- ใช้พื้นผิวสีทึบและ accent สี cyan เดียวสำหรับ action/focus; ห้ามใช้ gradient เพื่อสร้าง hierarchy
- ห้ามเปลี่ยน endpoint, request body, status handling, tab-session key, session marker หรือ redirect behavior
- ต้องรองรับความกว้าง 320px ขึ้นไป โดยไม่มี horizontal overflow และ desktop ต้องมี visual hierarchy ที่ชัดเจน
- Error ต้องเป็นข้อความทั่วไปแบบเดิม ไม่เปิดเผยรายละเอียด credential หรือ server internals
- ช่อง password ต้องใช้ `type="password"`, `autoComplete="current-password"`, label ที่ผูกกับ input และ focus state ที่มองเห็นได้
- Submit ต้อง disabled เมื่อช่องว่างหรือกำลังส่ง และต้องแสดงสถานะกำลังตรวจสอบโดยไม่เปลี่ยน layout กระโดด
- ใช้ font family ที่มีอยู่ใน project; ไม่เพิ่ม font package และไม่แก้ global typography ในงานนี้
- ห้ามแก้ gradient ใน dashboard, progress bar หรือ component อื่น เพราะ scope นี้คือหน้า login เท่านั้น
- ห้ามเพิ่ม Git command ในแผนหรือระหว่าง implementation

## Impeccable Design Direction

Physical scene: ผู้ใช้เปิด Morniter บนจอ desktop หรือ laptop ในห้องทำงานที่แสงไม่คงที่ ต้องเห็นช่อง password และสถานะการเข้าสู่ระบบชัดเจนทันทีโดยไม่ถูกรบกวนด้วยเอฟเฟกต์ตกแต่ง

Color strategy: restrained product UI. ใช้ `#0a0d14` เป็นพื้นหลัง, `#111827` เป็น form surface, `#253044` เป็น border, `#22d3ee` เป็น primary accent และสี error rose ที่มี contrast เพียงพอ ใช้สี accent เฉพาะปุ่ม, focus ring และสถานะสำคัญ

Layout: desktop ใช้ two-zone layout ที่ฝั่ง identity กว้างกว่า form เล็กน้อย; mobile รวมเป็น single column โดย form อยู่ด้านบนและข้อความ identity อยู่ด้านล่างหรืออยู่ใน block เดียวกัน ไม่ใช้ hero image, decorative gradient, glass blur หรือสถิติปลอม

Typography: ใช้ `font-sans` สำหรับ heading, label และ button; ใช้ `font-mono` เฉพาะข้อความ session/telemetry ที่เป็น technical metadata ขนาดเล็ก หัวข้อใช้ fixed product scale เช่น `text-2xl` ไม่ใช้ clamp หรือ display text ใหญ่เกินจำเป็น

Interaction: transition เฉพาะสี border/background 150-200ms; focus ring ต้องเห็นชัด; error ใช้ `role="alert"`; รองรับ `prefers-reduced-motion` โดยไม่มี animation ที่จำเป็นต่อการเห็น content

---

### Task 1: Lock Login Behavior and Accessibility Contract

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `tests/components/LoginPage.test.tsx`
- Verify: `e2e/monitor.spec.ts`

**Interfaces:**
- Consumes: existing `POST /api/auth/login` with `{ password }`
- Produces: the same `204` success flow, `Invalid credentials` failure fallback, `Network error. Please try again.` network fallback, `TAB_SESSION_STORAGE_KEY` marker and `/monitor` redirect

- [ ] **Step 1: Extend component tests before changing markup**

Add assertions to `tests/components/LoginPage.test.tsx`:

```tsx
it("keeps the password input accessible and the submit state explicit", () => {
  render(<LoginPage />);

  const input = screen.getByLabelText(/group password/i);
  const button = screen.getByRole("button", { name: /sign in/i });

  expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveAttribute("autocomplete", "current-password");
  expect(input).toHaveAttribute("aria-describedby", "group-password-help");
  expect(button).toBeDisabled();
});

it("does not use gradient classes on the login surface", () => {
  const { container } = render(<LoginPage />);
  expect(container.querySelector('[class*="gradient"]')).toBeNull();
});

it("marks authentication errors as an alert", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: "Invalid credentials" }),
  }));

  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText(/group password/i), {
    target: { value: "wrongpass" },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run the focused tests and verify the new contract fails**

Run:

```powershell
npx vitest run tests/components/LoginPage.test.tsx
```

Expected: the existing page fails the no-gradient and accessibility assertions because the button uses `bg-gradient-to-r`, the input has no `autocomplete`/`aria-describedby`, and the error container has no `role="alert"`.

- [ ] **Step 3: Preserve the existing request and session behavior while refactoring the JSX**

Keep this behavior unchanged in `src/app/login/page.tsx`:

```tsx
const res = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
});

if (res.status === 204) {
  window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, createTabSessionMarker());
  window.location.href = "/monitor";
  return;
}

const data = await res.json().catch(() => ({ error: "Invalid credentials" }));
setErrorMsg(data.error || "Invalid credentials");
```

Do not change the API route or introduce client-side password validation beyond the existing required/non-empty check.

### Task 2: Implement the Solid, Responsive Login Surface

**Files:**
- Modify: `src/app/login/page.tsx`
- Verify: `src/components/BrandLogo.tsx`

**Interfaces:**
- Consumes: `BrandLogo`, `TAB_SESSION_STORAGE_KEY`, `createTabSessionMarker`
- Produces: semantic login form with stable selectors used by component and E2E tests

- [ ] **Step 1: Replace the page shell with solid surfaces**

Use the following structure as the implementation target. Keep the existing `useState` and submit handler; replace only the returned JSX and add the referenced attributes/classes:

```tsx
return (
  <main className="min-h-screen bg-[#0a0d14] text-slate-100 font-sans selection:bg-cyan-300 selection:text-slate-950">
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-10">
      <div className="grid w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-2xl shadow-black/30 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex min-h-[560px] flex-col justify-between border-b border-slate-800 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
          <div>
            <BrandLogo size="md" />
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300">
              Morniter / Workspace access
            </p>
            <h1 className="mt-4 max-w-md text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              See what changed before it becomes a problem.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
              Sign in to review deployment telemetry, service health and test execution logs.
            </p>
          </div>

          <p className="max-w-sm font-mono text-[11px] leading-5 text-slate-400">
            Read-only monitoring workspace. Test execution requires a separate unlock step.
          </p>
        </section>

        <section className="flex min-h-[560px] items-center p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-sm">
            <p className="font-mono text-xs text-slate-400">Group authentication</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Project Monitor Access
            </h2>
            <p id="group-password-help" className="mt-3 text-sm leading-6 text-slate-300">
              Enter the group password to view telemetry.
            </p>

            {errorMsg && (
              <div role="alert" className="mt-6 rounded-lg border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="group-password" className="block text-sm font-medium text-slate-200">
                  Group password
                </label>
                <input
                  id="group-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-describedby="group-password-help"
                  aria-invalid={Boolean(errorMsg)}
                  required
                  autoFocus
                  className="w-full rounded-lg border border-slate-700 bg-[#0a0d14] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 hover:border-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || !password}
                className="w-full rounded-lg bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-[#111827] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isPending ? "Authenticating..." : "Sign in"}
              </button>
            </form>

            <p className="mt-8 border-t border-slate-800 pt-5 font-mono text-[11px] leading-5 text-slate-400">
              This session is limited to the current browser tab.
            </p>
          </div>
        </section>
      </div>
    </div>
  </main>
);
```

The final implementation must not include `bg-gradient-*`, `from-*`, `via-*`, `to-*`, `backdrop-blur`, or gradient text classes on this page. Keep the existing logo asset and its accessible alt text.

- [ ] **Step 2: Verify responsive and state behavior in the browser**

Run the app and inspect `/login` at desktop width 1440px and mobile width 375px. Verify:

- desktop shows two readable zones without horizontal scroll;
- mobile stacks the identity and form zones without clipped text;
- empty password keeps `Sign in` disabled;
- typing enables the button;
- pending state changes the label to `Authenticating...` and prevents duplicate submit;
- wrong password keeps the user on `/login` and displays one visible alert;
- successful login still writes the tab marker and navigates to `/monitor`;
- keyboard focus is visible on the input and button.

### Task 3: Regression Verification and Handoff

**Files:**
- Verify: `tests/components/LoginPage.test.tsx`
- Verify: `e2e/monitor.spec.ts`
- Verify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: the redesigned page and unchanged auth API
- Produces: passing login component tests, unauthenticated redirect coverage and wrong-password coverage

- [ ] **Step 1: Run focused component tests**

Run:

```powershell
npx vitest run tests/components/LoginPage.test.tsx
```

Expected: all login UI, error and no-gradient assertions pass.

- [ ] **Step 2: Run login E2E tests**

Run:

```powershell
npx playwright test e2e/monitor.spec.ts --reporter=line
```

Expected: unauthenticated `/monitor` redirects to `/login`, and wrong password shows a generic invalid-credentials error without leaving the login page.

- [ ] **Step 3: Run production checks**

Run in order:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: every command exits 0. No gradient detector hit should remain in `src/app/login/page.tsx`.

- [ ] **Step 4: User-managed Git checkpoint**

Review only the login page, its test changes and this plan. The user commits and deploys manually.

## Self-Review

- [ ] Scope is limited to login UI; auth endpoint and session behavior are unchanged.
- [ ] No gradient class, gradient text, blur panel or decorative login animation remains.
- [ ] Desktop and mobile layouts have a defined behavior.
- [ ] Empty, focus, pending, error and success states are covered.
- [ ] Labels, help text, error alert and keyboard focus are accessible.
- [ ] Existing E2E selectors remain valid: `Group password`, `Sign in`, `Invalid credentials`.
- [ ] No new dependency or global CSS change is required.
- [ ] No Git operation is included.
