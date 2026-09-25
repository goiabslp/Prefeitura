import fs from 'fs';

const content = fs.readFileSync('components/farmacia/RetirarScreen.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('medicoCrm') || line.includes('medicoUf') || line.includes('medicoNome') || line.includes('medicoTipo') || line.includes('conselho')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
