import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\guigu\\OneDrive\\Área de Trabalho\\Apps\\Projeto- Prefeitura-01\\Prefeitura-Integrada-DataBase\\App.tsx', 'utf8');
const lines = content.split('\n');

// Print lines around 709
for (let i = 690; i < 730; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
