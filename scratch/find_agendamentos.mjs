import fs from 'fs';
const content = fs.readFileSync('services/consultasService.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
    if (l.includes('getAgendamentos')) console.log(`${i+1}: ${l}`);
});
