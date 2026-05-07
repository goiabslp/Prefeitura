const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

// Use simple string replacements and regexes where appropriate
content = content.replace(/import { useLicitacaoProcesses } from '\.\/hooks\/useLicitacao';\n?/g, '');
content = content.replace(/import { LicitacaoScreeningScreen } from '\.\/components\/LicitacaoScreeningScreen';\n?/g, '');
content = content.replace(/import { LicitacaoSettingsModal } from '\.\/components\/LicitacaoSettingsModal';\n?/g, '');

content = content.replace(/\s*\| 'licitacao-new'/g, '');

content = content.replace(/if \(cv === 'editor' \|\| cv === 'licitacao-new'\) return true;/g, "if (cv === 'editor') return true;");

// find "fetchLicitacao" and remove its definition and usage
content = content.replace(/const fetchLicitacao = !scope \|\| scope === 'licitacao';\n?/g, '');

content = content.replace(/\s*if\s*\(fetchLicitacao\)\s*\{[\s\S]*?if\s*\(nextLicParams\)\s*setLicitacaoNextProtocol\(nextLicParams\);\n\s*\}\n/g, '');

content = content.replace(/let savedLicitacaoProcesses = licitacaoProcesses;\n?/g, '');
content = content.replace(/promises\.push\(licitacaoService\.getAllLicitacaoProcesses\(\)\.then\(d => { savedLicitacaoProcesses = d; }\)\);\n?/g, '');
content = content.replace(/if \(fetchLicitacao \|\| fetchTransactions\) setLicitacaoProcesses\(savedLicitacaoProcesses\);\n?/g, '');

content = content.replace(/fetchLicitacao\s*\|\|/g, '');
content = content.replace(/\|\| fetchLicitacao/g, '');

content = content.replace(/\.\.\.savedLicitacaoProcesses,\n/g, '');

content = content.replace(/,\s*licitacaoProcesses/g, '');

content = content.replace(/else if \(activeBlock === 'licitacao'\) setLicitacaoProcesses\(p => p\.filter\(o => o\.id !== id\)\);\n?/g, '');

content = content.replace(/'licitacao': licitacaoKeys\.lists\(\),\n?/g, '');

// Clean up views logic
const viewLogicRegex1 = /\s*\} else if \(state\.view === 'licitacao-new'\) \{[\s\S]*?setActiveBlock\('licitacao'\);\n/;
content = content.replace(viewLogicRegex1, '');

const viewLogicRegex2 = /\s*\} else if \(state\.view === 'licitacao-tracking'\) \{[\s\S]*?setActiveBlock\('licitacao'\);\n/;
content = content.replace(viewLogicRegex2, '');

const viewLogicRegex3 = /\s*\} else if \(state\.view === 'licitacao-details'\) \{[\s\S]*?setActiveBlock\('licitacao'\);\n/;
content = content.replace(viewLogicRegex3, '');

const viewLogicRegex4 = /\s*else if \(state\.view === 'licitacao-screening' \|\| state\.view === 'licitacao-all'\) \{[\s\S]*?setActiveBlock\('licitacao'\);\n\s*\}/;
content = content.replace(viewLogicRegex4, '');

// Clean up keys logic
const keysLogicRegex = /\s*\/\/ Licitacao Specific Keys[\s\S]*?else if \(currentView === 'order-details' && viewingOrder\) stateKey = 'licitacao-details';\n\s*\}/;
content = content.replace(keysLogicRegex, '');

// Clean up fetching counter
const fetchCountRegex = /\s*\/\/ Fetch Licitacao Global Protocol Counter[\s\S]*?if \(nextProtocol\) setLicitacaoNextProtocol\(nextProtocol\);\n\s*\}\n\s*\}/;
content = content.replace(fetchCountRegex, '');

// Removing case 'licitacao':
const licitacaoBlockRegex = /\s*case 'licitacao':\n\s*return \(\n[\s\S]*?<\/HomeScreen>\n\s*\);/;
content = content.replace(licitacaoBlockRegex, '');

const licitacaoMenuRegex = /\s*<MenuItem\s*icon=\{Scale\}\s*title="Licitações"[\s\S]*?description="Acesso ao módulo de licitações"[\s\S]*?\/>\n?/;
content = content.replace(licitacaoMenuRegex, '');

// Removing Licitacao Modals
const modal1Regex = /\s*<LicitacaoSettingsModal[\s\S]*?onClose=\{[^}]+\}\s*\/>/;
content = content.replace(modal1Regex, '');

fs.writeFileSync('App.tsx', content);
console.log("Cleanup script part 2 ran");
