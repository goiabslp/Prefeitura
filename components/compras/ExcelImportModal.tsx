import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UploadCloud, X, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getInventoryItems, addToInventory, updateInventoryItem } from '../../services/comprasService';
import { InventoryCategory } from '../../types';

interface ExcelImportModalProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ onClose, onSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mapeamento esperado e normalização.
    // O usuário relatou as colunas: Código, Unidade, Quantidade, Descrição, Valor.
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
            
            // Validating required columns
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

            // Fetch current inventory
            const currentInventory = await getInventoryItems(true); // Assumindo is_tendered=true por ser importado
            
            setStatusText(`Processando ${rowsToImport.length} itens encontrados...`);
            setProgress(50);

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
                
                // Trata strings com R$, vírgulas etc no valor numérico
                let incVal = typeof incValRaw === 'number' ? incValRaw : parseFloat(String(incValRaw).replace(/[^0-9,-]+/g,"").replace(',', '.'));
                if (isNaN(incVal)) incVal = 0;

                // Encontrar duplicidades (buscando por Código, se vazio, busca por descrição)
                let existingItem = currentInventory.find(item => 
                    (incCode && item.code === incCode) || 
                    (!incCode && item.name.toLowerCase() === incDesc.toLowerCase())
                );

                if (existingItem) {
                    const currentVal = existingItem.unit_value || 0;
                    
                    if (incVal < currentVal) {
                        // Prevalece o menor valor: O novo é MENOR, então atualizamos tudo para o novo.
                        // O usuário disse: "Caso haja duplicidade, cancele o maior valor" (Ou seja, substitui pelo novo)
                        await updateInventoryItem(existingItem.id, {
                            code: incCode || existingItem.code,
                            name: incDesc,
                            unit: incUnit,
                            quantity: incQty, // Substitui ou soma? Se é menor valor, vamos assumir que o novo contrato substitui
                            unit_value: incVal,
                            category: existingItem.category
                        });
                        updatedCount++;
                    } else if (incVal > currentVal) {
                        // O valor atual é MENOR. Descartamos o item novo (cancelamos a importação dele).
                        ignoredCount++;
                    } else if (incVal === currentVal) {
                        // Valores são IGUAIS: soma os estoques com a nova inclusão
                        const newQty = existingItem.quantity + incQty;
                        await updateInventoryItem(existingItem.id, {
                            quantity: newQty
                        });
                        updatedCount++;
                    }
                } else {
                    // Item novo, não existe no estoque. Insert
                    await addToInventory({
                        code: incCode,
                        name: incDesc,
                        unit: incUnit,
                        quantity: incQty,
                        unit_value: incVal,
                        category: 'Material de Uso', // Padrão
                        is_tendered: true
                    } as any);
                    addedCount++;
                }

                // Update UI progress
                if (i % 10 === 0) {
                    setProgress(50 + Math.floor((i / rowsToImport.length) * 50));
                }
            }

            setProgress(100);
            setStatusText(`Sucesso! ${addedCount} novos, ${updatedCount} atualizados/somados, ${ignoredCount} ignorados por valor maior.`);
            setTimeout(() => {
                onSuccess?.();
                onClose();
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
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                            Importar Dados
                        </h2>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carga via Excel</span>
                    </div>
                    <button onClick={onClose} disabled={loading} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all disabled:opacity-50">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {/* Error State */}
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-rose-800">Falha na Importação</h3>
                                <p className="text-sm text-rose-600 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Progress State */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            {progress === 100 ? (
                                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 animate-bounce-in" />
                            ) : (
                                <Loader2 className="w-16 h-16 text-slate-200 animate-spin mb-4" />
                            )}
                            <h3 className="text-lg font-bold text-slate-800">{progress === 100 ? 'Processado!' : statusText}</h3>
                            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-6 overflow-hidden">
                                <div 
                                    className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        /* Upload Zone */
                        <div 
                            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50 hover:border-emerald-400'}`}
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
            </div>
        </div>,
        document.body
    );
};
