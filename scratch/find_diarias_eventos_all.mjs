import fs from 'fs';
import path from 'path';

function searchInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'scratch') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchInDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes("diarias_eventos")) {
        const lines = content.split('\n');
        lines.forEach((l, i) => {
          if (l.includes("diarias_eventos")) {
            console.log(`${fullPath}:${i+1}: ${l.trim()}`);
          }
        });
      }
    }
  }
}

searchInDir('.');
