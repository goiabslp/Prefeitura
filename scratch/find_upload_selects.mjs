import fs from 'fs';
const content = fs.readFileSync('components/upload/UploadHub.tsx', 'utf8');
content.split('\n').forEach((l, i) => {
    if (l.includes("select('*')")) console.log(`${i+1}: ${l}`);
});
