import fs from 'fs';

const content = fs.readFileSync('components/diarias/LancamentosScreen.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('.from(') || line.includes('supabase') || line.includes('ultimo_checkpoint')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
