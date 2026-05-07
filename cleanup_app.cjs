const fs = require('fs');

let content = fs.readFileSync('App.tsx', 'utf8');

// Remove imports
content = content.replace(/import\s+\{[^}]*licitacao[^}]*\}\s+from\s+['"][^'"]+['"];?\n?/gi, '');
content = content.replace(/import\s+\*\s+as\s+licitacaoService\s+from\s+['"][^'"]+['"];?\n?/g, '');
content = content.replace(/import\s+\{\s*LicitacaoScreeningScreen\s*\}\s+from\s+['"][^'"]+['"];?\n?/g, '');
content = content.replace(/import\s+\{\s*LicitacaoSettingsModal\s*\}\s+from\s+['"][^'"]+['"];?\n?/g, '');

// Remove licitacao states
content = content.replace(/const\s+\[licitacaoProcesses,\s+setLicitacaoProcesses\]\s*=\s*useState<Order\[\]>\(\[\]\);\n?/g, '');
content = content.replace(/const\s+\[licitacaoNextProtocol,\s+setLicitacaoNextProtocol\]\s*=\s*useState<number\s*\|\s*null>\(null\);\n?/g, '');
content = content.replace(/const\s+\[isLicitacaoSettingsOpen,\s+setIsLicitacaoSettingsOpen\]\s*=\s*useState\(false\);\n?/g, '');

// Remove mapping keys
content = content.replace(/\s*'home:licitacao':\s*'\/Licitacao',\n?/g, '');
content = content.replace(/\s*'licitacao-new':\s*'\/Licitacao\/NovoProcesso',\n?/g, '');
content = content.replace(/\s*'licitacao-tracking':\s*'\/Licitacao\/MeusProcessos',\n?/g, '');
content = content.replace(/\s*'licitacao-screening':\s*'\/Licitacao\/Triagem',\n?/g, '');
content = content.replace(/\s*'licitacao-all':\s*'\/Licitacao\/Processos',\n?/g, '');
content = content.replace(/\s*'licitacao-details':\s*'\/Licitacao\/MeusProcessos\/Visualizar',\n?/g, '');

// Remove from views union
content = content.replace(/\|\s*'licitacao-screening'\s*\|\s*'licitacao-all'\s*/g, '');

// Clean up some other licitacao parts. I'll just write it back first.
fs.writeFileSync('App.tsx', content);
console.log("Cleanup script part 1 ran");
