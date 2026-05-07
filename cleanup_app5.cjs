const fs = require('fs');

// OrderDetailsScreen.tsx
let orderDetails = fs.readFileSync('components/OrderDetailsScreen.tsx', 'utf8');
orderDetails = orderDetails.replace(/, 'licitacao'/g, '');
orderDetails = orderDetails.replace(/ \|\| !!currentUser\?\.permissions\?\.includes\('parent_licitacao'\)/g, '');
fs.writeFileSync('components/OrderDetailsScreen.tsx', orderDetails);

// TrackingScreen.tsx
let tracking = fs.readFileSync('components/TrackingScreen.tsx', 'utf8');
tracking = tracking.replace(/\s*\/\/ LICITACAO: Filter Logic for "Processos" \(showAllProcesses=true\)\n\s*if \(isLicitacao && showAllProcesses\) \{\n\s*return Array\.isArray\(dataToFilter\) \? dataToFilter : \[\];\n\s*\}/g, '');
fs.writeFileSync('components/TrackingScreen.tsx', tracking);

// TrackingList.tsx
let trackingList = fs.readFileSync('components/TrackingList.tsx', 'utf8');
trackingList = trackingList.replace(/if \(order\.blockType === 'licitacao' && snapshotToDownload\) \{[\s\S]*?licitacaoStages: \[\n[\s\S]*?\],\n[\s\S]*?\}\n\s*\}/g, '');
trackingList = trackingList.replace(/\$\{isLicitacao \? 'px-8 py-4 space-y-4' : ''\}/g, '');
trackingList = trackingList.replace(/\{!isLicitacao && \(/g, '{(');
trackingList = trackingList.replace(/\$\{isLicitacao \? 'space-y-4' : 'divide-y divide-slate-100'\}/g, 'divide-y divide-slate-100');
trackingList = trackingList.replace(/\s*\/\/ Licitacao Logic OVERRIDE\n\s*if \(isLicitacao\) \{\n[\s\S]*?return <div key=\{index\}>Licitacao Stage<\/div>; \/\/ Simplified\n\s*\}\n/g, '');
trackingList = trackingList.replace(/\s*if \(isLicitacao\) \{\n\s*return null;\n\s*\}/g, '');
trackingList = trackingList.replace(/ && !isLicitacao/g, '');
trackingList = trackingList.replace(/\s*if \(order\.status === 'pending' && isLicitacao\) \{[\s\S]*?return <LicitacaoDetails \/>; \/\/ placeholder\n\s*\}/g, '');
fs.writeFileSync('components/TrackingList.tsx', trackingList);

// HomeScreen.tsx
let home = fs.readFileSync('components/HomeScreen.tsx', 'utf8');
home = home.replace(/\s*onManageLicitacaoScreening\?: \(\) => void;\n/g, '');
home = home.replace(/\s*onViewAllLicitacao\?: \(\) => void;\n/g, '');
home = home.replace(/\s*onManageLicitacaoScreening,\n/g, '');
home = home.replace(/\s*onViewAllLicitacao,\n/g, '');
home = home.replace(/\s*const canAccessLicitacao = permissions\.includes\('parent_licitacao'\) && isModuleActive\('parent_licitacao'\);\n/g, '');
home = home.replace(/\s*const canAccessLicitacaoTriagem = permissions\.includes\('parent_licitacao_triagem'\);\n/g, '');
home = home.replace(/canAccessLicitacao \|\| /g, '');
fs.writeFileSync('components/HomeScreen.tsx', home);

// ContentForm.tsx
let contentForm = fs.readFileSync('components/forms/ContentForm.tsx', 'utf8');
contentForm = contentForm.replace(/, LicitacaoForm\.tsx/g, '');
fs.writeFileSync('components/forms/ContentForm.tsx', contentForm);

console.log("Cleanup script part 5 ran");
