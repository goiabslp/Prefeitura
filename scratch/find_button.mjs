import fs from 'fs';

const filePath = 'c:/Users/guigu/OneDrive/Área de Trabalho/Apps/Pesquisa/app/(dashboard)/campo/[researchId]/page.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

console.log('File length:', content.length);
const idx = content.indexOf('setIsQuotaDrawerOpen(true)');
console.log('Index:', idx);
if (idx !== -1) {
  console.log('--- BEFORE AND AFTER ---');
  console.log(content.slice(idx - 350, idx + 450));
}
