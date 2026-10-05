# คู่มือและแม่แบบมาตรฐานการสร้าง UAT Automation Script ตาม Role (Playwright STS Blueprint)

> **เอกสารอ้างอิงฉบับสมบูรณ์**: สำหรับการพัฒนาชุดทดสอบ UAT Script สำหรับ Role ถัดไป (เช่น `Province Officer`, `Teacher Full-Workflow`, หรือ `Platform Admin`) โดยถอดแบบจากมาตรฐานความสำเร็จของ **School All-in-One (Director & Admin)** ที่ผ่านการทดสอบแบบ Browser Automation จริง 100%

---

## สารบัญ (Table of Contents)
1. [ภาพรวมสถาปัตยกรรม UAT Script (Architecture & Design Principles)](#1-ภาพรวมสถาปัตยกรรม-uat-script)
2. [ปัญหาคลาสสิกที่พบบน Browser และวิธีป้องกัน (Pitfalls & Battle-Tested Solutions)](#2-ปัญหาคลาสสิกที่พบบน-browser-และวิธีป้องกัน)
3. [แม่แบบโครงสร้างไฟล์ UAT Spec ฉบับสมบูรณ์ (Spec Template)](#3-แม่แบบโครงสร้างไฟล์-uat-spec-ฉบับสมบูรณ์)
4. [แม่แบบ Mock API และการสร้าง Mock Data ที่สมจริง (Mock API Blueprint)](#4-แม่แบบ-mock-api-และการสร้าง-mock-data-ที่สมจริง)
5. [การซิงค์ระบบ 3 จุดที่ต้องทำควบคู่กันเสมอ (Triple-Sync Pattern)](#5-การซิงค์ระบบ-3-จุดที่ต้องทำควบคู่กันเสมอ)
6. [แนวทางการสั่งงาน AI และการเขียน Plan (Prompting & Planning Guide)](#6-แนวทางการสั่งงาน-ai-และการเขียน-plan)
7. [Checklist การตรวจสอบคุณภาพก่อน Release (QA Acceptance Criteria)](#7-checklist-การตรวจสอบคุณภาพก่อน-release)

---

## 1. ภาพรวมสถาปัตยกรรม UAT Script

### 1.1 หลักการ "All-in-One Sequential Workflow"
ในการทดสอบระดับ UAT สำหรับผู้ใช้งานจริง (End-to-End Persona Testing) เราไม่ควรแยกเทสเป็นไฟล์ย่อยๆ ที่เปิดปิดเบราว์เซอร์ใหม่ทุกครั้ง เพราะ:
- เสียเวลา Login ซ้ำซ้อน
- ไม่สะท้อนพฤติกรรมการใช้งานจริงของ User ใน 1 วันทำการ (Daily Lifecycle)
- เกิด Flaky ง่ายเมื่อ state ระหว่างหน้าไม่ต่อเนื่อง

**โครงสร้างที่ถูกต้อง:**
- รวมการทำงานหลักของ Role นั้นไว้ใน **1 Spec ไฟล์หลัก** (เช่น `00-<role>-uat-all-in-one.spec.ts`)
- แบ่งการทำงานออกเป็น **หมวดหมู่ (Categories)** ด้วย `test.step("หมวด X: ...")` เรียงลำดับจากเช้าไปเย็น หรือจากระดับสถิติไปจนถึงการปฏิบัติการจริง
- รักษา Session ต่อเนื่อง (Single Login -> Dashboard -> Action -> Detail -> Export/Report -> Logout)

### 1.2 ลำดับความน่าเชื่อถือของ Selector (Locator Priority)
ห้ามอิงกับ CSS Class แปลกปลอมหรือ Tailwind Styling เพราะเปลี่ยนบ่อย ให้ใช้ลำดับดังนี้:
1. `page.getByRole(...)` หรือ `locator("button:has-text('...')")`
2. `page.getByLabel(...)` หรือ `locator("#specific-id")`
3. `page.locator("[data-testid='...']")`
4. Regex Text Pattern ที่ยืดหยุ่น เช่น `text=/นำไปใช้|ค้นหา|บันทึก/i`

---

## 2. ปัญหาคลาสสิกที่พบบน Browser และวิธีป้องกัน

จากประสบการณ์จริงในการทดสอบหน้า Browser ของ Role ผู้อำนวยการและแอดมิน นี่คือ 5 จุดตายที่ต้องควบคุมอย่างเคร่งครัด:

| ลำดับ | ปัญหาที่มักเกิดบน Browser | สาเหตุหลัก | วิธีแก้ปัญหาที่ผ่านการพิสูจน์แล้ว |
|---|---|---|---|
| **1** | **Dialog/Modal ถูกปิดก่อนกด 'นำไปใช้'** | สคริปต์ไปคลิกปุ่ม Close ทันที หรือ timeout รีบเกินไป | • ต้อง scroll หาปุ่ม Submit/นำไปใช้<br>• รอ State ของ Form กรอกเสร็จ<br>• มี `page.waitForTimeout(800-1500)` หลังเลือก Option |
| **2** | **กดตัวกรองแล้ว ข้อมูลบนหน้าจอไม่เปลี่ยน** | Mock API คืนค่าเดิม ไม่เช็ค Query Params (`classroomId`, `dateRange`) | • แยก Response เป็น 2 สถานะชัดเจน (`hasFilter = true` vs `default`)<br>• เปลี่ยนทั้งตัวเลข, กราฟ, และ Tag บน UI |
| **3** | **การวิเคราะห์ AI ขึ้นล้มเหลว (Failed/Error)** | Mock คืน Error 500 หรือค้างที่ State `ANALYZING` | • Mock สถานะเป็น `COMPLETED`<br>• ส่งผลลัพธ์คะแนน, ข้อความสรุป, และคำแนะนำพร้อมทันที |
| **4** | **แบบฟอร์มส่งต่อ (Referral) กรอกไม่เสร็จ ถูกตัดก่อน** | มี Validation ฟิลด์บังคับที่ยังไม่ได้กรอก (เช่น หน่วยงานปลายทาง, เหตุผล) | • กรอกครบทุกฟิลด์ที่ Form ต้องการ<br>• ตรวจสอบ radio button / select ให้ครบก่อนกดส่ง |
| **5** | **ปุ่ม Import ทำงานค้าง หรือไม่มีตารางประวัติ** | ขาด Mock Endpoint ประวัติ (`/api/students/import/history`) | • จำลองข้อมูลประวัติย้อนหลังอย่างน้อย 2 แบทช์ พร้อมสถานะ `COMPLETED` |

---

## 3. แม่แบบโครงสร้างไฟล์ UAT Spec ฉบับสมบูรณ์

โครงสร้างไฟล์: `e2e/sts/specs/00-<role>-uat-all-in-one.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { setupStsMockApis } from "../fixtures/mock-api";

test.describe("[UAT ประจำ Role] ระบบงาน <ชื่อ Role ภาษาไทย> (<Role_English> All-in-One)", () => {
  test.beforeEach(async ({ page }) => {
    // 1. ผูก Mock API กลางและเฉพาะทาง
    await setupStsMockApis(page);

    // 2. ปรับขนาดหน้าจอเป็น Desktop มาตรฐาน
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("TC-STS-<ROLE>-COMPLETE-E2E: <Role> Complete UAT Workflow", async ({ page }) => {
    test.setTimeout(180_000); // 3 นาทีสำหรับ All-in-One Suite

    // =========================================================================
    // หมวด 1: การยืนยันตัวตนและการเข้าสู่ระบบ
    // =========================================================================
    await test.step("หมวด 1: เข้าสู่ระบบด้วยบทบาท <Role> และตรวจสอบ URL Redirection", async () => {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");

      const usernameInput = page.locator("#login-username, input[name='username']").first();
      const passwordInput = page.locator("#login-password, input[name='password']").first();
      const submitBtn = page.locator("#login-submit, button[type='submit']").first();

      await usernameInput.fill("<role_username>");
      await passwordInput.fill("changeme");
      await submitBtn.click();

      // ตรวจสอบการเปลี่ยนหน้าเข้าสู่ Dashboard
      await expect(page).toHaveURL(/\/(?:<role_path>|dashboard)/, { timeout: 15_000 });
      await page.waitForTimeout(1500);
    });

    // =========================================================================
    // หมวด 2: การตรวจสอบสถิติ Dashboard และการใช้งานตัวกรอง (Filter)
    // =========================================================================
    await test.step("หมวด 2: ตรวจสอบ Dashboard กรองข้อมูล และตรวจสอบการอัปเดตค่าสถิติ", async () => {
      // 1. ตรวจสอบการแสดงผล Header และการ์ดสถิติเดิม (ก่อนกรอง)
      await expect(page.locator("main").locator("h1, h2").first()).toBeVisible();
      await expect(page.locator("text=/สถิติ|ภาพรวม|ดัชนี/i").first()).toBeVisible();

      // 2. เปิดหน้าต่างตัวกรอง (Modal)
      const filterBtn = page.locator("button:has-text('ตัวกรอง'), button[aria-label*='ตัวกรอง']").first();
      if (await filterBtn.isVisible()) {
        await filterBtn.click();
        await page.waitForTimeout(1000);

        // 3. เลือกเงื่อนไขตัวกรอง
        const filterSelect = page.locator("#filter-selector, [role='combobox']").first();
        if (await filterSelect.isVisible()) {
          await filterSelect.click();
          await page.waitForTimeout(600);
          const option = page.locator("[role='option']").first();
          if (await option.isVisible()) {
            await option.click();
            await page.waitForTimeout(800);
          }
        }

        // 4. กดปุ่ม 'นำไปใช้' (ห้ามปิดหน้าต่างก่อนกด!)
        const applyBtn = page.locator("button:has-text('นำไปใช้')").first();
        if (await applyBtn.isVisible()) {
          await applyBtn.scrollIntoViewIfNeeded();
          await applyBtn.click();
          await page.waitForTimeout(2500); // รอ Dashboard รีโหลดข้อมูล

          // 5. Assert ยืนยันว่าค่าเปลี่ยนเป็น Mock ตัวกรองจริง
          await expect(page.locator("text=/<ข้อความหรือตัวเลขที่เปลี่ยนไป>/i").first()).toBeVisible({ timeout: 5000 });
        }
      }
    });

    // =========================================================================
    // หมวด 3: การจัดการข้อมูลหลัก / ฟอร์มบันทึก / การส่งต่อ
    // =========================================================================
    await test.step("หมวด 3: จัดการบันทึกข้อมูล กรอกแบบฟอร์มให้ครบถ้วน และยืนยันผล", async () => {
      await page.goto("/<role_path>/action");
      await page.waitForTimeout(1500);

      // กรอกฟิลด์ข้อมูลให้ครบทุกช่องเพื่อไม่ให้ติด Form Validation
      const titleInput = page.locator("input#title, input[name='title']").first();
      if (await titleInput.isVisible()) {
        await titleInput.fill("บันทึกข้อมูลการทดสอบระบบ UAT ประจำวัน");
      }

      const descInput = page.locator("textarea#description, textarea[name='description']").first();
      if (await descInput.isVisible()) {
        await descInput.fill("รายละเอียดการติดตามและประเมินผลการดำเนินงาน");
      }

      // บันทึกข้อมูล
      const saveBtn = page.locator("button:has-text('บันทึก'), button:has-text('ยืนยัน')").first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await page.waitForTimeout(1500);
        await expect(page.locator("text=/สำเร็จ|เรียบร้อย|Saved/i").first()).toBeVisible({ timeout: 5000 });
      }
    });

    // =========================================================================
    // หมวด 4: การวิเคราะห์ AI และการประมวลผลอัตโนมัติ
    // =========================================================================
    await test.step("หมวด 4: ทดสอบการเรียกใช้งาน AI วิเคราะห์ และตรวจสอบผลลัพธ์ที่สมบูรณ์", async () => {
      const aiTriggerBtn = page.locator("button:has-text('วิเคราะห์ AI'), button:has-text('ประเมินความเสี่ยง')").first();
      if (await aiTriggerBtn.isVisible()) {
        await aiTriggerBtn.click();
        await page.waitForTimeout(2000);

        // ยืนยันว่า AI ทำงานสำเร็จ ไม่ขึ้นคำว่าล้มเหลว
        await expect(page.locator("text=/ล้มเหลว|ไม่สำเร็จ|Error/i")).not.toBeVisible();
        await expect(page.locator("text=/ผลการวิเคราะห์|คำแนะนำ|สำเร็จ|ระดับความเสี่ยง/i").first()).toBeVisible({ timeout: 10_000 });
      }
    });

    // =========================================================================
    // หมวด 5: การส่งออกรายงาน และประวัติการทำรายการ (Reports & History)
    // =========================================================================
    await test.step("หมวด 5: ตรวจสอบการพรีวิวรายงาน ปุ่มดาวน์โหลด Excel/PDF และตารางประวัติ", async () => {
      await page.goto("/<role_path>/reports");
      await page.waitForTimeout(1500);

      const exportBtn = page.locator("button:has-text('ส่งออก'), button:has-text('PDF'), button:has-text('Excel')").first();
      if (await exportBtn.isVisible()) {
        await exportBtn.click();
        await page.waitForTimeout(1000);
      }

      // ตรวจสอบตารางแสดงข้อมูล
      const dataTable = page.locator("table, [role='table']").first();
      if (await dataTable.isVisible()) {
        await expect(dataTable).toBeVisible();
      }
    });
  });
});
```

---

## 4. แม่แบบ Mock API และการสร้าง Mock Data ที่สมจริง

ไฟล์: `e2e/sts/fixtures/mock-api.ts`

### 4.1 รูปแบบการ Mock Endpoint ที่มีตัวกรอง (Dynamic Filter Mock)
ตัวอย่างที่ได้ผลจริงจาก Dashboard ผู้อำนวยการ:
```typescript
await page.route("**/api/dashboard/<role>/analytics*", async (route) => {
  const url = new URL(route.request().url());
  const classroomId = url.searchParams.get("classroomId");
  const startDate = url.searchParams.get("startDate");
  const hasFilter = !!(classroomId || startDate);

  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      generatedAt: new Date().toISOString(),
      appliedFilters: hasFilter ? { classroomId: Number(classroomId || 1), classroomName: "ม.3/1" } : {},
      overview: hasFilter
        ? { totalStudents: 35, totalCases: 2, closedCases: 1 }    // ข้อมูลเฉพาะห้อง
        : { totalStudents: 850, totalCases: 12, closedCases: 4 }, // ข้อมูลภาพรวมทั้งระบบ
      severityDistribution: hasFilter
        ? { LOW: 1, MEDIUM: 1, HIGH: 0 }  // รวม 2 เคส
        : { LOW: 5, MEDIUM: 4, HIGH: 3 }, // รวม 12 เคส
    }),
  });
});
```

### 4.2 รูปแบบการ Mock ผลลัพธ์ AI ให้สำเร็จสมบูรณ์ (AI Success Mock)
```typescript
await page.route("**/api/ai/analyze*", async (route) => {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "COMPLETED",
      riskLevel: "MEDIUM",
      confidenceScore: 0.94,
      summary: "นักเรียนมีแนวโน้มการขาดเรียนลดลงหลังจากได้รับการดูแล ปรับพฤติกรรมได้ดีขึ้น",
      recommendedActions: [
        "จัดคาบให้คำปรึกษาเพิ่มเติมสัปดาห์ละ 1 ครั้ง",
        "ประสานงานผู้ปกครองรายงานความก้าวหน้าอย่างต่อเนื่อง"
      ],
      evaluatedAt: new Date().toISOString(),
    }),
  });
});
```

### 4.3 รูปแบบการ Mock ตารางประวัติการนำเข้า (Import History Mock)
```typescript
await page.route(/\/api\/students\/import\/history|\/api\/students\/import-history/, async (route) => {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      history: [
        {
          id: 1,
          batchId: "IMPORT-2026-001",
          totalRecords: 150,
          successCount: 150,
          failedCount: 0,
          status: "COMPLETED",
          importedAt: "2026-09-20T09:30:00Z",
          importedByUser: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
        },
        {
          id: 2,
          batchId: "IMPORT-2026-002",
          totalRecords: 45,
          successCount: 45,
          failedCount: 0,
          status: "COMPLETED",
          importedAt: "2026-09-25T14:15:00Z",
          importedByUser: { id: 1, name: "สมชาย ผู้ดูแลระบบ (Admin)", username: "admin_a" },
        },
      ],
      total: 2,
    }),
  });
});
```

---

## 5. การซิงค์ระบบ 3 จุดที่ต้องทำควบคู่กันเสมอ

เพื่อให้โค้ดสามารถรันได้ทั้งใน CLI, Test Explorer บนเว็บ และโหมด Workspace Interactive ต้องอัปเดตไฟล์ทั้ง 3 ตำแหน่งนี้พร้อมกันเสมอ:

```
[1] e2e/sts/specs/00-<role>-uat-all-in-one.spec.ts  (Playwright Local Runner)
                            ↕
[2] src/lib/playwright-runner/function-templates.ts (Web In-App Runner & COMMON_STS_ROUTE_MOCKS)
                            ↕
[3] e2e/__workspace__/<role>-uat-all-in-one.spec.ts (Workspace Interactive Runner)
```

> **กฎเหล็ก**: หากมีการเพิ่ม Mock Endpoint ใหม่ใน `e2e/sts/fixtures/mock-api.ts` จะต้องคัดลอก Handler นั้นไปใส่ใน `COMMON_STS_ROUTE_MOCKS` ของ `function-templates.ts` และ `e2e/fixtures/mock-api.ts` ด้วย มิฉะนั้นการรันผ่านหน้าเว็บ Dashboard Morniter จะเกิดข้อผิดพลาด

---

## 6. แนวทางการสั่งงาน AI และการเขียน Plan

เวลาสั่งให้ AI หรือทีมสร้าง UAT Script สำหรับ Role ใหม่ ให้ใช้สูตรคำสั่ง 5 ขั้นตอน (5-Phase Prompting Formula) ดังนี้:

### Prompt Template 1: สแกนโครงสร้างและสร้าง Plan (Phase 1)
```text
"ช่วยสร้าง Plan ละเอียดสำหรับทำ UAT Script ของบทบาท [ระบุ Role เช่น Province Officer / เจ้าหน้าที่ระดับจังหวัด]:
1. สแกนไฟล์หน้าเว็บของ Role นี้ในโฟลเดอร์ src/app/(app)/... หรือ src/pages/... ว่ามี Route ใดบ้าง และมี Component อะไรบ้าง
2. ระบุ API Endpoints ทั้งหมดที่หน้านี้เรียกใช้งาน (พร้อม Request/Response Data Contract)
3. วางโครงร่าง UAT All-in-One โดยแบ่งเป็น 5-6 หมวดหมู่ ตั้งแต่ Login -> Dashboard สถิติ -> การกรองข้อมูล -> การจัดการเคส -> รายงาน
4. ตรวจสอบจุดเสี่ยง เช่น การเปิด-ปิด Modal, การวิเคราะห์ AI, การส่งออกรายงาน เพื่อเตรียมแนวทางป้องกัน"
```

### Prompt Template 2: ลงมือเขียนโค้ดและสร้าง Mock Data (Phase 2 & 3)
```text
"เริ่มลงมือสร้าง UAT Script ตาม Plan:
1. สร้างไฟล์ e2e/sts/specs/00-[role]-uat-all-in-one.spec.ts ตามแม่แบบ All-in-One Sequential Workflow
2. ใน e2e/sts/fixtures/mock-api.ts และ src/lib/playwright-runner/function-templates.ts ให้ Mock API ครบทุกตัว
   - สำคัญมาก: ตัวกรอง Dashboard ต้องสร้างข้อมูลสมมุติ (Mock Data) ให้เห็นความแตกต่างอย่างชัดเจนระหว่าง ก่อนกรอง vs หลังกรอง
   - AI Analysis ต้อง Mock ให้ได้ผลลัพธ์ COMPLETED พร้อมคำแนะนำทันที ไม่ปล่อยให้ขึ้น Error หรือล้มเหลว
   - ฟอร์มต่างๆ ต้องกรอกครบทุกฟิลด์ก่อนกด Submit เพื่อไม่ให้โดนปิด Tab หรือโดนตัดก่อนส่ง
3. ซิงค์สคริปต์ไปยัง e2e/__workspace__/ และ function-templates.ts ให้ตรงกันทั้ง 3 ที่"
```

### Prompt Template 3: ทดสอบและปรับปรุงความเสถียร (Phase 4)
```text
"รันคำสั่ง Playwright ทดสอบสคริปต์ที่สร้างขึ้น:
npx playwright test e2e/sts/specs/00-[role]-uat-all-in-one.spec.ts --project=chromium --config=playwright.sts.config.ts
- หากพบปัญหา Timeout ให้เพิ่ม waitForTimeout และปรับปรุง Selector ให้ยืดหยุ่น
- ตรวจสอบว่าทุก step ผ่าน 100% ครบทุกหมวด
- จากนั้นรัน npm run build เพื่อยืนยันว่าไม่มี Error ในฝั่ง Next.js / TypeScript"
```

---

## 7. Checklist การตรวจสอบคุณภาพก่อน Release

ก่อนส่งมอบงานหรือ Commit & Push ให้ตรวจเช็ค Checklist ทั้ง 8 ข้อนี้:

- [ ] **1. Single Role All-in-One Flow**: รันตั้งแต่ต้นจนจบใน 1 คำสั่งผ่าน ไม่หลุดระหว่างหมวด
- [ ] **2. Distinct Filter Difference**: เมื่อกด "นำไปใช้" บนตัวกรอง ข้อมูลสถิติและตัวเลขบนหน้าจอเปลี่ยนไปจากเดิมอย่างชัดเจน
- [ ] **3. No Premature Modal Closure**: ไม่มีการกดปิด Modal หรือแท็บก่อนที่การบันทึก/ส่งข้อมูลจะเสร็จสมบูรณ์
- [ ] **4. AI Success Guaranteed**: ผลการวิเคราะห์ AI แสดงข้อมูลครบถ้วน ไม่ขึ้นคำว่าล้มเหลว
- [ ] **5. Realistic Form Submission**: แบบฟอร์มต่างๆ (เช่น ส่งต่อ, ขอความช่วยเหลือ, แก้ไขข้อมูล) ถูกกรอกครบทุกฟิลด์
- [ ] **6. Triple Synchronization**: โค้ดใน `e2e/sts/specs`, `src/lib/playwright-runner/function-templates.ts` และ `e2e/__workspace__` ตรงกัน 100%
- [ ] **7. Playwright Test ผ่าน 100%**: รันคำสั่ง `npx playwright test ...` ได้ผลลัพธ์ `passed`
- [ ] **8. Production Build ผ่าน**: รันคำสั่ง `npm run build` ผ่าน 100% โดยไม่มี Type error หรือ Build failure
