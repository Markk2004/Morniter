const fs = require('fs');
const content = fs.readFileSync('raw-school-admin.csv', 'utf8');

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

const rows = parseCSV(content);
let currentFunc = '';
const testCases = [];

rows.forEach((r, idx) => {
  if (r[0] && r[0].trim() === 'Function') {
    currentFunc = (r[1] || '').trim();
  }
  const tcId = (r[2] || '').trim();
  if (tcId.startsWith('TC-STS-')) {
    testCases.push({
      rowIndex: idx,
      func: currentFunc,
      tsId: (r[0] || '').trim(),
      tsDesc: (r[1] || '').trim(),
      tcId: tcId,
      tcDesc: (r[3] || '').trim(),
      step: (r[4] || '').trim(),
      pre: (r[5] || '').trim(),
      data: (r[6] || '').trim(),
      post: (r[7] || '').trim(),
      expected: (r[8] || '').trim()
    });
  }
});

console.log('Total Test Cases found:', testCases.length);
testCases.forEach((tc, i) => {
  console.log(`[${i+1}] ${tc.tcId} | Func: ${tc.func} | ${tc.tcDesc}`);
});

fs.writeFileSync('all-school-admin-tc.json', JSON.stringify(testCases, null, 2), 'utf8');
