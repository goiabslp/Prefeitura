import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'scratch', 'public']);

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(getAllFiles(fullPath, exts));
        } else if (exts.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
        }
    }
    return files;
}

const files = getAllFiles(projectRoot);

const auditReport = {
    selectStar: [],
    realtimeChannels: [],
    intervals: [],
    useQueries: [],
    storageCalls: [],
    unpaginatedSelects: [],
    aggregationsInJs: []
};

for (const file of files) {
    const relPath = path.relative(projectRoot, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        // 1. Select *
        if (line.includes("select('*')") || line.includes('select("*")') || line.includes("select(' * ')")) {
            auditReport.selectStar.push({ file: relPath, lineNum, line: line.trim() });
        }

        // 2. Realtime
        if (line.includes('.channel(') || line.includes('supabase.channel(')) {
            auditReport.realtimeChannels.push({ file: relPath, lineNum, line: line.trim() });
        }

        // 3. setInterval / polling
        if (line.includes('setInterval(') || line.includes('refetchInterval')) {
            auditReport.intervals.push({ file: relPath, lineNum, line: line.trim() });
        }

        // 4. Storage calls
        if (line.includes('.storage.') || line.includes('storage.from(')) {
            auditReport.storageCalls.push({ file: relPath, lineNum, line: line.trim() });
        }

        // 5. useQuery options
        if (line.includes('useQuery(') || line.includes('useQuery<{') || line.includes('refetchOnMount') || line.includes('refetchOnWindowFocus')) {
            auditReport.useQueries.push({ file: relPath, lineNum, line: line.trim() });
        }
    });
}

console.log('=== RESUMO DA AUDITORIA INICIAL ===');
console.log(`Total de arquivos analisados: ${files.length}`);
console.log(`1. Ocorrências de select('*'): ${auditReport.selectStar.length}`);
console.log(`2. Canais Supabase Realtime (.channel): ${auditReport.realtimeChannels.length}`);
console.log(`3. setInterval / polling: ${auditReport.intervals.length}`);
console.log(`4. Chamadas de Supabase Storage: ${auditReport.storageCalls.length}`);
console.log(`5. Configurações / chamadas useQuery: ${auditReport.useQueries.length}`);

fs.writeFileSync(path.join(projectRoot, 'scratch', 'audit_report.json'), JSON.stringify(auditReport, null, 2), 'utf8');
console.log('\nRelatório salvo em scratch/audit_report.json com sucesso!');
