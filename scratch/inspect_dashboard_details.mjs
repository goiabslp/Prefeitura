import fs from 'fs';

const filePath = 'c:\\Users\\guigu\\OneDrive\\Área de Trabalho\\Apps\\Projeto- Prefeitura-01\\Prefeitura-Integrada-DataBase\\components\\abastecimento\\AbastecimentoDashboard.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Analisando AbastecimentoDashboard ---');

// Procurar estados, filtros, cálculos e abas
lines.forEach((line, i) => {
  const lineNum = i + 1;
  if (lineNum >= 718 && lineNum <= 1600) {
    if (
      line.includes('const [') ||
      line.includes('useMemo') ||
      line.includes('useEffect') ||
      line.includes('activeTab') ||
      line.includes('tab ===') ||
      line.includes('filtered') ||
      line.includes('stats')
    ) {
      console.log(`Line ${lineNum}: ${line.trim().slice(0, 120)}`);
    }
  }
});
