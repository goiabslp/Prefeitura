const fs = require('fs');

// constants.ts
let constants = fs.readFileSync('constants.ts', 'utf8');
constants = constants.replace(/\s*licitacaoStages:\s*\[\],\n/g, '');
constants = constants.replace(/\s*licitacaoActiveDraft:\s*undefined,\n/g, '');
constants = constants.replace(/\s*role:\s*'licitacao',\n/g, '');
fs.writeFileSync('constants.ts', constants);

// counterService.ts
let counter = fs.readFileSync('services/counterService.ts', 'utf8');
counter = counter.replace(/export const LICITACAO_GLOBAL_ID = '11111111-1111-1111-1111-111111111111';\n/g, '');
counter = counter.replace(/export const getLicitacaoProtocolCount = async \(year: number\): Promise<number \| null> => \{\n\s*return getNextSectorCount\(LICITACAO_GLOBAL_ID, year\);\n\};\n/g, '');
counter = counter.replace(/export const incrementLicitacaoProtocolCount = async \(year: number\): Promise<number \| null> => \{\n\s*return incrementSectorCount\(LICITACAO_GLOBAL_ID, year\);\n\};\n/g, '');
fs.writeFileSync('services/counterService.ts', counter);

// DocumentPreview.tsx
let docPreview = fs.readFileSync('components/DocumentPreview.tsx', 'utf8');
docPreview = docPreview.replace(/import \{ LicitacaoPreview \} from '\.\/LicitacaoPreview';\n/g, '');
docPreview = docPreview.replace(/\s*case 'licitacao':\n\s*return <LicitacaoPreview state=\{state\} isGenerating=\{isGenerating\} \/>;\n/g, '');
fs.writeFileSync('components/DocumentPreview.tsx', docPreview);

// TrackingScreen.tsx
let tracking = fs.readFileSync('components/TrackingScreen.tsx', 'utf8');
tracking = tracking.replace(/import { useInfiniteLicitacao } from '\.\.\/hooks\/useLicitacao';\n/g, '');
tracking = tracking.replace(/\s*\/\/ LICITACAO\n\s*const \{\n\s*data: infiniteLicitacao,\n\s*fetchNextPage: fetchNextLicitacao,\n\s*hasNextPage: hasNextLicitacao,\n\s*isFetchingNextPage: isFetchingNextLicitacao,\n\s*isLoading: isLoadingLicitacao,\n\s*isError: isLicitacaoError\n\s*\} = useInfiniteLicitacao\(20, searchTerm\);\n/g, '');
tracking = tracking.replace(/\s*const licitacaoData = React\.useMemo\(\(\) => \{\n\s*const remote = infiniteLicitacao\?\.pages\.flat\(\) \|\| \[\];\n\s*return remote\.length > 0 \? remote : orders;\n\s*\}, \[infiniteLicitacao, orders\]\);\n/g, '');
tracking = tracking.replace(/ \|\| isLoadingLicitacao/g, '');
tracking = tracking.replace(/\s*const isLicitacaoUser = currentUser\.role === 'licitacao';\n/g, '');
tracking = tracking.replace(/ \|\| activeBlock === 'licitacao'/g, '');
tracking = tracking.replace(/\s*const isLicitacao = activeBlock === 'licitacao';\n/g, '');
tracking = tracking.replace(/\s*if \(activeBlock === 'licitacao'\) return licitacaoData;\n/g, '');
tracking = tracking.replace(/ \|\| \(activeBlock === 'licitacao' && isLicitacaoUser\)/g, '');
tracking = tracking.replace(/ \|\| currentUser\.role === 'licitacao'/g, '');
tracking = tracking.replace(/\s*\/\/ LICITACAO: Filter Logic for "Processos" \(showAllProcesses=true\)\n\s*if \(isLicitacao && showAllProcesses\) \{\n\s*return Array\.isArray\(dataToFilter\) \? dataToFilter : \[\];\n\s*\}/g, '');
tracking = tracking.replace(/ \? 'Histórico de Ofícios' : \(\(activeBlock as any\) === 'licitacao' && !showAllProcesses\) \? 'Meus Processos' : \(\(activeBlock as any\) === 'licitacao' && showAllProcesses\) \? 'Processos' : `Histórico: \$\{activeBlock\?\.toUpperCase\(\)\}`/g, " ? 'Histórico de Ofícios' : `Histórico: ${activeBlock?.toUpperCase()}`");
tracking = tracking.replace(/ && !isLicitacao/g, '');
tracking = tracking.replace(/\s*\{activeBlock === 'licitacao' && \(order\.documentSnapshot\?\.content as any\)\?\.finalDocumentUrl && \(\n[\s\S]*?\}\n/g, '');
tracking = tracking.replace(/hasNextLicitacao && activeBlock === 'licitacao' \|\|/g, '');
tracking = tracking.replace(/\s*else if \(activeBlock === 'licitacao'\) fetchNextLicitacao\(\);/g, '');
tracking = tracking.replace(/ \|\| isFetchingNextLicitacao/g, '');
fs.writeFileSync('components/TrackingScreen.tsx', tracking);

// UserManagementScreen.tsx
let userMgmt = fs.readFileSync('components/UserManagementScreen.tsx', 'utf8');
userMgmt = userMgmt.replace(/user\.role === 'licitacao' \? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white' :/g, '');
userMgmt = userMgmt.replace(/user\.role === 'licitacao' \? 'bg-blue-50\/50 text-blue-700 border-blue-100' :/g, '');
userMgmt = userMgmt.replace(/\s*\{user\.role === 'licitacao' && <Gavel className="w-3 h-3" \/>\}/g, '');
userMgmt = userMgmt.replace(/\s*\{ id: 'licitacao', label: 'Licitação', desc: 'Módulos sem Admin\.', icon: <Gavel className="w-5 h-5" \/>, color: 'blue' \},/g, '');
userMgmt = userMgmt.replace(/\s*\{ id: 'parent_licitacao', label: 'Módulo Geral' \},/g, '');
userMgmt = userMgmt.replace(/\s*\{ id: 'parent_licitacao_processos', label: 'Processos' \},/g, '');
userMgmt = userMgmt.replace(/\s*\{ id: 'parent_licitacao_triagem', label: 'Triagem' \}/g, '');
fs.writeFileSync('components/UserManagementScreen.tsx', userMgmt);

// TrackingList.tsx
let trackingList = fs.readFileSync('components/TrackingList.tsx', 'utf8');
trackingList = trackingList.replace(/\s*const isLicitacao = activeBlock === 'licitacao';\n/g, '');
trackingList = trackingList.replace(/ \|\| currentUser\.role === 'licitacao'/g, '');
trackingList = trackingList.replace(/\s*\/\/ LICITACAO: Filter Logic for "Processos" \(showAllProcesses=true\)\n\s*if \(isLicitacao && showAllProcesses\) \{\n\s*return dataToFilter;\n\s*\}/g, '');
fs.writeFileSync('components/TrackingList.tsx', trackingList);

console.log("Cleanup script part 4 ran");
