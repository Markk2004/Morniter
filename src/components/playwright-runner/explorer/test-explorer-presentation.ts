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
