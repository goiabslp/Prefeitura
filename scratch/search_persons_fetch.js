import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\guigu\\OneDrive\\Área de Trabalho\\Apps\\Projeto- Prefeitura-01\\Prefeitura-Integrada-DataBase\\App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes("from('persons')") || line.includes('getPersons') || line.includes('.from(\'persons\')')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
