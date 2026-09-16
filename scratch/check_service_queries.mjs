import fs from 'fs';

const services = [
    'services/abastecimentoService.ts',
    'services/diariasService.ts',
    'services/comprasService.ts',
    'services/noticiasService.ts',
    'services/fleetService.ts',
    'services/farmaciaService.ts'
];

for (const s of services) {
    const content = fs.readFileSync(s, 'utf8');
    console.log(`\n=== ${s} ===`);
    const lines = content.split('\n');
    lines.forEach((l, i) => {
        if (l.includes('.select(') || l.includes('.range(') || l.includes('.limit(')) {
            console.log(`L${i+1}: ${l.trim()}`);
        }
    });
}
