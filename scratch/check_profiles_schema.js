import fs from 'fs';

const buffer = fs.readFileSync('c:\\Users\\guigu\\OneDrive\\Área de Trabalho\\Apps\\Projeto- Prefeitura-01\\Prefeitura-Integrada-DataBase\\schema.json');
let content = '';
if (buffer[0] === 0xff && buffer[1] === 0xfe) {
  content = buffer.toString('utf16le');
} else {
  content = buffer.toString('utf8');
}
content = content.replace(/^\uFEFF/, '');

let data = JSON.parse(content);
if (typeof data === 'string') {
  data = JSON.parse(data);
}

const defs = data.definitions;
if (defs && defs.profiles) {
  console.log("Profiles properties:", Object.keys(defs.profiles.properties || {}));
} else {
  console.log("Profiles definitions not found. Definitions keys:", Object.keys(defs || {}));
}
