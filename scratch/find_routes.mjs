import fs from 'fs';

const content = fs.readFileSync('App.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('vehicle-scheduling') || line.toLowerCase().includes('agendamentoveiculos') || line.includes('AgendamentoVeiculos')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
