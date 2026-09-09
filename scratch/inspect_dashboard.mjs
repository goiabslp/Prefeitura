import fs from 'fs';

const filePath = 'c:\\Users\\guigu\\OneDrive\\Área de Trabalho\\Apps\\Projeto- Prefeitura-01\\Prefeitura-Integrada-DataBase\\components\\abastecimento\\AbastecimentoDashboard.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);

lines.forEach((line, i) => {
  if (line.includes('export ') || line.includes('const ') && (line.includes('Dashboard') || line.includes('Tab') || line.includes('activeTab') || line.includes('selectedTab'))) {
    if (i < 500 || line.includes('export')) {
      console.log(`Line ${i+1}: ${line.trim().slice(0, 100)}`);
    }
  }
});
