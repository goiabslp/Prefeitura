import fs from 'fs';

const filePath = 'c:\\Users\\guigu\\OneDrive\\Área de Trabalho\\Apps\\Projeto- Prefeitura-01\\Prefeitura-Integrada-DataBase\\components\\abastecimento\\AbastecimentoDashboard.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('--- Resumo de renderOverview (linhas 1985 - 2291) ---');
console.log(lines.slice(1984, 2085).join('\n'));
