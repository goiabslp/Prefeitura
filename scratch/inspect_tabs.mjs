import fs from 'fs';

const filePath = 'c:\\Users\\guigu\\OneDrive\\Área de Trabalho\\Apps\\Projeto- Prefeitura-01\\Prefeitura-Integrada-DataBase\\components\\abastecimento\\AbastecimentoDashboard.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Buscando renders de abas ---');

lines.forEach((line, i) => {
  const lineNum = i + 1;
  if (
    line.includes('activeTab ===') ||
    line.includes('activeTab ==') ||
    line.includes('tabs.map') ||
    line.includes('setActiveTab(')
  ) {
    console.log(`Line ${lineNum}: ${line.trim().slice(0, 100)}`);
  }
});
