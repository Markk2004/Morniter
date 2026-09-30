import type {
  CatalogMatchMethod,
  NativeRunner,
  ProjectCoverageTest,
} from "@/lib/playwright-runner/types";

export const TEST_SECTION_PAGE_SIZE = 10;

export const MATCH_REASON_LABELS: Record<CatalogMatchMethod, string> = {
  explicit: "กำหนดไว้ใน automation map",
  "source-id": "พบ Function/Test ID ใน source",
  path: "ตรงจากชื่อโฟลเดอร์หรือไฟล์",
  title: "ตรงจากชื่อ test",
  keyword: "ตรงจากคำสำคัญ",
  unmatched: "ไม่มีรายละเอียดการจับคู่",
};

export const RUNNER_LABELS: Record<NativeRunner, string> = {
  playwright: "Playwright",
  "generated-playwright": "Playwright (Gen)",
  "node-test": "Frontend Node",
  jest: "Backend Jest",
  "jest-e2e": "Backend Jest E2E",
};

export function getRunnerLabel(runner: NativeRunner): string {
  return RUNNER_LABELS[runner] || runner;
}

export function partitionTestsByConfidence(tests: readonly ProjectCoverageTest[]) {
  return {
    ready: tests.filter((test) => test.confidence !== "low"),
    review: tests.filter((test) => test.confidence === "low"),
  };
}

export function getMatchReasonLabels(methods: readonly CatalogMatchMethod[]): string[] {
  if (methods.length === 0) return ["ไม่มีรายละเอียดการจับคู่"];
  return methods.map((method) => MATCH_REASON_LABELS[method] || method);
}

export interface TestThaiMeta {
  role: string;
  roleBadgeStyle: string;
  description: string;
}

export function getTestThaiMeta(title: string): TestThaiMeta {
  const t = title.toUpperCase();

  if (t.includes("AUTH-PLATFORM-ADMIN")) {
    return {
      role: "Platform Admin",
      roleBadgeStyle: "border-purple-500/30 bg-purple-950/40 text-purple-300",
      description: "เข้าสู่ระบบและตรวจสอบการนำทางไปยังหน้าจัดการผู้ใช้ส่วนกลาง (/admin/users)",
    };
  }
  if (t.includes("AUTH-PROVINCE-OFFICER")) {
    return {
      role: "เจ้าหน้าที่เขต/จังหวัด",
      roleBadgeStyle: "border-sky-500/30 bg-sky-950/40 text-sky-300",
      description: "เข้าสู่ระบบและตรวจสอบการนำทางไปยังแดชบอร์ดภาพรวมระดับเขตพื้นที่ (/province)",
    };
  }
  if (t.includes("AUTH-SCHOOL-ADMIN")) {
    return {
      role: "School Admin",
      roleBadgeStyle: "border-indigo-500/30 bg-indigo-950/40 text-indigo-300",
      description: "เข้าสู่ระบบและตรวจสอบการนำทางไปยังคอนโซลผู้ดูแลระบบสถานศึกษา (/admin)",
    };
  }
  if (t.includes("AUTH-TEACHER")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "เข้าสู่ระบบและตรวจสอบการนำทางไปยังห้องเรียนและเช็คชื่อประจำวัน (/students)",
    };
  }
  if (t.includes("AUTH-DIRECTOR")) {
    return {
      role: "ผอ. โรงเรียน",
      roleBadgeStyle: "border-amber-500/30 bg-amber-950/40 text-amber-300",
      description: "เข้าสู่ระบบและตรวจสอบการนำทางไปยังแดชบอร์ดสถิติภาพรวมสถานศึกษา (/reports)",
    };
  }
  if (t.includes("AUTH-INVALID")) {
    return {
      role: "ตรวจสอบความปลอดภัย",
      roleBadgeStyle: "border-rose-500/30 bg-rose-950/40 text-rose-300",
      description: "ทดสอบกรอกรหัสผ่านไม่ถูกต้อง และต้องแสดงข้อความเตือน Error Alert",
    };
  }
  if (t.includes("AUTH-EMPTY")) {
    return {
      role: "ตรวจสอบความปลอดภัย",
      roleBadgeStyle: "border-rose-500/30 bg-rose-950/40 text-rose-300",
      description: "ทดสอบเว้นว่าง Username/Password และระบบต้องปฏิเสธการส่งฟอร์ม",
    };
  }
  if (t.includes("USER-001")) {
    return {
      role: "Platform Admin",
      roleBadgeStyle: "border-purple-500/30 bg-purple-950/40 text-purple-300",
      description: "ตรวจสอบทำเนียบผู้ใช้ การ์ดสรุป KPI สถานะบัญชี และตารางข้อมูล",
    };
  }
  if (t.includes("USER-002")) {
    return {
      role: "Platform Admin",
      roleBadgeStyle: "border-purple-500/30 bg-purple-950/40 text-purple-300",
      description: "ทดสอบค้นหาและกรองผู้ใช้งานตามสถานะ (Active/Suspended) และชื่อบัญชี",
    };
  }
  if (t.includes("USER-003")) {
    return {
      role: "Platform Admin",
      roleBadgeStyle: "border-purple-500/30 bg-purple-950/40 text-purple-300",
      description: "เปิด Modal เพิ่มผู้ใช้งานใหม่ และตรวจเช็คฟิลด์ข้อมูลที่ต้องกรอกครบถ้วน",
    };
  }
  if (t.includes("STU-001")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "เปิดดูทำเนียบรายชื่อนักเรียนประจำชั้นและห้องเรียน",
    };
  }
  if (t.includes("STU-002")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "ค้นหารายชื่อนักเรียนด้วยคำค้นหาในกล่อง Search",
    };
  }
  if (t.includes("STU-003")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "คลิกเลือกนักเรียนเพื่อดูข้อมูลประวัติรายบุคคล (Student Profile Modal)",
    };
  }
  if (t.includes("ATT-001")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "เปิดหน้าจอเช็คชื่อการเข้าเรียนประจำวัน",
    };
  }
  if (t.includes("ATT-002")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "ตรวจสอบยอดสถิติ (มา/ขาด/ลา/มาสาย) และแถวรายชื่อนักเรียน",
    };
  }
  if (t.includes("ATT-003")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "ค้นหาและกรองรายชื่อนักเรียนในตารางเช็คชื่อ",
    };
  }
  if (t.includes("CASE-001")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "ตรวจสอบทำเนียบเคสปัญหาของนักเรียน พร้อมป้ายสถานะและระดับความเสี่ยง",
    };
  }
  if (t.includes("CASE-002")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "เปิดแบบฟอร์มส่งต่อเคสปัญหานักเรียนใหม่",
    };
  }
  if (t.includes("CASE-003")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "กรอกข้อมูลและส่งเคสนักเรียนใหม่เข้าสู่ระบบ พร้อม Redirect กลับสู่รายการเคส",
    };
  }
  if (t.includes("REP-001")) {
    return {
      role: "ผอ. โรงเรียน",
      roleBadgeStyle: "border-amber-500/30 bg-amber-950/40 text-amber-300",
      description: "เปิดหน้า Report Studio และกำหนดเงื่อนไขการออกรายงาน",
    };
  }
  if (t.includes("REP-002")) {
    return {
      role: "ผอ. โรงเรียน",
      roleBadgeStyle: "border-amber-500/30 bg-amber-950/40 text-amber-300",
      description: "สร้าง Preview ตารางรายงานสรุป และตรวจสอบความถูกต้องของข้อมูล",
    };
  }
  if (t.includes("REP-003")) {
    return {
      role: "ผอ. โรงเรียน",
      roleBadgeStyle: "border-amber-500/30 bg-amber-950/40 text-amber-300",
      description: "สั่ง Export และเริ่มดาวน์โหลดไฟล์รายงานทั้ง Excel (.xlsx) และ PDF",
    };
  }
  if (t.includes("TRK-001")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "เปิดแผนที่และหน้าจอบันทึกพฤติกรรมและการติดตามเยี่ยมบ้าน",
    };
  }
  if (t.includes("TRK-002")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "ค้นหานักเรียนในรายการติดตามพฤติกรรม",
    };
  }
  if (t.includes("TRK-003")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "กรองรายการติดตามตามระดับความเสี่ยง (Risk Level)",
    };
  }
  if (t.includes("DASH-TEACHER")) {
    return {
      role: "ครูประจำชั้น",
      roleBadgeStyle: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
      description: "ตรวจสอบหน้าแดชบอร์ดครู การ์ดสรุปห้องเรียน และเมนูลัด",
    };
  }
  if (t.includes("DASH-DIRECTOR")) {
    return {
      role: "ผอ. โรงเรียน",
      roleBadgeStyle: "border-amber-500/30 bg-amber-950/40 text-amber-300",
      description: "ตรวจสอบแดชบอร์ดผู้บริหาร สถิติความเสี่ยงรวมของโรงเรียน",
    };
  }
  if (t.includes("DASH-ADMIN")) {
    return {
      role: "School Admin",
      roleBadgeStyle: "border-indigo-500/30 bg-indigo-950/40 text-indigo-300",
      description: "ตรวจสอบการเข้าถึงหน้าคอนโซลผู้ดูแลระบบสถานศึกษา",
    };
  }
  if (t.includes("AI-001")) {
    return {
      role: "School Admin",
      roleBadgeStyle: "border-indigo-500/30 bg-indigo-950/40 text-indigo-300",
      description: "เข้าดูหน้าจอ AI Evaluation และตรวจสอบชุดควบคุม Benchmark",
    };
  }
  if (t.includes("AI-002")) {
    return {
      role: "School Admin",
      roleBadgeStyle: "border-indigo-500/30 bg-indigo-950/40 text-indigo-300",
      description: "สั่งรันการประเมินแบบจำลอง AI (5-Fold) และตรวจสอบค่า F1 Macro และความแม่นยำ",
    };
  }
  if (t.includes("PRV-001")) {
    return {
      role: "เจ้าหน้าที่เขต/จังหวัด",
      roleBadgeStyle: "border-sky-500/30 bg-sky-950/40 text-sky-300",
      description: "ตรวจสอบหน้าแดชบอร์ดระดับจังหวัด สรุปสถิติโรงเรียนในสังกัด",
    };
  }
  if (t.includes("PRV-002")) {
    return {
      role: "เจ้าหน้าที่เขต/จังหวัด",
      roleBadgeStyle: "border-sky-500/30 bg-sky-950/40 text-sky-300",
      description: "นำทางไปหน้ารายงานเขตพื้นที่ และตรวจสอบ Tab ข้อมูลเปรียบเทียบ",
    };
  }
  if (t.includes("PWD-001")) {
    return {
      role: "ผู้ใช้งานทุกคน",
      roleBadgeStyle: "border-slate-500/30 bg-slate-800 text-slate-300",
      description: "เปิดหน้าเปลี่ยนรหัสผ่าน และตรวจเช็คเงื่อนไขความปลอดภัย (Policy Checklist)",
    };
  }
  if (t.includes("PWD-002")) {
    return {
      role: "ผู้ใช้งานทุกคน",
      roleBadgeStyle: "border-slate-500/30 bg-slate-800 text-slate-300",
      description: "กรอกรหัสผ่านใหม่ที่ผ่านเกณฑ์ความปลอดภัย และบันทึกสำเร็จ",
    };
  }

  return {
    role: "Automation Test",
    roleBadgeStyle: "border-slate-700 bg-slate-800 text-slate-400",
    description: "",
  };
}

export interface FunctionCategoryMeta {
  code: string;
  name: string;
  shortName: string;
  icon: string;
  badgeStyle: string;
}

export function resolveFunctionCategory(
  title = "",
  relativePath = "",
  groupName = "",
): FunctionCategoryMeta {
  const combined = `${title} ${relativePath} ${groupName}`.toUpperCase();

  if (combined.includes("AUTH") || combined.includes("LOGIN") || combined.includes("01-AUTH")) {
    return {
      code: "FN-STS-01",
      name: "เข้าสู่ระบบ (Authentication)",
      shortName: "เข้าสู่ระบบ",
      icon: "🔐",
      badgeStyle: "border-purple-500/40 bg-purple-950/60 text-purple-300",
    };
  }
  if (
    combined.includes("USER") ||
    combined.includes("08-USER") ||
    combined.includes("เปลี่ยน USER") ||
    combined.includes("จัดการผู้ใช้")
  ) {
    return {
      code: "FN-STS-02",
      name: "การจัดการผู้ใช้ (User Management)",
      shortName: "การจัดการผู้ใช้",
      icon: "👥",
      badgeStyle: "border-blue-500/40 bg-blue-950/60 text-blue-300",
    };
  }
  if (combined.includes("STU") || combined.includes("03-STUDENT") || combined.includes("นักเรียน")) {
    return {
      code: "FN-STS-03",
      name: "ข้อมูลนักเรียนและห้องเรียน (Students)",
      shortName: "ข้อมูลนักเรียน",
      icon: "🎒",
      badgeStyle: "border-teal-500/40 bg-teal-950/60 text-teal-300",
    };
  }
  if (combined.includes("ATT") || combined.includes("04-ATTENDANCE") || combined.includes("เช็คชื่อ")) {
    return {
      code: "FN-STS-04",
      name: "การเช็คชื่อเข้าเรียน (Attendance)",
      shortName: "เช็คชื่อเข้าเรียน",
      icon: "📅",
      badgeStyle: "border-emerald-500/40 bg-emerald-950/60 text-emerald-300",
    };
  }
  if (combined.includes("CASE") || combined.includes("05-CASE") || combined.includes("เคส")) {
    return {
      code: "FN-STS-05",
      name: "ระบบจัดการเคสปัญหา (Student Cases)",
      shortName: "จัดการเคสปัญหา",
      icon: "📋",
      badgeStyle: "border-amber-500/40 bg-amber-950/60 text-amber-300",
    };
  }
  if (combined.includes("REP") || combined.includes("06-REPORT") || combined.includes("รายงาน")) {
    return {
      code: "FN-STS-06",
      name: "รายงานสรุปและสถิติ (Reports & Export)",
      shortName: "รายงานสรุป",
      icon: "📊",
      badgeStyle: "border-cyan-500/40 bg-cyan-950/60 text-cyan-300",
    };
  }
  if (
    combined.includes("TRK") ||
    combined.includes("07-OBSERVATION") ||
    combined.includes("TRACKING") ||
    combined.includes("พฤติกรรม")
  ) {
    return {
      code: "FN-STS-07",
      name: "การติดตามและสังเกตพฤติกรรม (Observations)",
      shortName: "ติดตามพฤติกรรม",
      icon: "🔍",
      badgeStyle: "border-yellow-500/40 bg-yellow-950/60 text-yellow-300",
    };
  }
  if (combined.includes("DASH") || combined.includes("02-DASHBOARD") || combined.includes("แดชบอร์ด")) {
    return {
      code: "FN-STS-08",
      name: "แดชบอร์ดตามบทบาท (Dashboard Navigation)",
      shortName: "แดชบอร์ดตามบทบาท",
      icon: "🧭",
      badgeStyle: "border-indigo-500/40 bg-indigo-950/60 text-indigo-300",
    };
  }
  if (combined.includes("AI") || combined.includes("11-AI")) {
    return {
      code: "FN-STS-09",
      name: "ระบบวิเคราะห์ AI (AI Evaluation)",
      shortName: "การวิเคราะห์ AI",
      icon: "🤖",
      badgeStyle: "border-pink-500/40 bg-pink-950/60 text-pink-300",
    };
  }
  if (
    combined.includes("PRV") ||
    combined.includes("09-PROVINCE") ||
    combined.includes("เขต") ||
    combined.includes("จังหวัด")
  ) {
    return {
      code: "FN-STS-10",
      name: "แดชบอร์ดระดับเขตและจังหวัด (Platform & Province)",
      shortName: "ระดับเขต/จังหวัด",
      icon: "🏛️",
      badgeStyle: "border-sky-500/40 bg-sky-950/60 text-sky-300",
    };
  }
  if (
    combined.includes("PWD") ||
    combined.includes("10-PROFILE") ||
    combined.includes("PASSWORD") ||
    combined.includes("รหัสผ่าน")
  ) {
    return {
      code: "FN-STS-11",
      name: "โปรไฟล์ส่วนตัวและการเปลี่ยนรหัสผ่าน (Profile & Password)",
      shortName: "โปรไฟล์/รหัสผ่าน",
      icon: "🔑",
      badgeStyle: "border-rose-500/40 bg-rose-950/60 text-rose-300",
    };
  }

  return {
    code: "GENERIC",
    name: groupName || "ทั่วไป (General)",
    shortName: "ทั่วไป",
    icon: "📂",
    badgeStyle: "border-slate-700 bg-slate-800 text-slate-300",
  };
}

export interface FunctionDetailedDoc {
  id: string;
  code: string;
  name: string;
  role: string;
  workflow: string;
  overview: string;
  codeExplanation: string;
  steps: string[];
  expectedResult: string;
  keySelectors: string[];
}

export const FUNCTION_DETAILED_DOCS: Record<string, FunctionDetailedDoc> = {
  "FN-STS-01": {
    id: "FN-STS-01",
    code: "FN-STS-01",
    name: "ระบบยืนยันตัวตนและการเข้าสู่ระบบ (Authentication)",
    role: "ผู้ใช้งานทุกบทบาท (Teacher, Director, Admin, Officer)",
    workflow: "เปิดหน้า /login → เคลียร์คุกกี้ → กรอก Username/Password → ตรวจสอบการ Redirect และ Alert ข้อผิดพลาด",
    overview: "ทดสอบกระบวนการ Login เพื่อเข้าถึงระบบตามระดับสิทธิ์ผู้ใช้ ตรวจสอบว่าระบบจัดเก็บคุกกี้/เซสชันถูกต้อง นำทางผู้ใช้ไปยังหน้าเริ่มต้นที่สอดคล้องกับบทบาท และปฏิเสธการเข้าถึงเมื่อป้อนรหัสผ่านไม่ถูกต้อง",
    codeExplanation: "โค้ดทดสอบเริ่มต้นด้วย `page.context().clearCookies()` ใน hook `beforeEach` เพื่อเริ่มทดสอบจากสถานะยังไม่ล็อกอิน จากนั้นใช้คำสั่ง `page.goto('/login')` นำทางไปยังหน้าเข้าสู่ระบบ และใช้ `locator` ตรวจจับช่องกรอกชื่อผู้ใช้และรหัสผ่าน สั่งจำลองการพิมพ์ข้อความด้วย `.fill(...)` และคลิกปุ่มส่งฟอร์มด้วย `.click()` สุดท้ายใช้ assertion `expect(page).not.toHaveURL(...)` ตรวจสอบว่าระบบนำทางเปลี่ยนหน้าสำเร็จจริง หรือแสดงกล่อง Alert ข้อความสีแดงหากป้อนรหัสผิด",
    steps: [
      "1. ล้างคุกกี้และเซสชันเก่า (Clear Cookies) เพื่อเริ่มต้นทดสอบสถานะก่อนล็อกอิน",
      "2. นำทาง Browser ไปที่ URL หน้าล็อกอิน (/login) และตรวจเช็คความพร้อมของแบบฟอร์ม",
      "3. ระบุช่อง Input ชื่อผู้ใช้ (#login-username) และช่องรหัสผ่าน (#login-password) ด้วย Locator",
      "4. กรอกข้อมูลจำลองบัญชีผู้ใช้ (Username/Password) ตามสิทธิ์ที่ต้องการทดสอบ",
      "5. คลิกปุ่มเข้าสู่ระบบ (Submit Button) เพื่อส่งข้อมูลให้ระบบยืนยันตัวตน",
      "6. ตรวจสอบการเปลี่ยนเส้นทาง (Redirect Assertion) ต้องนำทางออกจากหน้า /login ไปยังแดชบอร์ดของผู้ใช้นั้น",
      "7. ทดสอบกรณีพิมพ์รหัสผ่านผิด ระบบต้องยังคงอยู่ที่หน้าเดิมและแสดงแจ้งเตือน Error Alert สีแดง",
    ],
    expectedResult: "ผู้ใช้ที่มีข้อมูลถูกต้องสามารถเข้าสู่ระบบและถูกนำทางไปยังหน้าจอการทำงานหลักตามบทบาท ส่วนผู้ที่กรอกข้อมูลผิดพลาดจะถูกปฏิเสธและขึ้นข้อความแจ้งเตือนความปลอดภัยทันที",
    keySelectors: [
      "#login-username, input[name='username'] (ช่องกรอกชื่อผู้ใช้)",
      "#login-password, input[name='password'] (ช่องกรอกรหัสผ่าน)",
      "button[type='submit'], #login-submit (ปุ่มเข้าสู่ระบบ)",
      "[role='alert'], .text-rose-500 (กล่องแจ้งเตือนข้อผิดพลาด)",
    ],
  },

  "FN-STS-01-ROLES": {
    id: "FN-STS-01-ROLES",
    code: "FN-STS-01 (Part 1)",
    name: "ระบบยืนยันตัวตน - เข้าสู่ระบบตามบทบาทผู้ใช้ (Login as Role)",
    role: "ผู้ใช้งานทุกบทบาท (Teacher, Director, Admin, Officer)",
    workflow: "เปิดหน้า /login → เคลียร์คุกกี้ → กรอกชื่อผู้ใช้และรหัสผ่านตามสิทธิ์ → ตรวจสอบการ Redirect ไปหน้าแดชบอร์ดตามสิทธิ์",
    overview: "ทดสอบการเข้าสู่ระบบสำเร็จสำหรับแต่ละบทบาทของผู้ใช้งานในระบบ (ครูประจำชั้น, ผอ.โรงเรียน, แอดมิน, เจ้าหน้าที่เขต) และตรวจสอบว่าระบบพานำทางไปยังแดชบอร์ดที่ถูกต้องตามสิทธิ์โดยอัตโนมัติ",
    codeExplanation: "โค้ดทำการตั้งค่า beforeEach เพื่อจำลอง API Response สำหรับ /api/auth/login ให้ส่ง accessToken และ User Payload ตาม Role นั้นๆ จากนั้นใช้คำสั่ง page.goto('/login') กรอก username และ password กด Submit และตรวจสอบว่าระบบ redirect ออกจากหน้าล็อกอินไปยังหน้าที่กำหนดด้วย expect(page).toHaveURL(...)",
    steps: [
      "1. ล้างคุกกี้และเซสชันเก่า (Clear Cookies) เพื่อเริ่มต้นทดสอบสถานะก่อนล็อกอิน",
      "2. นำทาง Browser ไปที่ URL หน้าล็อกอิน (/login)",
      "3. กรอก Username และ Password ของบทบาทที่ทดสอบ (เช่น teacher_a, director_a, admin_a)",
      "4. คลิกปุ่ม 'เข้าสู่ระบบ' (Submit Button)",
      "5. ตรวจสอบการนำทาง (URL Redirection) ไปยังหน้าหลักตามบทบาทนั้นๆ เช่น /teacher/dashboard หรือ /director/dashboard",
    ],
    expectedResult: "ผู้ใช้งานแต่ละบทบาทเข้าสู่ระบบสำเร็จและถูกนำทางไปยังหน้าจอการทำงานหลักตามสิทธิ์ของตนเองอย่างถูกต้อง",
    keySelectors: [
      "#login-username, input[name='username'] (ช่องกรอกชื่อผู้ใช้)",
      "#login-password, input[name='password'] (ช่องกรอกรหัสผ่าน)",
      "button[type='submit'], #login-submit (ปุ่มเข้าสู่ระบบ)",
    ],
  },

  "FN-STS-01-INVALID": {
    id: "FN-STS-01-INVALID",
    code: "FN-STS-01 (Part 2)",
    name: "ระบบยืนยันตัวตน - ตรวจสอบความปลอดภัยเมื่อรหัสผ่านผิด (Invalid Credentials)",
    role: "ตรวจสอบความปลอดภัย (Security Check)",
    workflow: "เปิดหน้า /login → กรอกชื่อผู้ใช้และรหัสผ่านที่ไม่ถูกต้อง → คลิกเข้าสู่ระบบ → ตรวจสอบว่าระบบปฏิเสธและแสดง Alert สีแดง",
    overview: "ทดสอบกลไกความปลอดภัยในการป้องกันการเข้าสู่ระบบที่ไม่ได้รับอนุญาต เมื่อผู้ใช้กรอกรหัสผ่านผิด ระบบต้องไม่อนุญาตให้เข้าสู่ระบบ ต้องคงอยู่ที่หน้า /login และต้องแสดงกล่องแจ้งเตือน Error Alert สีแดงชัดเจน",
    codeExplanation: "โค้ดทำการตั้งค่า Route Mocking สำหรับ /api/auth/login ให้ตอบกลับสถานะ HTTP 401 Unauthorized พร้อม message ข้อผิดพลาด จากนั้นสั่งกรอก username และรหัสผ่านที่ผิด (wrong_password_999) แล้วคลิกปุ่มส่งฟอร์ม ตรวจสอบว่ากล่องแจ้งเตือน Error Alert ปรากฏขึ้นใน DOM และ URL ยังคงเป็น /login",
    steps: [
      "1. ล้างคุกกี้และตั้งค่า Mock API ให้ตอบกลับ 401 Unauthorized",
      "2. นำทาง Browser ไปยัง URL หน้าล็อกอิน (/login)",
      "3. กรอกชื่อผู้ใช้และรหัสผ่านที่ไม่ถูกต้องในช่องแบบฟอร์ม",
      "4. คลิกปุ่ม 'เข้าสู่ระบบ' (Submit Button)",
      "5. ตรวจสอบว่ามีกล่องแจ้งเตือนสีแดง (Error Alert) แสดงข้อความเตือนผู้ใช้",
      "6. ตรวจสอบว่า URL ยังคงอยู่ที่หน้า /login (ไม่เกิดการ Redirection)",
    ],
    expectedResult: "ระบบปฏิเสธการเข้าสู่ระบบ คงอยู่ที่หน้าเดิม และแสดงข้อความเตือน Error Alert อย่างชัดเจน",
    keySelectors: [
      "#login-username, input[name='username'] (ช่องกรอกชื่อผู้ใช้)",
      "#login-password, input[name='password'] (ช่องกรอกรหัสผ่าน)",
      "button[type='submit'], #login-submit (ปุ่มเข้าสู่ระบบ)",
      "[role='alert'], .text-rose-500, [data-testid='error-alert'] (กล่องแจ้งเตือนข้อผิดพลาด)",
    ],
  },

  "FN-STS-01-EMPTY": {
    id: "FN-STS-01-EMPTY",
    code: "FN-STS-01 (Part 3)",
    name: "ระบบยืนยันตัวตน - ตรวจสอบการเว้นว่างข้อมูลเข้าสู่ระบบ (Empty Credentials)",
    role: "ตรวจสอบความปลอดภัย (Validation Check)",
    workflow: "เปิดหน้า /login → ไม่กรอกข้อมูลในช่องใดๆ (เว้นว่าง) → คลิกปุ่มส่งฟอร์มทันที → ตรวจสอบการปฏิเสธของระบบ",
    overview: "ทดสอบการตรวจสอบความถูกต้องของฟอร์ม (Form Validation) เมื่อผู้ใช้กดปุ่มเข้าสู่ระบบโดยเว้นว่างชื่อผู้ใช้หรือรหัสผ่าน ระบบต้องปฏิเสธการส่งคำขอ และแสดงข้อความแจ้งเตือนให้กรอกข้อมูล",
    codeExplanation: "โค้ดทำการเปิดหน้า /login ปล่อยช่อง username และ password ให้เป็นค่าว่าง แล้วคลิกปุ่มส่งฟอร์มทันที ตรวจสอบว่าเบราว์เซอร์หรือฟอร์มไม่ส่งคำขอผิดพลาด และแสดงสถานะ validation เตือนผู้ใช้ พร้อมทั้งคงอยู่ที่หน้าเดิม",
    steps: [
      "1. นำทาง Browser ไปยังหน้าเข้าสู่ระบบ (/login)",
      "2. ปล่อยช่องชื่อผู้ใช้และรหัสผ่านให้เป็นค่าว่าง (ไม่กรอกข้อมูล)",
      "3. คลิกปุ่ม 'เข้าสู่ระบบ' ทันที",
      "4. ตรวจสอบว่าระบบปฏิเสธการส่งฟอร์ม และยังคงอยู่ที่หน้า /login",
      "5. ตรวจสอบข้อความเตือนหรือสถานะ Validation บนแบบฟอร์ม",
    ],
    expectedResult: "ระบบปฏิเสธการส่งฟอร์มเมื่อเว้นว่างข้อมูล และแจ้งเตือนให้ผู้ใช้กรอกชื่อผู้ใช้และรหัสผ่าน",
    keySelectors: [
      "#login-username, input[name='username'] (ช่องกรอกชื่อผู้ใช้)",
      "#login-password, input[name='password'] (ช่องกรอกรหัสผ่าน)",
      "button[type='submit'], #login-submit (ปุ่มเข้าสู่ระบบ)",
      "[role='alert'], :invalid (ข้อความเตือนความถูกต้อง)",
    ],
  },

  "FN-STS-02": {
    id: "FN-STS-02",
    code: "FN-STS-02",
    name: "ระบบจัดการผู้ใช้ (User Management)",
    role: "ผู้ดูแลระบบแพลตฟอร์ม (Platform Admin) / ผู้ดูแลระบบสถานศึกษา",
    workflow: "เข้าสู่ /admin/users → ตรวจสอบการ์ด KPI ผู้ใช้ → ทดสอบกล่องค้นหา (Search Debounce) → ตรวจสอบตารางรายชื่อและการกรองสถานะ",
    overview: "ทดสอบโมดูลบริหารจัดการบัญชีผู้ใช้งานส่วนกลาง ตรวจสอบการแสดงผลตารางรายชื่อ คอลัมน์สถานะการใช้งาน (Active / Suspended) การทำงานของกล่องค้นหาแบบเรียลไทม์ และแบบฟอร์มเพิ่มผู้ใช้งานใหม่",
    codeExplanation: "โค้ดจะนำทางไปที่ `/admin/users` และตรวจสอบ URL ด้วย `toHaveURL` จากนั้นระบุช่องค้นหาผู้ใช้ด้วย `page.locator(\"input[placeholder*='ค้นหา']\")` ทำการกรอกคำค้นหาลงไป พร้อมสั่ง `page.waitForTimeout(500)` เพื่อรองรับการดีเลย์ของการหน่วงเวลาค้นหา (Debounce) จากนั้นตรวจสอบว่าตารางข้อมูลหรือการ์ดผู้ใช้งานอัปเดตผลลัพธ์ตรงกับคำค้นหาจริง",
    steps: [
      "1. นำทางไปยังหน้าจอจัดการผู้ใช้ (/admin/users) ด้วยสิทธิ์ผู้ดูแลระบบ",
      "2. ตรวจสอบการแสดงผลของการ์ดสถิติสรุปภาพรวมผู้ใช้ในระบบ",
      "3. ค้นหาช่องค้นหาผู้ใช้งาน (Search Input) และตรวจสอบว่าพร้อมรับการป้อนข้อมูล",
      "4. พิมพ์ชื่อผู้ใช้ที่ต้องการค้นหาลงในช่องค้นหา",
      "5. รอการประมวลผลการกรองข้อมูล (Search Debounce Interval)",
      "6. ตรวจสอบว่าตารางหรือรายการแสดงรายชื่อผู้ใช้งาน (User Table) แสดงผลตรงตามคำค้น",
      "7. ตรวจสอบความพร้อมของปุ่มและแบบฟอร์มเพิ่มผู้ใช้ใหม่ (Add User Modal)",
    ],
    expectedResult: "ตารางแสดงรายชื่อบัญชีผู้ใช้ครบถ้วน สามารถค้นหาและกรองสถานะ Active/Suspended ได้รวดเร็วแม่นยำ พร้อมเข้าถึงหน้าต่างเพิ่มผู้ใช้ได้",
    keySelectors: [
      "#user-search, input[placeholder*='ค้นหา'] (ช่องค้นหาผู้ใช้)",
      "table, [data-testid='users-list'] (ตารางรายชื่อผู้ใช้งาน)",
      ".user-card, tr[data-user-id] (แถวข้อมูลผู้ใช้งาน)",
      "button:has-text('เพิ่มผู้ใช้') (ปุ่มเปิด Modal สร้างผู้ใช้ใหม่)",
    ],
  },

  "FN-STS-03": {
    id: "FN-STS-03",
    code: "FN-STS-03",
    name: "ข้อมูลนักเรียนและห้องเรียน (Students & Classrooms)",
    role: "ครูประจำชั้น / ครูผู้สอน / ผู้บริหารสถานศึกษา",
    workflow: "เปิดหน้า /students → ตรวจสอบการ์ดนักเรียนรายห้อง → ค้นหาชื่อนักเรียนภาษาไทย → เปิด Modal โปรไฟล์ประวัติส่วนตัว",
    overview: "ทดสอบการจัดการและแสดงผลข้อมูลนักเรียนประจำชั้น การแสดงผลการ์ดรายชื่อนักเรียน ค้นหานักเรียนด้วยชื่อ-นามสกุลภาษาไทย และการเรียกดูรายละเอียดประวัตินักเรียนรายบุคคล",
    codeExplanation: "โค้ดทำการสั่ง Browser เปิดไปที่ `/students` และใช้ `locator(\"[data-testid='student-card']\")` เพื่อเช็คว่ามีการ์ดหรือแถวนักเรียนแสดงผลใน DOM จากนั้นใช้คำสั่งกรอกชื่อนักเรียนภาษาไทยลงในช่อง Search และตรวจสอบว่าระบบตอบสนองโดยไม่เกิดข้อผิดพลาดในการเรนเดอร์ข้อมูล",
    steps: [
      "1. สั่ง Browser นำทางไปยังหน้าทำเนียบนักเรียน (/students)",
      "2. ตรวจสอบว่าหน้าจอแสดงหัวข้อห้องเรียนและการ์ดรายชื่อนักเรียน",
      "3. ระบุช่องค้นหานักเรียน (Student Search Box) และตรวจสอบความพร้อมใช้งาน",
      "4. จำลองการพิมพ์ค้นหาชื่อนักเรียนภาษาไทย เช่น 'กิตติพงษ์'",
      "5. ตรวจสอบว่าผลลัพธ์การค้นหาอัปเดตตามคำค้นอย่างถูกต้อง",
      "6. ทดสอบคลิกที่ตัวนักเรียนเพื่อเปิดหน้าต่างดูประวัติรายบุคคล (Student Profile Modal)",
    ],
    expectedResult: "หน้ารายชื่อนักเรียนโหลดข้อมูลได้สมบูรณ์ ค้นหาชื่อนักเรียนได้ตรงเป้าหมาย และสามารถเปิดดูข้อมูลประวัติส่วนตัวนักเรียนได้",
    keySelectors: [
      "[data-testid='student-card'], .student-item (การ์ดแสดงข้อมูลนักเรียน)",
      "input[placeholder*='ค้นหา'], input[type='search'] (ช่องค้นหารายชื่อ)",
      "table tbody tr[data-student-id] (แถวรายชื่อนักเรียนในตาราง)",
      "[data-testid='student-profile-modal'] (หน้าต่างแสดงประวัตินักเรียน)",
    ],
  },

  "FN-STS-04": {
    id: "FN-STS-04",
    code: "FN-STS-04",
    name: "ระบบเช็คชื่อเข้าเรียน (Attendance)",
    role: "ครูประจำชั้น / ครูเวรประจำวัน",
    workflow: "เข้าสู่ /attendance → ตรวจสอบการ์ดสรุปยอด มา/ขาด/ลา/มาสาย → ตรวจสอบ Date Picker/ห้องเรียน → บันทึกสถานะเช็คชื่อ",
    overview: "ทดสอบระบบการบันทึกเวลาและการเข้าเรียนประจำวันของนักเรียน ตรวจสอบการสรุปยอดสถิติประจำวันแบบเรียลไทม์ การเลือกวันที่ย้อนหลัง และการบันทึกสถานะ มา, ขาด, ลา, มาสาย",
    codeExplanation: "โค้ดจะเข้าสู่ `/attendance` ตรวจสอบความถูกต้องของ URL และตรวจสอบการ์ดสถิติสรุปยอดรวมด้วย locator `[data-testid='attendance-summary']` จากนั้นตรวจเช็คตารางเช็คชื่อนักเรียน และตรวจสอบว่าตัวเลือกวันที่ (Date Picker) และตัวเลือกห้องเรียนพร้อมใช้งาน",
    steps: [
      "1. นำทางไปยังหน้าจอเช็คชื่อการเข้าเรียนประจำวัน (/attendance)",
      "2. ตรวจสอบแถบการ์ดสถิติสรุปประจำวัน (ยอดมา, ยอดขาด, ยอดลา, ยอดมาสาย)",
      "3. ตรวจสอบตัวเลือกวันที่ (Date Picker) ว่าสามารถเลือกวันทำการที่ต้องการเช็คชื่อได้",
      "4. ตรวจสอบการเลือกห้องเรียนหรือระดับชั้นของครูประจำชั้น",
      "5. ตรวจสอบตารางรายชื่อนักเรียนพร้อมปุ่มบันทึกสถานะ (มา/ขาด/ลา/สาย) ในแต่ละแถว",
      "6. ตรวจสอบปุ่มบันทึกข้อมูลการเช็คชื่อเข้าเรียนของทั้งห้องเรียน",
    ],
    expectedResult: "หน้าจอเช็คชื่อแสดงยอดสรุปได้ถูกต้อง รายชื่อนักเรียนแสดงครบถ้วน และปุ่มเลือกสถานะการเข้าเรียนทำงานได้สมบูรณ์",
    keySelectors: [
      "[data-testid='attendance-summary'], .stat-card (การ์ดสรุปยอดการเข้าเรียน)",
      "input[type='date'] (ตัวเลือกวันที่เช็คชื่อ)",
      "select[name*='classroom'] (เมนูเลือกห้องเรียน)",
      "table tbody tr, [data-testid='attendance-row'] (แถวนักเรียนสำหรับเช็คชื่อ)",
    ],
  },

  "FN-STS-05": {
    id: "FN-STS-05",
    code: "FN-STS-05",
    name: "ระบบจัดการเคสปัญหา (Student Cases)",
    role: "ครูประจำชั้น / ครูแนะแนว / ฝ่ายปกครอง",
    workflow: "เปิด /cases → ตรวจสอบตารางเคสและระดับความเสี่ยง → คลิก 'สร้างเคส' → ตรวจสอบฟอร์มส่งต่อเคส /cases/create",
    overview: "ทดสอบระบบดูแลช่วยเหลือนักเรียนและจัดการเคสปัญหา ตรวจสอบการจัดกลุ่มระดับความเสี่ยง (เสี่ยงสูง/ปานกลาง/น้อย) การเปิดแบบฟอร์มส่งต่อเคสใหม่ และการบันทึกข้อมูลปัญหาของนักเรียน",
    codeExplanation: "โค้ดเข้าสู่หน้ารายการเคส `/cases` ตรวจสอบว่ามีปุ่ม 'สร้างเคส' แสดงผลอยู่ จากนั้นสั่งคลิกปุ่มเพื่อทดสอบการนำทางไปยังหน้าสร้างเคส `/cases/create` และตรวจสอบว่ามีช่อง Input, Textarea สำหรับกรอกรายละเอียดปัญหา และตัวเลือกประเภทเคสพร้อมใช้งาน",
    steps: [
      "1. เข้าสู่หน้ารายการเคสปัญหาของนักเรียน (/cases)",
      "2. ตรวจสอบตารางแสดงรายการเคสพร้อมป้ายระดับความเสี่ยง (Risk Badges)",
      "3. ค้นหาและตรวจสอบปุ่มสร้างเคสใหม่ (New Case Button)",
      "4. คลิกปุ่มสร้างเคสเพื่อทดสอบการเปลี่ยนเส้นทางไปยังหน้า /cases/create",
      "5. ตรวจสอบฟิลด์กรอกข้อมูลสำคัญ: หัวข้อปัญหา, รายละเอียดเคส, ประเภทความช่วยเหลือ",
      "6. ตรวจสอบปุ่มยืนยันการส่งต่อเคสปัญหาเข้าสู่ระบบ",
    ],
    expectedResult: "สามารถเปิดดูรายการเคสที่มีอยู่ได้อย่างถูกต้อง ตรวจสอบระดับความเสี่ยงได้ชัดเจน และเข้าสู่หน้าแบบฟอร์มบันทึกเคสใหม่ได้",
    keySelectors: [
      "a[href*='/cases/create'], button:has-text('สร้างเคส') (ปุ่มสร้างเคสใหม่)",
      "[data-testid='case-card'], .case-item (รายการเคสปัญหา)",
      ".risk-badge (ป้ายบอกระดับความเสี่ยงของเคส)",
      "textarea, select[name*='category'] (ฟิลด์กรอกรายละเอียดเคส)",
    ],
  },

  "FN-STS-06": {
    id: "FN-STS-06",
    code: "FN-STS-06",
    name: "ระบบรายงานสรุปและการส่งออก (Reports & Export)",
    role: "ผู้อำนวยการ / ผู้บริหารสถานศึกษา / หัวหน้าฝ่ายสถิติ",
    workflow: "เปิดหน้า /reports → เลือกประเภทรายงาน → กำหนดช่วงเวลา/เงื่อนไข → พรีวิวข้อมูล → ตรวจสอบปุ่ม Export Excel/PDF",
    overview: "ทดสอบระบบ Report Studio สำหรับออกรายงานทางสถิติของโรงเรียน ตรวจสอบการเลือกประเภทรายงาน การกำหนดช่วงวันที่ การสร้างพรีวิวตารางข้อมูล และปุ่มดาวน์โหลดไฟล์รายงาน Excel และ PDF",
    codeExplanation: "โค้ดจะนำทางไปที่ `/reports` ตรวจสอบ Dropdown เลือกประเภทรายงานด้วย `locator(\"select[name*='type']\")` จากนั้นตรวจเช็คปุ่มสร้างรายงาน (Generate Report) ว่าอยู่ในสถานะ Enabled พร้อมคลิก และตรวจสอบว่ามีปุ่มดาวน์โหลดไฟล์ Excel (.xlsx) ปรากฏให้ผู้บริหารดาวน์โหลดจริง",
    steps: [
      "1. นำทางเข้าสู่หน้าจอรายงานและสถิติ (/reports)",
      "2. ตรวจสอบ Dropdown หรือตัวเลือกประเภทรายงาน (เช่น รายงานการเข้าเรียน, รายงานเคสความเสี่ยง)",
      "3. ตรวจสอบตัวกำหนดเงื่อนไขและช่วงเวลา (วันที่เริ่มต้น - สิ้นสุด)",
      "4. ตรวจสอบความพร้อมของปุ่มสร้างพรีวิวรายงาน (Generate / Preview Button)",
      "5. ตรวจสอบปุ่มดาวน์โหลดและส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)",
      "6. ตรวจสอบลิงก์หรือปุ่มส่งออกรายงานในรูปแบบเอกสาร PDF",
    ],
    expectedResult: "สามารถเลือกประเภทรายงาน กำหนดช่วงเวลา และมีปุ่มคำสั่ง Export ข้อมูลทั้ง Excel และ PDF พร้อมส่งออกข้อมูลได้อย่างถูกต้อง",
    keySelectors: [
      "select[name*='type'], #report-type (ตัวเลือกประเภทรายงาน)",
      "button:has-text('สร้างรายงาน'), button:has-text('Generate') (ปุ่มสร้างรายงาน)",
      "button:has-text('Excel'), a:has-text('Excel') (ปุ่มดาวน์โหลด Excel)",
      "button:has-text('PDF'), a[href*='.pdf'] (ปุ่มดาวน์โหลด PDF)",
    ],
  },

  "FN-STS-07": {
    id: "FN-STS-07",
    code: "FN-STS-07",
    name: "บันทึกพฤติกรรมและการติดตาม (Observations & Tracking)",
    role: "ครูประจำชั้น / ครูแนะแนว / เจ้าหน้าที่ลงพื้นที่เยี่ยมบ้าน",
    workflow: "เข้าสู่ /observations → ตรวจสอบการ์ดติดตามนักเรียน → กรองตามระดับความเสี่ยง → ตรวจสอบแผนที่พิกัดบ้าน",
    overview: "ทดสอบระบบการสังเกตพฤติกรรมนักเรียนและการติดตามเยี่ยมบ้าน ตรวจสอบการแสดงผลการ์ดบันทึกพฤติกรรม การคัดกรองนักเรียนตามระดับความเสี่ยง และการแสดงแผนที่พิกัดบ้านของนักเรียน",
    codeExplanation: "โค้ดจะไปยัง `/observations` หรือ `/tracking` ตรวจสอบความถูกต้องของเส้นทาง URL และเช็คการโหลดของการ์ดติดตามพฤติกรรมด้วย `locator(\"[data-testid='tracking-item']\")` พร้อมทดสอบ Dropdown กรองระดับความเสี่ยงว่าสามารถเลือกดูเฉพาะกลุ่มเสี่ยงสูงได้",
    steps: [
      "1. นำทางไปยังหน้าจอติดตามพฤติกรรมและการเยี่ยมบ้าน (/observations)",
      "2. ตรวจสอบการแสดงผลการ์ดบันทึกประวัติการสังเกตพฤติกรรมของนักเรียน",
      "3. ตรวจเช็คตัวกรองระดับความเสี่ยง (เสี่ยงสูง / เสี่ยงปานกลาง / ปกติ)",
      "4. ทดสอบเลือกกรองเฉพาะกลุ่มความเสี่ยงสูงเพื่อดูรายการที่ต้องช่วยเหลือด่วน",
      "5. ตรวจสอบส่วนแสดงผลแผนที่พิกัดตำแหน่งบ้านนักเรียน (ถ้ามี)",
      "6. ตรวจสอบปุ่มบันทึกการติดตามหรือการอัปเดตผลการเยี่ยมบ้าน",
    ],
    expectedResult: "หน้าระบบติดตามพฤติกรรมโหลดข้อมูลได้ครบถ้วน สามารถคัดกรองนักเรียนตามระดับความเสี่ยงได้แม่นยำ และพร้อมบันทึกผลการติดตาม",
    keySelectors: [
      "[data-testid='tracking-item'], .observation-card (การ์ดติดตามพฤติกรรม)",
      "select[name*='risk'], button:has-text('ความเสี่ยง') (ตัวกรองระดับความเสี่ยง)",
      ".leaflet-container, [data-testid='map-view'] (วิดเจ็ตแผนที่พิกัดบ้าน)",
      "button:has-text('บันทึกผลการติดตาม') (ปุ่มบันทึกผลการเยี่ยมบ้าน)",
    ],
  },

  "FN-STS-08": {
    id: "FN-STS-08",
    code: "FN-STS-08",
    name: "แดชบอร์ดตามบทบาทผู้ใช้ (Dashboard Navigation)",
    role: "ผู้ใช้งานทุกบทบาท (ครู, ผู้บริหาร, เจ้าหน้าที่, แอดมิน)",
    workflow: "เปิดหน้า /dashboard → ตรวจสอบหัวข้อแดชบอร์ด → ตรวจสอบการ์ด KPI สถิติสำคัญ → ตรวจสอบแถบเมนูนำทาง (Navigation/Sidebar)",
    overview: "ทดสอบหน้าจอแดชบอร์ดหลักที่ปรับแต่งตามบทบาทของผู้ใช้งาน ตรวจสอบการโหลดข้อมูลสถิติประจำวัน การ์ดสรุปตัวชี้วัด (KPI Cards) วิดเจ็ตแจ้งเตือนด่วน และความถูกต้องของเมนูแถบนำทาง",
    codeExplanation: "โค้ดจะนำทางไปที่ `/dashboard` ตรวจสอบ Heading หลักของหน้าจอด้วย `locator(\"h1, h2\")` จากนั้นตรวจเช็คว่ามีการ์ด KPI แสดงผลอย่างน้อย 1 รายการ และตรวจสอบแถบเมนู Sidebar / Navigation bar เพื่อให้แน่ใจว่าผู้ใช้สามารถคลิกนำทางไปยังส่วนต่างๆ ของระบบได้",
    steps: [
      "1. นำทางไปยังหน้าจอแดชบอร์ดหลักของผู้ใช้งาน (/dashboard)",
      "2. ตรวจสอบหัวข้อหลักของหน้าจอและชื่อบทบาทของผู้ใช้งานปัจจุบัน",
      "3. ตรวจเช็คการ์ดตัวชี้วัด KPI สรุปสถิติประจำวัน (เช่น ยอดมาเรียน, เคสค้าง, จำนวนนักเรียน)",
      "4. ตรวจสอบแถบเมนูนำทางหลัก (Sidebar / Navigation Menu)",
      "5. ทดสอบการแสดงผลลิงก์ทางลัด (Quick Action Links) เข้าสู่โมดูลสำคัญ",
    ],
    expectedResult: "แดชบอร์ดโหลดข้อมูล KPI สถิติสำคัญขึ้นมาครบถ้วน เมนูนำทางแสดงผลสมบูรณ์และสามารถกดเพื่อเปลี่ยนหน้าการทำงานได้ลื่นไหล",
    keySelectors: [
      "h1, h2, [data-testid='dashboard-header'] (หัวข้อหลักแดชบอร์ด)",
      ".kpi-card, [data-testid='kpi-card'] (การ์ดแสดงตัวชี้วัดสถิติ)",
      "nav, aside, [role='navigation'] (แถบเมนูนำทาง Sidebar)",
      "[data-testid='quick-link'], .action-card (ปุ่มทางลัดเข้าสู่ระบบย่อย)",
    ],
  },

  "FN-STS-09": {
    id: "FN-STS-09",
    code: "FN-STS-09",
    name: "ระบบวิเคราะห์ AI (AI Insights & Benchmark)",
    role: "ผู้ดูแลระบบแพลตฟอร์ม / ผู้เชี่ยวชาญด้านข้อมูล / ผู้บริหาร",
    workflow: "เข้าสู่ /admin/ai-evaluation → ตรวจสอบการ์ด Benchmark → กรอก Run ID → สั่งเริ่มประเมิน → ตรวจสอบค่า F1 Macro / Accuracy",
    overview: "ทดสอบระบบประเมินผลโมเดลปัญญาประดิษฐ์ (AI Evaluation Studio) ตรวจสอบการส่งรหัสทดสอบ Benchmark Run ID, การรันการประเมิน 5-Fold Cross Validation และการแสดงผลค่าความแม่นยำทางสถิติ (F1-Score, Precision, Recall)",
    codeExplanation: "โค้ดจะเข้าสู่ `/admin/ai-evaluation` ตรวจสอบส่วนหัวของหน้าจอ จากนั้นค้นหาช่อง Input สำหรับระบุรหัส Run ID และปุ่มคำสั่งเริ่มประเมิน Benchmark ด้วยคำสั่ง `.isVisible()` เพื่อให้มั่นใจว่าระบบพร้อมสำหรับให้นักวิเคราะห์ข้อมูลทดสอบโมเดล AI",
    steps: [
      "1. นำทางเข้าสู่หน้าจอประเมินผลโมเดล AI (/admin/ai-evaluation)",
      "2. ตรวจสอบหัวข้อหน้าจอและชุดควบคุมการรัน Benchmark",
      "3. ระบุช่องกรอกรหัสการประเมิน (Benchmark Run ID Input)",
      "4. ตรวจสอบความพร้อมของปุ่มสั่งเริ่มการประเมินโมเดล (Run Benchmark Button)",
      "5. ตรวจสอบส่วนแสดงผลค่าสถิติความแม่นยำ F1-Score Macro และค่า Accuracy",
    ],
    expectedResult: "หน้าจอประเมินผล AI พร้อมทำงาน มีช่องกรอก Run ID และปุ่มสั่งประเมินผลเปิดใช้งานอย่างถูกต้อง",
    keySelectors: [
      "input[placeholder*='Run ID'], input[name='runId'] (ช่องกรอก Run ID)",
      "button:has-text('เริ่มการประเมิน'), button:has-text('Benchmark') (ปุ่มเริ่มประเมินผล AI)",
      ".metric-benchmark, [data-testid='benchmark-metrics'] (ส่วนแสดงผลค่าสถิติ)",
      "[data-testid='f1-score'], .f1-score-badge (ป้ายคะแนน F1-Score)",
    ],
  },

  "FN-STS-10": {
    id: "FN-STS-10",
    code: "FN-STS-10",
    name: "แดชบอร์ดระดับเขตและจังหวัด (Platform & Province)",
    role: "เจ้าหน้าที่เขตพื้นที่การศึกษา / ผู้ว่าราชการจังหวัด / ผู้บริหารระดับเขต",
    workflow: "เปิดหน้า /province/dashboard → ตรวจสอบชื่อจังหวัด/เขต → ตรวจสอบการ์ดสถิติรวม → เข้าหน้า /province/reports → ตรวจสอบการรักษา Privacy (ห้ามหลุด PII)",
    overview: "ทดสอบแดชบอร์ดภาพรวมระดับเขตพื้นที่และจังหวัด ตรวจสอบการแสดงข้อมูลเปรียบเทียบสถิติระหว่างสถานศึกษาในสังกัด และตรวจสอบมาตรการคุ้มครองความเป็นส่วนตัวของข้อมูลส่วนบุคคล (ห้ามแสดงเลขบัตรประชาชนรายบุคคล)",
    codeExplanation: "โค้ดจะไปยัง `/province/dashboard` ตรวจสอบชื่อจังหวัดและการ์ดสถิติรวมสถานศึกษา จากนั้นสลับไปยัง `/province/reports` และใช้ assertion `not.toContainText(/เลขประจำตัวประชาชน/i)` เพื่อยืนยันว่าแดชบอร์ดระดับเขตจะไม่นำข้อมูลส่วนบุคคลรายบุคคลมาเปิดเผยโดยไม่จำเป็น",
    steps: [
      "1. นำทางไปยังหน้าจอแดชบอร์ดระดับจังหวัด (/province/dashboard)",
      "2. ตรวจสอบการแสดงผลชื่อจังหวัดหรือเขตพื้นที่การศึกษา",
      "3. ตรวจเช็คการ์ดสถิติภาพรวมรวมของสถานศึกษาทุกแห่งในสังกัด",
      "4. เข้าสู่หน้าจอรายงานระดับจังหวัด (/province/reports)",
      "5. ตรวจสอบนโยบายความปลอดภัยข้อมูลส่วนบุคคล (PII Protection): ต้องไม่มีเลขบัตรประชาชนรายบุคคลแสดงผล",
    ],
    expectedResult: "แดชบอร์ดระดับจังหวัดแสดงข้อมูลสรุปภาพรวมครบถ้วน และปฏิบัติตามมาตรฐานการคุ้มครองข้อมูลส่วนบุคคลอย่างเข้มงวด",
    keySelectors: [
      "h1, h2, [data-testid='province-name'] (ชื่อจังหวัดหรือเขตพื้นที่)",
      ".stat-card, [data-testid='summary-card'] (การ์ดสถิติรวมระดับเขต)",
      "table.schools-summary (ตารางเปรียบเทียบระหว่างสถานศึกษา)",
      "[data-testid='province-filter'] (ตัวกรองอำเภอ/เขตพื้นที่)",
    ],
  },

  "FN-STS-11": {
    id: "FN-STS-11",
    code: "FN-STS-11",
    name: "โปรไฟล์ส่วนตัวและการเปลี่ยนรหัสผ่าน (Profile & Password)",
    role: "ผู้ใช้งานทุกคนในระบบทุกบทบาท",
    workflow: "เปิดหน้า /change-password → ตรวจสอบฟิลด์รหัสผ่านเดิม/ใหม่/ยืนยัน → ตรวจสอบ Password Policy Checklist → ตรวจสอบปุ่มบันทึก",
    overview: "ทดสอบหน้าจอตั้งค่าข้อมูลส่วนตัวและการเปลี่ยนรหัสผ่าน ตรวจสอบการแสดงผลช่องกรอกรหัสผ่านเดิม รหัสผ่านใหม่ และช่องยืนยันรหัสผ่าน รวมถึงการตรวจสอบเงื่อนไขความปลอดภัยของรหัสผ่านใหม่",
    codeExplanation: "โค้ดจะนำทางไปที่ `/change-password` หรือ `/profile` จากนั้นค้นหาช่องกรอกรหัสผ่านเดิม `#oldPassword`, ช่องกรอกรหัสผ่านใหม่ `#newPassword`, และช่องยืนยันรหัสผ่าน `#confirmPassword` พร้อมทั้งตรวจสอบว่าปุ่มบันทึกรหัสผ่านใหม่แสดงผลและพร้อมให้ผู้ใช้ส่งข้อมูล",
    steps: [
      "1. นำทางเข้าสู่หน้าจอเปลี่ยนรหัสผ่าน (/change-password หรือ /profile)",
      "2. ระบุและตรวจสอบช่องกรอกรหัสผ่านปัจจุบัน (#oldPassword)",
      "3. ระบุและตรวจสอบช่องกรอกรหัสผ่านใหม่ (#newPassword)",
      "4. ระบุและตรวจสอบช่องยืนยันรหัสผ่านใหม่อีกครั้ง (#confirmPassword)",
      "5. ตรวจสอบข้อกำหนดความปลอดภัยของรหัสผ่าน (ความยาวขั้นต่ำ, อักขระพิเศษ, ตัวพิมพ์ใหญ่)",
      "6. ตรวจสอบความพร้อมของปุ่มบันทึกรหัสผ่านใหม่ (Submit Button)",
    ],
    expectedResult: "หน้าเปลี่ยนรหัสผ่านแสดงฟิลด์ครบถ้วน ตรวจสอบเงื่อนไขความปลอดภัยของรหัสผ่านได้ถูกต้อง และปุ่มบันทึกพร้อมใช้งาน",
    keySelectors: [
      "#oldPassword, input[name='oldPassword'] (ช่องกรอกรหัสผ่านเดิม)",
      "#newPassword, input[name='newPassword'] (ช่องกรอกรหัสผ่านใหม่)",
      "#confirmPassword, input[name='confirmPassword'] (ช่องยืนยันรหัสผ่านใหม่)",
      "button[type='submit'], #change-password-submit (ปุ่มบันทึกรหัสผ่าน)",
    ],
  },
};

/**
 * Resolves comprehensive Thai documentation for any STS function by ID, code, or keyword
 */
export function getFunctionDetailedDoc(functionIdOrText: string): FunctionDetailedDoc | undefined {
  if (!functionIdOrText) return undefined;
  const upper = functionIdOrText.toUpperCase().trim();

  // Direct match by key
  for (const [key, doc] of Object.entries(FUNCTION_DETAILED_DOCS)) {
    if (upper === key || upper.includes(key) || key.includes(upper)) {
      return doc;
    }
  }

  // Specific sub-cases for Authentication parts (Checked first to isolate specific part)
  if (
    upper.includes("INVALID") ||
    upper.includes("AUTH-INVALID") ||
    upper.includes("รหัสผ่านผิด") ||
    upper.includes("รหัสผิด")
  ) {
    return FUNCTION_DETAILED_DOCS["FN-STS-01-INVALID"];
  }
  if (
    upper.includes("EMPTY") ||
    upper.includes("AUTH-EMPTY") ||
    upper.includes("เว้นว่าง")
  ) {
    return FUNCTION_DETAILED_DOCS["FN-STS-01-EMPTY"];
  }
  if (
    upper.includes("AUTH-ROLE") ||
    upper.includes("SUCCEEDS") ||
    upper.includes("AUTH-TEACHER") ||
    upper.includes("AUTH-DIRECTOR") ||
    upper.includes("AUTH-ADMIN") ||
    upper.includes("AUTH-OFFICER") ||
    upper.includes("LOGIN AS")
  ) {
    return FUNCTION_DETAILED_DOCS["FN-STS-01-ROLES"];
  }

  // Keyword-based fallback
  if (upper.includes("AUTH") || upper.includes("LOGIN") || upper.includes("01-AUTH")) return FUNCTION_DETAILED_DOCS["FN-STS-01"];
  if (upper.includes("USER") || upper.includes("08-USER") || upper.includes("จัดการผู้ใช้")) return FUNCTION_DETAILED_DOCS["FN-STS-02"];
  if (upper.includes("STU") || upper.includes("03-STUDENT") || upper.includes("นักเรียน")) return FUNCTION_DETAILED_DOCS["FN-STS-03"];
  if (upper.includes("ATT") || upper.includes("04-ATTENDANCE") || upper.includes("เช็คชื่อ")) return FUNCTION_DETAILED_DOCS["FN-STS-04"];
  if (upper.includes("CASE") || upper.includes("05-CASE") || upper.includes("เคส")) return FUNCTION_DETAILED_DOCS["FN-STS-05"];
  if (upper.includes("REP") || upper.includes("06-REPORT") || upper.includes("รายงาน")) return FUNCTION_DETAILED_DOCS["FN-STS-06"];
  if (upper.includes("TRK") || upper.includes("07-OBSERVATION") || upper.includes("TRACKING") || upper.includes("พฤติกรรม")) return FUNCTION_DETAILED_DOCS["FN-STS-07"];
  if (upper.includes("DASH") || upper.includes("02-DASHBOARD") || upper.includes("แดชบอร์ด")) return FUNCTION_DETAILED_DOCS["FN-STS-08"];
  if (upper.includes("AI") || upper.includes("11-AI") || upper.includes("BENCHMARK")) return FUNCTION_DETAILED_DOCS["FN-STS-09"];
  if (upper.includes("PRV") || upper.includes("09-PROVINCE") || upper.includes("เขต") || upper.includes("จังหวัด")) return FUNCTION_DETAILED_DOCS["FN-STS-10"];
  if (upper.includes("PWD") || upper.includes("10-PROFILE") || upper.includes("PASSWORD") || upper.includes("รหัสผ่าน")) return FUNCTION_DETAILED_DOCS["FN-STS-11"];

  return undefined;
}
