import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\guigu\\OneDrive\\Área de Trabalho\\Apps\\Projeto- Prefeitura-01\\Prefeitura-Integrada-DataBase\\components\\UserManagementScreen.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('job') || line.toLowerCase().includes('sector') || line.toLowerCase().includes('cargo')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
