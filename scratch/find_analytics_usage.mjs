import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function searchInFiles(term) {
    const files = [];
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (['node_modules', '.git', 'dist', 'scratch', 'public'].includes(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
                const content = fs.readFileSync(full, 'utf8');
                if (content.includes(term)) {
                    files.push(path.relative(projectRoot, full));
                }
            }
        }
    }
    walk(projectRoot);
    return files;
}

console.log('Arquivos usando consultasAnalyticsService:');
console.log(searchInFiles('consultasAnalyticsService'));
