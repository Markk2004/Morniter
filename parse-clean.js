const fs = require('fs');
const content = fs.readFileSync('e:/project-monitor/raw-school-admin.csv', 'utf8');

function parseCSV(text) {
  const p = [];
  let row = [''];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') { i++; }
      p.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') p.push(row);
  return p;
}

const parsed = parseCSV(content);
let curFunc = '';
const out = [];

for (const r of parsed) {
  if (r[0] === 'Function') {
    curFunc = r[1];
  }
  if (r[0] && r[0].startsWith('TS-STS-')) {
    out.push({
      func: curFunc,
      tsId: r[0],
      tsDesc: r[1],
      tcId: r[2],
      tcDesc: r[3],
      step: r[4],
      pre: r[5],
      data: r[6],
      post: r[7],
      expected: r[8]
    });
  }
}

let md = '# UAT Test Cases (School Admin)\n\n';
out.forEach((d, idx) => {
  md += '## [' + (idx+1) + '] ' + d.tcId + ': ' + d.tcDesc + '\n';
  md += '- **ฟังก์ชัน**: ' + d.func + '\n';
  md += '- **Scenario**: ' + d.tsId + ' (' + d.tsDesc + ')\n';
  md += '- **ข้อมูลทดสอบ (Test Data)**: ' + (d.data || '-') + '\n';
  md += '- **ขั้นตอน (Steps)**:\n' + d.step + '\n';
  md += '- **ผลที่คาดหวัง (Expected)**:\n' + d.expected + '\n\n';
});

fs.writeFileSync('e:/project-monitor/clean-school-admin-tc.md', md, 'utf8');
console.log('Parsed successfully, count:', out.length);
