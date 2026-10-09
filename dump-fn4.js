const fs = require('fs');
const all = JSON.parse(fs.readFileSync('all-school-admin-tc.json', 'utf8'));
const targetTCs = all.filter(tc => tc.tcId.startsWith('TC-STS-03-'));
console.log('Target TCs count in Function 4:', targetTCs.length);

let out = '# ฟังก์ชัน 4: จัดการข้อมูลนักเรียนและห้องเรียน ทั้งหมด ' + targetTCs.length + ' Test Cases\n\n';
targetTCs.forEach((tc, i) => {
  out += `## [${i+1}] ${tc.tcId} : ${tc.tcDesc}\n`;
  out += `- **Scenario**: ${tc.tsId} - ${tc.tsDesc}\n`;
  out += `- **Pre-condition**:\n${tc.pre}\n`;
  out += `- **Steps**:\n${tc.step}\n`;
  out += `- **Test Data**:\n${tc.data}\n`;
  out += `- **Expected Result**:\n${tc.expected}\n`;
  out += `- **Post-condition**:\n${tc.post}\n\n`;
});

fs.writeFileSync('function-4-details.md', out, 'utf8');
console.log('Written to function-4-details.md');
