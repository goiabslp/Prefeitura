import fs from 'fs';

const content = fs.readFileSync('services/licitacaoService.ts', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('.from(') || line.includes('.select(')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
