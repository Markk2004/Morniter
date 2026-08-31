export const TUTORIAL_STORAGE_KEY = "morniter:playwright-tutorial:v1:seen";

export const TUTORIAL_TARGET_IDS = [
  "agent",
  "execution-lock",
  "project",
  "select-test",
  "browsers",
  "code",
  "run",
  "terminal",
  "result",
] as const;

export type TutorialTargetId = (typeof TUTORIAL_TARGET_IDS)[number];

export type TutorialIconName =
  | "agent"
  | "lock"
  | "project"
  | "test"
  | "browser"
  | "code"
  | "run"
  | "terminal"
  | "result";

export type TutorialVisualKind = TutorialIconName;
export type TutorialChapter = "เตรียมระบบ" | "เลือกการทดสอบ" | "รันและตรวจผล";

export interface TutorialStep {
  id: `step-${number}`;
  targetId: TutorialTargetId;
  label: string;
  chapter: TutorialChapter;
  icon: TutorialIconName;
  visual: TutorialVisualKind;
  title: string;
  description: string;
  unavailableMessage: string;
}

export const PLAYWRIGHT_TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "step-1",
    targetId: "agent",
    label: "Agent",
    chapter: "เตรียมระบบ",
    icon: "agent",
    visual: "agent",
    title: "ตรวจสอบ Local Agent",
    description: "ดูสถานะ Online, Offline หรือ Lagging ก่อนเริ่มทดสอบ เพราะ Agent เป็นเครื่องที่อ่านไฟล์และรัน Playwright จริง (เปิดใช้งานด้วยคำสั่ง: npm run test-agent:build และ npm run test-agent ใน Terminal)",
    unavailableMessage: "สถานะ Agent จะแสดงหลังโหลด catalog สำเร็จ",
  },
  {
    id: "step-2",
    targetId: "execution-lock",
    label: "Execution Lock",
    chapter: "เตรียมระบบ",
    icon: "lock",
    visual: "lock",
    title: "ปลดล็อกการรัน Test",
    description: "ใช้รหัสกลุ่ม (Group Execution Password) เพื่ออนุญาตการรัน (Session 15 นาที) ระบบ Tutorial จะไม่กรอกรหัสหรือปลดล็อกแทน",
    unavailableMessage: "ถ้าปลดล็อกแล้ว ส่วนกรอกรหัสจะถูกซ่อน",
  },
  {
    id: "step-3",
    targetId: "project",
    label: "Project",
    chapter: "เลือกการทดสอบ",
    icon: "project",
    visual: "project",
    title: "เลือก Project",
    description: "เลือก catalog ที่ Local Agent ส่งมา เช่น STS Playwright Automation หรือ Project Monitor การเปลี่ยน Project จะรีเซ็ต test ที่เลือกไว้",
    unavailableMessage: "Project จะแสดงเมื่อ Agent ส่ง catalog สำเร็จ",
  },
  {
    id: "step-4",
    targetId: "select-test",
    label: "Select Test",
    chapter: "เลือกการทดสอบ",
    icon: "test",
    visual: "test",
    title: "เลือก Test ที่ต้องการรัน",
    description: "ค้นหา test ตามชื่อหรือหมวดหมู่ ใช้ checkbox เลือก test และคลิก Open เพื่อเปิดดู source ใน Code Workspace",
    unavailableMessage: "Test Explorer จะแสดงเมื่อ Project มี Playwright tests",
  },
  {
    id: "step-5",
    targetId: "browsers",
    label: "Browsers",
    chapter: "เลือกการทดสอบ",
    icon: "browser",
    visual: "browser",
    title: "เลือก Browser และ Run Mode",
    description: "เลือกเบราว์เซอร์เป้าหมาย (Google Chrome, Firefox, WebKit) และเลือกระหว่าง Headless หรือ Headed",
    unavailableMessage: "Browser controls จะแสดงหลังเลือก Project",
  },
  {
    id: "step-6",
    targetId: "code",
    label: "Code",
    chapter: "เลือกการทดสอบ",
    icon: "code",
    visual: "code",
    title: "ตรวจ Source ก่อนรัน",
    description: "ดู source ของ test ที่เลือก หรือเขียน draft code ใน Code Workspace พร้อมปุ่ม Reset คืนค่าร่างเริ่มต้น",
    unavailableMessage: "Code Workspace จะแสดงหลัง workspace โหลดเสร็จ",
  },
  {
    id: "step-7",
    targetId: "run",
    label: "Run",
    chapter: "รันและตรวจผล",
    icon: "run",
    visual: "run",
    title: "เริ่มหรือยกเลิกการทดสอบ",
    description: "ปุ่ม Run จะพร้อมใช้งานเมื่อ Agent Online, ปลดล็อกรหัสแล้ว และเลือก test แล้ว สามารถกด Cancel เพื่อยกเลิกระหว่างรันได้",
    unavailableMessage: "Execution controls จะแสดงหลัง workspace โหลดเสร็จ",
  },
  {
    id: "step-8",
    targetId: "terminal",
    label: "Terminal",
    chapter: "รันและตรวจผล",
    icon: "terminal",
    visual: "terminal",
    title: "อ่าน Log แบบ Realtime",
    description: "Terminal แสดง system, stdout และ stderr ตาม sequence แบบ Realtime พร้อมระบบ Auto-scroll",
    unavailableMessage: "Terminal จะแสดงแม้ยังไม่มี log และจะอัปเดตเมื่อเริ่ม job",
  },
  {
    id: "step-9",
    targetId: "result",
    label: "Result",
    chapter: "รันและตรวจผล",
    icon: "result",
    visual: "result",
    title: "ตรวจ Result และประวัติ",
    description: "ดูผลลัพธ์แยกตาม Browser (Passed, Failed, Duration), ดาวน์โหลด Artifacts (Traces, Screenshots, Videos) และดู Job History",
    unavailableMessage: "Result จะแสดงหลังเริ่มหรือจบ job อย่างน้อยหนึ่งครั้ง",
  },
];
