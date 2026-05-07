const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

content = content.replace(/\s*\/\/ Fetch Licitacao Specific Counter[\s\S]*?if \(nextLicParams\) setLicitacaoNextProtocol\(nextLicParams\);\n\s*\}\n\s*\}/g, '');

content = content.replace(/\s*\.\.\.savedLicitacaoProcesses,/g, '');

content = content.replace(/\s*\} else if \(state\.view === 'licitacao-new'\) \{[\s\S]*?setActiveBlock\('licitacao'\);\n/g, '');
content = content.replace(/\s*\} else if \(state\.view === 'licitacao-tracking'\) \{[\s\S]*?setActiveBlock\('licitacao'\);\n/g, '');
content = content.replace(/\s*\} else if \(state\.view === 'licitacao-details'\) \{[\s\S]*?setActiveBlock\('licitacao'\);\n/g, '');

content = content.replace(/\s*else if \(state\.view === 'licitacao-screening' \|\| state\.view === 'licitacao-all'\) \{[\s\S]*?setActiveBlock\('licitacao'\);\n\s*\}/g, '');

content = content.replace(/\s*\/\/ Licitacao Specific Keys[\s\S]*?else if \(currentView === 'order-details' && viewingOrder\) stateKey = 'licitacao-details';\n\s*\}/g, '');

content = content.replace(/\s*\/\/ Fetch Licitacao Global Protocol Counter[\s\S]*?fetchLicitacaoCount\(\);\n\s*\}/g, '');

content = content.replace(/\s*\/\/ LICITACAO FIX: When finishing the LAST stage, we must push it to history and increment index\n\s*if \(activeBlock === 'licitacao'\) \{[\s\S]*?updatedSnapshot\.content\.licitacaoStages\[currentIdx\] = currentStageData;\n\s*\}/g, '');

content = content.replace(/\s*if \(activeBlock === 'licitacao' && updatedSnapshot\.content\.currentStageIndex === 7\) \{[\s\S]*?return updatedSnapshot;\n\s*\}/g, '');

content = content.replace(/\s*\} else if \(finalOrder\.blockType === 'licitacao'\) \{[\s\S]*?setLicitacaoProcesses\(prev => prev\.map\(o => o\.id === finalOrder\.id \? editingOrder : o\)\);\n\s*\}/g, '');

content = content.replace(/\s*\} else if \(activeBlock === 'licitacao'\) \{[\s\S]*?setLicitacaoProcesses\(prev => prev\.filter\(o => o\.id !== finalOrder\.id\)\);\n\s*\}/g, '');

content = content.replace(/\s*licitacao: licitacaoKeys\.all,?/g, '');

content = content.replace(/\s*\} else if \(targetBlock === 'licitacao'\) \{[\s\S]*?setLicitacaoProcesses\(updatedList\);\n/g, '');

content = content.replace(/\s*else if \(activeBlock === 'licitacao'\) setLicitacaoProcesses\(p => p\.filter\(o => o\.id !== id\)\);\n/g, '');

content = content.replace(/\s*'licitacao': licitacaoKeys\.lists\(\),\n/g, '');

content = content.replace(/\s*case 'licitacao-screening':\n\s*return <LicitacaoScreeningScreen \/>;\n/g, '');

content = content.replace(/\s*case 'licitacao-all':\n\s*return <LicitacaoAllProcessesScreen \/>;\n/g, '');

fs.writeFileSync('App.tsx', content);
console.log("Cleanup script part 3 ran");
