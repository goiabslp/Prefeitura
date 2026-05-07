const fs = require('fs');

// HomeScreen.tsx
let home = fs.readFileSync('components/HomeScreen.tsx', 'utf8');
home = home.replace(/\s*const canAccessLicitacaoProcessos = permissions\.includes\('parent_licitacao_processos'\);\n/g, '');
home = home.replace(/\s*case 'licitacao': return \{ name: "Módulo de Licitação", color: 'blue', icon: Gavel \};\n/g, '');
home = home.replace(/ activeBlock === 'licitacao' \? 'Novo Processo' :/g, '');
home = home.replace(/\s*if \(activeBlock !== 'licitacao'\) \{[\s\S]*?\} else if \(activeBlock !== 'diarias' && activeBlock !== 'compras'\) \{/g, '\nif (activeBlock !== \'diarias\' && activeBlock !== \'compras\') {');
home = home.replace(/\s*if \(activeBlock === 'licitacao'\) \{[\s\S]*?\}\n/g, '');
home = home.replace(/\s*\{canAccessLicitacao && renderModuleButton\(\(\) => setActiveBlock\('licitacao'\), 'blue', Gavel, 'Licitação', 'Processos', '200ms', false\)\}\n/g, '');
fs.writeFileSync('components/HomeScreen.tsx', home);

// TrackingScreen.tsx
let tracking = fs.readFileSync('components/TrackingScreen.tsx', 'utf8');
tracking = tracking.replace(/import \{ useInfiniteLicitacao \} from '\.\.\/hooks\/useLicitacao';\n/g, '');
tracking = tracking.replace(/\s*\/\/ LICITACAO[\s\S]*?\} = useInfiniteLicitacao\(20, searchTerm\);\n/g, '');
tracking = tracking.replace(/\s*const licitacaoData = React\.useMemo\(\(\) => \{[\s\S]*?\}, \[infiniteLicitacao, orders\]\);\n/g, '');
tracking = tracking.replace(/\s*const isLicitacaoUser = currentUser\.role === 'licitacao';\n/g, '');
tracking = tracking.replace(/\s*const isLicitacao = activeBlock === 'licitacao';\n/g, '');
tracking = tracking.replace(/\s*if \(activeBlock === 'licitacao'\) return licitacaoData;\n/g, '');
tracking = tracking.replace(/\s*\{activeBlock === 'licitacao' && \(order\.documentSnapshot\?\.content as any\)\?\.finalDocumentUrl && \([\s\S]*?\}\n/g, '');
fs.writeFileSync('components/TrackingScreen.tsx', tracking);

console.log("Cleanup script part 6 ran");
