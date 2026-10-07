const fs = require('fs');

const specCode = fs.readFileSync('e2e/sts/specs/00-school-admin-uat-all-in-one.spec.ts', 'utf8');
let templateFile = fs.readFileSync('src/lib/playwright-runner/function-templates.ts', 'utf8');

const markerStart = '  "FN-STS-00-SCHOOL-ADMIN": {';
const markerEnd = '\n  },\n};';

const startIndex = templateFile.indexOf(markerStart);
if (startIndex === -1) {
  console.error('Cannot find markerStart');
  process.exit(1);
}
const endIndex = templateFile.indexOf(markerEnd, startIndex);
if (endIndex === -1) {
  console.error('Cannot find markerEnd');
  process.exit(1);
}

// Escape backticks and ${} in specCode for template literals
const escapedCode = specCode.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

const newEntry = `  "FN-STS-00-SCHOOL-ADMIN": {
    id: "FN-STS-00-SCHOOL-ADMIN",
    name: "FN-STS-00-SCHOOL-ADMIN · [UAT ผู้ดูแลระบบโรงเรียน] TC-STS School Admin (Complete 29-TC Workflow)",
    shortName: "STS School Admin",
    relativePath: "e2e/sts/specs/00-school-admin-uat-all-in-one.spec.ts",
    description: "รันครบทุกขั้นตอนการทดสอบ UAT ของผู้ดูแลระบบโรงเรียน (School Admin) ครอบคลุม 29 Test Cases ตาม Google Sheet: เข้าสู่ระบบ (3 TCs) → แดชบอร์ด (3 TCs) → จัดการผู้ใช้งาน (10 TCs) → ข้อมูลนักเรียน/ห้องเรียน (13 TCs) → Logout",
    code: \`${escapedCode}\``;

templateFile = templateFile.slice(0, startIndex) + newEntry + templateFile.slice(endIndex);
fs.writeFileSync('src/lib/playwright-runner/function-templates.ts', templateFile, 'utf8');
console.log('Successfully updated function-templates.ts');
