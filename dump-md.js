const fs = require('fs');
const data = JSON.parse(fs.readFileSync('e:/project-monitor/school-admin-tc-parsed.json', 'utf8'));

let md = '# UAT Test Cases for School Admin from Google Sheet\n\n';
data.forEach((d, idx) => {
  md += `## [${idx+1}] ${d.tcId}: ${d.tcDesc}\n`;
  md += `- **Function**: ${d.func}\n`;
  md += `- **Scenario ID**: ${d.tsId} (${d.tsDesc})\n`;
  md += `- **Pre-Condition**: ${d.pre}\n`;
  md += `- **Test Data**: ${d.data}\n`;
  md += `- **Steps**:\n${d.step}\n`;
  md += `- **Expected Result**:\n${d.expected}\n\n`;
});

fs.writeFileSync('e:/project-monitor/school-admin-tc-details.md', md, 'utf8');
console.log('Saved to school-admin-tc-details.md');
