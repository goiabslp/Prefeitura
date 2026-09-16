import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const raw = fs.readFileSync(path.join(projectRoot, 'scratch', 'audit_report.json'), 'utf8');
const report = JSON.parse(raw);

console.log('--- 1. SELECT * POR ARQUIVO ---');
const selectStarByFile = {};
for (const item of report.selectStar) {
    selectStarByFile[item.file] = (selectStarByFile[item.file] || 0) + 1;
}
for (const [file, count] of Object.entries(selectStarByFile).sort((a,b) => b[1] - a[1])) {
    console.log(`${count.toString().padStart(2)}x: ${file}`);
}

console.log('\n--- 2. REALTIME CHANNELS POR ARQUIVO ---');
const realtimeByFile = {};
for (const item of report.realtimeChannels) {
    realtimeByFile[item.file] = (realtimeByFile[item.file] || 0) + 1;
}
for (const [file, count] of Object.entries(realtimeByFile).sort((a,b) => b[1] - a[1])) {
    console.log(`${count.toString().padStart(2)}x: ${file}`);
}

console.log('\n--- 3. SETINTERVAL / POLLING POR ARQUIVO ---');
for (const item of report.intervals) {
    console.log(`${item.file}:${item.lineNum} -> ${item.line}`);
}

console.log('\n--- 4. STORAGE CALLS ---');
for (const item of report.storageCalls) {
    console.log(`${item.file}:${item.lineNum} -> ${item.line}`);
}

console.log('\n--- 5. USEQUERY CONFIGS ---');
for (const item of report.useQueries) {
    console.log(`${item.file}:${item.lineNum} -> ${item.line}`);
}
