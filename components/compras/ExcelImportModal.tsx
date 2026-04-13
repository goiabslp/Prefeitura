import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UploadCloud, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Trash2, Clock, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getInventoryItems, addToInventory, updateInventoryItem, getInventoryImports, createInventoryImport, updateInventoryImport, deleteInventoryImport } from '../../services/comprasService';
import { InventoryCategory, InventoryImport } from '../../types';

interface ExcelImportModalProps {
    userName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ userName, onClose, onSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState('');
    
    // History state
    const [imports, setImports] = useState<InventoryImport[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await getInventoryImports();
            setImports(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleDeleteImport = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta importação? Todos os itens novos adicionados por ela serão deletados!")) return;
        
        try {
            await deleteInventoryImport(id);
            await fetchHistory();
            onSuccess?.(); // Trigger soft reload in the system if necessary
        } catch (err: any) {
            alert('Falha ao excluir importação: ' + err.message);
        }
    };

    const normalizeHeader = (header: string) => header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const handleFile = async (file: File) => {
        setLoading(true);
        setError('');
        setStatusText('Lendo as planilhas...');
        setProgress(10);

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            if (workbook.SheetNames.length === 0) throw new Error("A planilha está vazia.");

            const firstSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
            if (firstSheetData.length < 2) throw new Error("A planilha precisa ter um cabeçalho e pelo menos uma linha de dados.");

            const headers = (firstSheetData[0] as string[]).map(normalizeHeader);
            
            const requiredColumns = ['codigo', 'unidade', 'quantidade', 'descricao'];
            for (const req of requiredColumns) {
                if (!headers.includes(req)) {
                    throw new Error(`Coluna obrigatória não encontrada: "${req}". Certifique-se de ter Código, Unidade, Quantidade, Descrição.`);
                }
            }

            const codeIdx = headers.indexOf('codigo');
            const unitIdx = headers.indexOf('unidade');
            const qtyIdx = headers.indexOf('quantidade');
            const descIdx = headers.indexOf('descricao');
            const valIdx = headers.includes('valor') ? headers.indexOf('valor') : -1;

            const rowsToImport = firstSheetData.slice(1).filter((row: any) => row[descIdx] && row[qtyIdx] !== undefined);

            setStatusText('Baixando estoque atual para comparação...');
            setProgress(30);

            const currentInventory = await getInventoryItems(true); 
            
            setStatusText(`Processando ${rowsToImport.length} itens encontrados...`);
            setProgress(50);

            // 1. Create the import record FIRST to get the DB ID context
            const newImportRecord = await createInventoryImport({
                filename: file.name,
                imported_by: userName,
                items_added: 0,
                items_updated: 0,
                items_ignored: 0
            });

            let addedCount = 0;
            let updatedCount = 0;
            let ignoredCount = 0;

            for (let i = 0; i < rowsToImport.length; i++) {
                const row: any = rowsToImport[i];
                
                const incCode = String(row[codeIdx] || '').trim();
                const incUnit = String(row[unitIdx] || 'Unidade').trim();
                const incQty = Number(row[qtyIdx]) || 0;
                const incDesc = String(row[descIdx] || '').trim();
                const incValRaw = valIdx !== -1 ? row[valIdx] : 0;
                
                let incVal = typeof incValRaw === 'number' ? incValRaw : parseFloat(String(incValRaw).replace(/[^0-9,-]+/g,"").replace(',', '.'));
                if (isNaN(incVal)) incVal = 0;

                let existingItem = currentInventory.find(item => 
                    (incCode && item.code === incCode) || 
                    (!incCode && item.name.toLowerCase() === incDesc.toLowerCase())
                );

                if (existingItem) {
                    const currentVal = existingItem.unit_value || 0;
                    
                    if (incVal < currentVal) {
                        await updateInventoryItem(existingItem.id, {
                            code: incCode || existingItem.code,
                            name: incDesc,
                            unit: incUnit,
                            quantity: incQty,
                            unit_value: incVal,
                            category: existingItem.category
                        });
                        updatedCount++;
                    } else if (incVal > currentVal) {
                        ignoredCount++;
                    } else if (incVal === currentVal) {
                        const newQty = existingItem.quantity + incQty;
                        await updateInventoryItem(existingItem.id, {
                            quantity: newQty
                        });
                        updatedCount++;
                    }
                } else {
                    await addToInventory({
                        code: incCode,
                        name: incDesc,
                        unit: incUnit,
                        quantity: incQty,
                        unit_value: incVal,
                        category: 'Material de Uso',
                        is_tendered: true,
                        import_id: newImportRecord.id // Links newly created items to the import record
                    } as any);
                    addedCount++;
                }

                if (i % 10 === 0) {
                    setProgress(50 + Math.floor((i / rowsToImport.length) * 50));
                }
            }

            // 2. Update the import record with final metrics
            await updateInventoryImport(newImportRecord.id, {
                items_added: addedCount,
                items_updated: updatedCount,
                items_ignored: ignoredCount
            });

            setProgress(100);
            setStatusText(`Sucesso! ${addedCount} novos, ${updatedCount} atualizados/somados.`);
            
            // Re-fetch to update history
            await fetchHistory();

            setTimeout(() => {
                onSuccess?.();
            }, 3000);

        } catch (err: any) {
            console.error('Import error:', err);
            setError(err.message || 'Erro ao processar arquivo.');
            setStatusText('');
        } finally {
            if (progress !== 100) setLoading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                            Importar Dados e Histórico
                        </h2>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gestão de Cargas via Excel</span>
                    </div>
                    <button onClick={onClose} disabled={loading} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all disabled:opacity-50">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    
                    {/* Left/Top Content: Dropzone/Upload Indicator */}
                    <div className="w-full md:w-1/2 p-6 flex flex-col border-b md:border-b-0 md:border-r border-slate-100 bg-white overflow-y-auto">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Nova Carga</h3>
                        {error && (
                            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-bold text-rose-800">Falha na Importação</h3>
                                    <p className="text-sm text-rose-600 mt-1">{error}</p>
                                </div>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex flex-col items-center justify-center flex-1 py-10 min-h-[200px]">
                                {progress === 100 ? (
                                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 animate-bounce-in" />
                                ) : (
                                    <Loader2 className="w-16 h-16 text-slate-200 animate-spin mb-4" />
                                )}
                                <h3 className="text-lg font-bold text-slate-800 text-center px-4">{progress === 100 ? 'Processado!' : statusText}</h3>
                                <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-6 overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                                {progress === 100 && (
                                    <button 
                                        onClick={() => { setLoading(false); setProgress(0); setStatusText(''); }} 
                                        className="mt-6 px-6 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-colors"
                                    >
                                        Importar Outro
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div 
                                className={`flex-1 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[250px] ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50 hover:border-emerald-400'}`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                                    <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-emerald-500' : 'text-slate-400'}`} />
                                </div>
                                <h3 className="text-base font-bold text-slate-700 mb-2">Clique ou arraste a planilha base</h3>
                                <p className="text-xs text-slate-400 max-w-[250px] leading-relaxed">
                                    Formatos aceitos: .xlsx, .csv. Certifique-se de incluir as colunas: <strong className="text-slate-600">Código, Unidade, Quantidade, Descrição e Valor</strong>.
                                </p>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    accept=".xlsx,.xls,.csv"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFile(file);
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right/Bottom Content: History List */}
                    <div className="w-full md:w-1/2 p-6 flex flex-col bg-slate-50/50 overflow-hidden shrink-0 h-[300px] md:h-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                <Clock className="w-4 h-4 text-indigo-500" />
                                Histórico de Cargas
                            </h3>
                            <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                {imports.length} Registros
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span className="text-sm font-medium">Carregando histórico...</span>
                                </div>
                            ) : imports.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                                    <CalendarDays className="w-10 h-10 opacity-20" />
                                    <span className="text-sm font-medium text-center">Nenhuma planilha foi importada ainda.</span>
                                </div>
                            ) : (
                                imports.map(imp => {
                                    const d = new Date(imp.imported_at);
                                    return (
                                        <div key={imp.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-indigo-100 hover:shadow-md transition-all group">
                                            <div className="p-3 bg-indigo-50 rounded-xl">
                                                <FileSpreadsheet className="w-6 h-6 text-indigo-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-slate-800 truncate" title={imp.filename}>{imp.filename}</h4>
                                                <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-slate-500">
                                                    <span className="truncate max-w-[120px]">Por: {imp.imported_by}</span>
                                                    <span>•</span>
                                                    <span>{d.toLocaleDateString('pt-BR')} {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteImport(imp.id)}
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                                                title="Excluir importação (Remove itens novos do estoque)"
                                                disabled={loading}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>,
        document.body
    );
};
