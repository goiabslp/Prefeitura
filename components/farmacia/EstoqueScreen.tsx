import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import { Package, Plus, Edit, Trash2, Calendar, AlertTriangle, ChevronRight, CheckCircle2, TrendingUp, Info, Loader2, Sparkles, SlidersHorizontal, X, XCircle, Search, Pill, ArrowLeft, ArrowUpRight, ArrowDownRight, Scale, ShieldCheck, ShoppingBag, Gift, Building2, HeartHandshake } from 'lucide-react';
import * as db from '../../services/farmaciaService';
import { isDesistenciaMovimentacao } from '../../utils/farmaciaDesistenciaUtils';
import { useFarmaciaAlert } from './FarmaciaAlertContext';
import { RAW_MEDS } from './medsToImportData';
import { getMedsToImport } from './medsToImport';

const FORMAS_FARMACEUTICAS = [
  'Adesivo transdérmico', 'Aerossol oral', 'Cápsula', 'Cápsula de liberação prolongada', 'Cápsula de liberação retardada', 'Cápsula gelatinosa dura', 'Cápsula inalatória', 'Cápsula mole', 'Cápsula para inalação oral', 'Comprimido', 'Comprimido de liberação prolongada', 'Comprimido de liberação retardada', 'Comprimido dispersível', 'Comprimido mastigável', 'Comprimido orodispersível', 'Comprimido para suspensão', 'Comprimido para suspensão oral', 'Comprimido para uso tópico', 'Comprimido revestido', 'Comprimido solúvel', 'Comprimido sublingual', 'Comprimido vaginal', 'Comprimidos dispersíveis', 'Creme', 'Creme dermatológico', 'Creme vaginal', 'Dispositivo intrauterino (DIU)', 'Elixir', 'Emulsão oral', 'Enema', 'Frasco-ampola', 'Gel', 'Gel oral', 'Gel vaginal', 'Goma de mascar', 'Granulado oral', 'Granulado para suspensão oral', 'Granulado revestido de liberação prolongada', 'Grânulo para suspensão oral', 'Grânulos revestidos', 'Implante', 'Loção', 'Óleo para uso oral', 'Óvulo vaginal', 'Pasta', 'Pastilha', 'Pó', 'Pó estéril para solução injetável', 'Pó inalatório', 'Pó liofilizado para solução injetável', 'Pó liofilizado para solução para infusão', 'Pó liofilizado para suspensão injetável de liberação prolongada', 'Pó liófilizado para injetável', 'Pó para dispersão oral', 'Pó para inalação', 'Pó para inalação oral', 'Pó para solução injetável', 'Pó para solução oral', 'Pó para solução para infusão', 'Pó para solução para infusão e inalação', 'Pó para suspensão injetável', 'Pó para suspensão injetável de liberação prolongada', 'Pó para suspensão oral', 'Pomada', 'Pomada oftálmica', 'Solução', 'Solução aerossol', 'Solução bucal', 'Solução capilar', 'Solução inalatória', 'Solução injetável', 'Solução injetável de liberação prolongada', 'Solução injetável depot', 'Solução nasal', 'Solução oftálmica', 'Solução oral', 'Solução otológica', 'Solução para diluição para infusão', 'Solução para infusão', 'Solução para inalação', 'Solução para uso tópico', 'Solução retal', 'Solução spray', 'Solução spray nasal', 'Solução tópica', 'Suspensão aerossol', 'Suspensão injetável', 'Suspensão injetável de liberação prolongada', 'Suspensão injetável intratecal ou intrabrônquica', 'Suspensão oftálmica', 'Suspensão oral', 'Suspensão para inalação nasal', 'Tintura', 'Unidade', 'Xampu'
];

interface EstoqueScreenProps {
    currentUser?: User | null;
    onBack: () => void;
    appState?: any;
    lowStockMedicamentos?: any[];
    hasCriticalItems?: boolean;
    onOpenAlertModal?: () => void;
}

const parseDosagem = (dosagemStr: string | undefined | null) => {
    if (!dosagemStr) return { valor: '', tipo: 'mg' };
    
    const tipos = ['mg/5 mL', 'mcg/mL', 'mg/mL', 'g/mL', 'mcg (µg)', 'mcg', 'µg', 'mg', 'g', 'kg'];
    
    for (const t of tipos) {
        if (dosagemStr.endsWith(t)) {
            const valor = dosagemStr.slice(0, -t.length).trim();
            let tipoNormalizado = t;
            if (t === 'mcg' || t === 'µg') {
                tipoNormalizado = 'mcg (µg)';
            }
            return { valor, tipo: tipoNormalizado };
        }
    }
    
    return { valor: dosagemStr, tipo: 'mg' };
};

export const EstoqueScreen: React.FC<EstoqueScreenProps> = ({
    currentUser,
    onBack,
    appState,
    lowStockMedicamentos,
    hasCriticalItems,
    onOpenAlertModal
}) => {
    const { showAlert, showConfirm } = useFarmaciaAlert();

    // DB state
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [movimentacoes, setMovimentacoes] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Import state
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ total: 0, current: 0 });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 100;

    // Modal control
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [selectedMed, setSelectedMed] = useState<FarmaciaMedicamento | null>(null);
    const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
    const [stockToAdd, setStockToAdd] = useState<{
        lote: string;
        validade: string;
        quantidade: string;
        origem: 'COMPRADO' | 'DOADO' | 'FORNECIDO PELO ESTADO' | '';
        doador_nome: string;
        documento_origem: string;
        fornecedor: string;
    }>({
        lote: '',
        validade: '',
        quantidade: '',
        origem: '',
        doador_nome: '',
        documento_origem: '',
        fornecedor: ''
    });

    const resetStockToAdd = (med?: FarmaciaMedicamento | null) => ({
        lote: '',
        validade: '',
        quantidade: '',
        origem: '' as 'COMPRADO' | 'DOADO' | 'FORNECIDO PELO ESTADO' | '',
        doador_nome: '',
        documento_origem: '',
        fornecedor: med?.fornecedor || ''
    });

    // --- ESTADOS DO MODAL DE AJUSTE MANUAL DE ESTOQUE POR LOTE ---
    const [isAjusteManualModalOpen, setIsAjusteManualModalOpen] = useState(false);
    const [ajusteLoteTarget, setAjusteLoteTarget] = useState<FarmaciaMedicamento | null>(null);
    const [ajusteNovoSaldoInput, setAjusteNovoSaldoInput] = useState<string>('');
    const [ajusteMotivoInput, setAjusteMotivoInput] = useState<string>('');
    const [ajusteStep, setAjusteStep] = useState<'form' | 'confirm'>('form');
    const [isSubmittingAjuste, setIsSubmittingAjuste] = useState(false);

    const [expandedMeds, setExpandedMeds] = useState<Record<string, boolean>>({});

    const toggleExpand = (key: string) => {
        setExpandedMeds(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Custom select dropdown states
    const [isAddCatOpen, setIsAddCatOpen] = useState(false);
    const [isAddTipoOpen, setIsAddTipoOpen] = useState(false);
    const [isEditCatOpen, setIsEditCatOpen] = useState(false);
    const [isEditTipoOpen, setIsEditTipoOpen] = useState(false);
    const [isAddTipoDosagemOpen, setIsAddTipoDosagemOpen] = useState(false);
    const [isEditTipoDosagemOpen, setIsEditTipoDosagemOpen] = useState(false);

    // Form inputs
    const [nome, setNome] = useState('');
    const [categoria, setCategoria] = useState<'CBAF' | 'CESAF' | 'CEAF'>('CBAF');
    const [quantidade, setQuantidade] = useState('');
    const [unidade, setUnidade] = useState('Unidade');
    const [validade, setValidade] = useState('');
    const [lote, setLote] = useState('');
    const [limiteMinimo, setLimiteMinimo] = useState('10');
    const [fornecedor, setFornecedor] = useState('');
    const [tipo, setTipo] = useState('Comprimido');
    const [dosagemValor, setDosagemValor] = useState('');
    const [tipoDosagem, setTipoDosagem] = useState('mg');
    const [principioAtivo, setPrincipioAtivo] = useState('');
    const [altoCusto, setAltoCusto] = useState<'Não' | 'Sim'>('Não');
    const [saving, setSaving] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const uniqueMedicaments = useMemo(() => {
        const seen = new Set<string>();
        const list: { id: string; nome: string; dosagem: string; tipo: string; lote: string; codigoSequencial: string; principio_ativo: string }[] = [];
        
        // Ordena deterministicamente por criado_em / ID para atribuição estável da sequência
        const sortedMeds = [...medicamentos].sort((a, b) => {
            const dateA = a.criado_em ? new Date(a.criado_em).getTime() : 0;
            const dateB = b.criado_em ? new Date(b.criado_em).getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;
            return a.id.localeCompare(b.id);
        });

        let seqCount = 1;
        sortedMeds.forEach(m => {
            const key = `${m.nome.toUpperCase()} - ${m.dosagem?.toUpperCase() || ''} - ${m.tipo?.toUpperCase() || ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                const codigoPad = String(seqCount).padStart(5, '0');
                seqCount++;
                list.push({
                    id: m.id,
                    nome: m.nome.toUpperCase(),
                    dosagem: m.dosagem || '',
                    tipo: m.tipo || '',
                    lote: m.lote || '',
                    codigoSequencial: codigoPad,
                    principio_ativo: m.principio_ativo || ''
                });
            }
        });
        
        return list.sort((a, b) => a.nome.localeCompare(b.nome));
    }, [medicamentos]);

    const medicamentCodes = useMemo(() => {
        const map: Record<string, string> = {};
        uniqueMedicaments.forEach(u => {
            const key = `${u.nome.toUpperCase()} - ${u.dosagem?.toUpperCase() || ''} - ${u.tipo?.toUpperCase() || ''}`;
            map[key] = u.codigoSequencial;
        });
        return map;
    }, [uniqueMedicaments]);

    const nameSuggestions = useMemo(() => {
        if (!nome.trim()) return [];
        const term = nome.toUpperCase();
        return uniqueMedicaments.filter(m => 
            m.nome.includes(term) || 
            (m.principio_ativo && m.principio_ativo.toUpperCase().includes(term))
        );
    }, [nome, uniqueMedicaments]);

    const [selectedExistingMed, setSelectedExistingMed] = useState<{ id: string; nome: string; dosagem: string; tipo: string; lote: string; codigoSequencial: string; principio_ativo: string } | null>(null);

    const isExistingMed = !!selectedExistingMed;


    // Regra de 2 Níveis: Uma vez no submódulo Estoque, todas as operações estão liberadas
    const canCreate = true;
    const canEdit = true;
    const canDelete = true;
    const canApprove = true;

    const handleImportMeds = async () => {
        const medsList = getMedsToImport(RAW_MEDS);
        if (!medsList || medsList.length === 0) return;
        
        if (!window.confirm('Deseja iniciar a importação do Lote Inicial de Medicamentos? Essa operação pode demorar alguns minutos.')) return;
        
        setIsImporting(true);
        setImportProgress({ total: medsList.length, current: 0 });
        
        try {
            for (let i = 0; i < medsList.length; i++) {
                const medData = medsList[i];
                // Check if already exists to avoid duplicates and allow resuming
                const exists = medicamentos.some(m => 
                    m.nome === medData.nome && 
                    m.dosagem === medData.dosagem && 
                    m.tipo === medData.tipo &&
                    m.principio_ativo === medData.principio_ativo
                );
                
                if (!exists) {
                    await db.createMedicamento(medData);
                }
                
                setImportProgress({ total: medsList.length, current: i + 1 });
            }
            
            showAlert('Importação do Lote Inicial concluída com sucesso!', 'success');
            loadData(true);
        } catch (error: any) {
            console.error('Import error:', error);
            showAlert('Ocorreu um erro durante a importação. A operação pode ter sido interrompida.', 'error');
        } finally {
            setIsImporting(false);
            setImportProgress({ total: 0, current: 0 });
        }
    };

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [medData, movData] = await Promise.all([
                db.getMedicamentos(),
                db.getMovimentacoes()
            ]);
            setMedicamentos(medData);
            setMovimentacoes(movData);
        } catch (error) {
            console.error('[EstoqueScreen] Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const handleMedChange = () => loadData(true);
        const handleMovChange = () => loadData(true);

        window.addEventListener('farmacia-medicamentos-changed', handleMedChange);
        window.addEventListener('farmacia-movimentacoes-changed', handleMovChange);

        return () => {
            window.removeEventListener('farmacia-medicamentos-changed', handleMedChange);
            window.removeEventListener('farmacia-movimentacoes-changed', handleMovChange);
        };
    }, []);

    // --- ANALYTICS DASHBOARD COMPUTATIONS ---
    const stats = useMemo(() => {
        const ativos = medicamentos.filter(m => !(m.quantidade === 0 && m.lote === 'LOTE-INICIAL'));

        const totalItems = ativos.length;
        const totalQty = ativos.reduce((acc, m) => acc + m.quantidade, 0);
        const outOfStock = ativos.filter(m => m.quantidade === 0).length;
        
        // Expiration in next 90 days
        const nearExpiration = ativos.filter(m => {
            const daysLeft = (new Date(m.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return daysLeft > 0 && daysLeft <= 90;
        }).length;

        // Most Withdrawn drugs ranking (type 'Saída')
        const withdrawals = movimentacoes.filter(m => m.tipo === 'Saída' && !isDesistenciaMovimentacao(m));
        const grouped: Record<string, number> = {};
        withdrawals.forEach(w => {
            grouped[w.medicamento_nome] = (grouped[w.medicamento_nome] || 0) + w.quantidade;
        });

        const sortedRanking = Object.entries(grouped)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        return {
            totalItems,
            totalQty,
            outOfStock,
            nearExpiration,
            sortedRanking
        };
    }, [medicamentos, movimentacoes]);

    // Filtered list for search
    const filteredMedicamentos = useMemo(() => {
        if (!searchTerm.trim()) return medicamentos;
        const term = searchTerm.toLowerCase();
        return medicamentos.filter(med => {
            const key = `${med.nome.toUpperCase()} - ${med.dosagem?.toUpperCase() || ''} - ${med.tipo?.toUpperCase() || ''}`;
            const code = medicamentCodes[key] || '';
            
            return med.nome.toLowerCase().startsWith(term) ||
                (med.principio_ativo && med.principio_ativo.toLowerCase().startsWith(term));
        });
    }, [medicamentos, searchTerm, medicamentCodes]);

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Agrupamento por nome + dosagem + tipo para evitar medicamentos duplicados na tela principal do estoque
    const groupedMedicamentos = useMemo(() => {
        const groups: Record<string, {
            key: string;
            nome: string;
            dosagem?: string;
            tipo?: string;
            categoria: string;
            principio_ativo?: string;
            unidade: string;
            quantidadeTotal: number;
            limite_minimo: number;
            lotes: FarmaciaMedicamento[];
        }> = {};

        filteredMedicamentos.forEach(med => {
            const key = `${med.nome.toUpperCase()}_${(med.dosagem || '').toUpperCase()}_${(med.tipo || '').toUpperCase()}`;
            if (!groups[key]) {
                groups[key] = {
                    key,
                    nome: med.nome,
                    dosagem: med.dosagem,
                    tipo: med.tipo,
                    categoria: med.categoria,
                    principio_ativo: med.principio_ativo,
                    unidade: med.unidade,
                    quantidadeTotal: 0,
                    limite_minimo: med.limite_minimo,
                    lotes: []
                };
            }
            groups[key].quantidadeTotal += med.quantidade;
            groups[key].lotes.push(med);
        });

        // Ordena por nome do medicamento agrupado
        return Object.values(groups).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [filteredMedicamentos]);

    // Paginated list
    const paginatedMedicamentos = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return groupedMedicamentos.slice(startIndex, startIndex + itemsPerPage);
    }, [groupedMedicamentos, currentPage]);

    const totalPages = Math.ceil(groupedMedicamentos.length / itemsPerPage);

    // --- CRUD ACTIONS ---

    const handleOpenAddModal = () => {
        setNome('');
        setCategoria('CBAF');
        setQuantidade('0');
        setUnidade('Unidade');
        setValidade('2099-12-31');
        setLote('S/L');
        setLimiteMinimo('10');
        setFornecedor('');
        setTipo('Comprimido');
        setDosagemValor('');
        setTipoDosagem('mg');
        setPrincipioAtivo('');
        setAltoCusto('Não');
        setSelectedExistingMed(null);
        setIsAddModalOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome || !limiteMinimo) {
            showAlert('Preencha os campos obrigatórios.', 'error');
            return;
        }

        const dosagemConcatenada = dosagemValor ? `${dosagemValor}${tipoDosagem}` : '';

        // Procura por um lote exatamente idêntico (mesmo Nome, Tipo, Dosagem E Lote)
        const existingLote = medicamentos.find(med => 
            med.nome.toUpperCase() === nome.toUpperCase() &&
            (med.tipo || '').toUpperCase() === tipo.toUpperCase() &&
            (med.dosagem || '').toUpperCase() === (dosagemConcatenada || '').toUpperCase() &&
            med.lote.toUpperCase() === lote.toUpperCase()
        );

        setSaving(true);
        try {
            const qtyNum = parseInt(quantidade, 10);
            const limitNum = parseInt(limiteMinimo, 10);

            if (existingLote) {
                // Se o lote exato já existe, apenas atualiza validade/categoria/principio_ativo e soma a quantidade via movimentação de entrada
                await db.updateMedicamento(existingLote.id, {
                    validade,
                    categoria,
                    principio_ativo: principioAtivo.toUpperCase() || undefined,
                    alto_custo: altoCusto === 'Sim'
                });

                if (qtyNum > 0) {
                    await db.registrarMovimentacao({
                        medicamento_id: existingLote.id,
                        tipo: 'Entrada',
                        quantidade: qtyNum,
                        medicamento_nome: existingLote.nome,
                        medicamento_categoria: categoria,
                        medicamento_tipo: existingLote.tipo,
                        medicamento_dosagem: existingLote.dosagem,
                        lote: lote.toUpperCase(),
                        validade: validade,
                        responsavel_nome: currentUser?.name || '',
                        responsavel_id: currentUser?.id || '',
                        data: new Date().toISOString(),
                        observacoes: 'Entrada de novo estoque para lote existente'
                    });
                }

                showAlert('Medicamento atualizado com sucesso!', 'success');
            } else {
                // Se é um novo lote de um medicamento existente, ou um medicamento completamente novo:
                // criamos um novo registro de lote no estoque
                const newMed = await db.createMedicamento({
                    nome: nome.toUpperCase(),
                    categoria,
                    quantidade: 0,
                    unidade,
                    validade,
                    lote: lote.toUpperCase(),
                    limite_minimo: limitNum,
                    tipo,
                    dosagem: dosagemConcatenada || undefined,
                    fornecedor: fornecedor || undefined,
                    principio_ativo: principioAtivo.toUpperCase() || undefined,
                    alto_custo: altoCusto === 'Sim'
                });

                if (newMed) {
                    if (qtyNum > 0) {
                        await db.registrarMovimentacao({
                            medicamento_id: newMed.id,
                            tipo: 'Entrada',
                            quantidade: qtyNum,
                            medicamento_nome: newMed.nome,
                            medicamento_categoria: newMed.categoria,
                            medicamento_tipo: newMed.tipo,
                            medicamento_dosagem: newMed.dosagem,
                            lote: newMed.lote,
                            validade: newMed.validade,
                            responsavel_nome: currentUser?.name || '',
                            responsavel_id: currentUser?.id || '',
                            data: new Date().toISOString(),
                            observacoes: 'Cadastro de novo lote'
                        });
                    }
                    showAlert('Medicamento cadastrado com sucesso!', 'success');
                }
            }
            setIsAddModalOpen(false);
            setSelectedExistingMed(null);
            loadData(true);
        } catch (error: any) {
            showAlert(error.message || 'Erro ao cadastrar medicamento.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEditModal = (med: FarmaciaMedicamento) => {
        setSelectedMed(med);
        setNome(med.nome);
        setCategoria(med.categoria);
        setUnidade(med.unidade);
        setValidade(med.validade);
        setLote(med.lote);
        setQuantidade(med.quantidade.toString());
        setLimiteMinimo(med.limite_minimo.toString());
        setFornecedor(med.fornecedor || '');
        setTipo(med.tipo || 'Comprimido');
        setPrincipioAtivo(med.principio_ativo || '');
        setAltoCusto(med.alto_custo ? 'Sim' : 'Não');
        
        const parsed = parseDosagem(med.dosagem);
        setDosagemValor(parsed.valor);
        setTipoDosagem(parsed.tipo);
        setIsEditModalOpen(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMed) return;

        const dosagemConcatenada = dosagemValor ? `${dosagemValor}${tipoDosagem}` : '';

        const hasExactDuplicate = medicamentos.some(med => 
            med.id !== selectedMed.id &&
            med.nome.toUpperCase() === nome.toUpperCase() &&
            (med.tipo || '').toUpperCase() === tipo.toUpperCase() &&
            (med.dosagem || '').toUpperCase() === (dosagemConcatenada || '').toUpperCase()
        );

        if (hasExactDuplicate) {
            showAlert(`Já existe outro medicamento cadastrado com o mesmo Nome ("${nome.toUpperCase()}"), Tipo ("${tipo}") e Dosagem ("${dosagemConcatenada || 'Sem Dosagem'}").`, 'error');
            return;
        }

        setSaving(true);
        try {
            const oldQty = selectedMed.quantidade;
            const newQty = parseInt(quantidade, 10);

            await db.updateMedicamento(selectedMed.id, {
                nome: nome.toUpperCase(),
                categoria,
                unidade,
                validade,
                lote: lote.toUpperCase(),
                quantidade: newQty,
                limite_minimo: parseInt(limiteMinimo, 10),
                tipo,
                dosagem: dosagemConcatenada || undefined,
                fornecedor: fornecedor || undefined,
                principio_ativo: principioAtivo.toUpperCase() || undefined,
                alto_custo: altoCusto === 'Sim'
            });

            // Se a quantidade foi alterada, registra a movimentação de ajuste correspondente no histórico
            if (oldQty !== newQty) {
                const diff = newQty - oldQty;
                await db.registrarMovimentacao({
                    medicamento_id: selectedMed.id,
                    tipo: diff > 0 ? 'Entrada' : 'Saída',
                    quantidade: Math.abs(diff),
                    medicamento_nome: nome.toUpperCase(),
                    medicamento_categoria: categoria,
                    medicamento_tipo: tipo,
                    medicamento_dosagem: dosagemConcatenada,
                    lote: lote.toUpperCase(),
                    validade: validade,
                    responsavel_nome: currentUser?.name || '',
                    responsavel_id: currentUser?.id || '',
                    data: new Date().toISOString(),
                    observacoes: `Ajuste de estoque via edição (de ${oldQty} para ${newQty})`
                });
            }

            showAlert('Medicamento atualizado com sucesso!', 'success');
            setIsEditModalOpen(false);
            loadData(true);
        } catch (error: any) {
            showAlert(error.message || 'Erro ao atualizar medicamento.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        showConfirm(`Deseja realmente excluir o lote de "${name}"? Esta ação removerá o lote do estoque.`, async () => {
            try {
                await db.deleteMedicamento(id);
                if (selectedMed?.id === id) {
                    setSelectedMed(null);
                    setIsEditModalOpen(false);
                }
                showAlert('Medicamento excluído do estoque.', 'success');
                loadData(true);
            } catch (error: any) {
                showAlert(error.message || 'Erro ao excluir medicamento.', 'error');
            }
        });
    };

    const handleCreateStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMed || !stockToAdd.lote || !stockToAdd.validade || !stockToAdd.quantidade) {
            showAlert('Preencha os campos obrigatórios (Lote, Validade e Quantidade).', 'error');
            return;
        }

        if (!stockToAdd.origem) {
            showAlert('Por favor, selecione a Origem do Estoque (Comprado ou Doado).', 'error');
            return;
        }

        if (stockToAdd.origem === 'DOADO' && !stockToAdd.doador_nome.trim()) {
            showAlert('O campo "Município ou Entidade Doadora" é obrigatório para doações.', 'error');
            return;
        }

        const qtyNum = parseInt(stockToAdd.quantidade, 10);
        if (qtyNum <= 0) {
            showAlert('Quantidade deve ser maior que zero.', 'error');
            return;
        }

        const existingLote = medicamentos.find(med => 
            med.nome.toUpperCase() === selectedMed.nome.toUpperCase() &&
            (med.tipo || '').toUpperCase() === (selectedMed.tipo || '').toUpperCase() &&
            (med.dosagem || '').toUpperCase() === (selectedMed.dosagem || '').toUpperCase() &&
            med.lote.toUpperCase() === stockToAdd.lote.toUpperCase()
        );

        setSaving(true);
        try {
            const obsProcedencia = stockToAdd.origem === 'DOADO' 
                ? `[ORIGEM: DOADO | Doador: ${stockToAdd.doador_nome.trim()}${stockToAdd.documento_origem.trim() ? ` | Termo/Ofício: ${stockToAdd.documento_origem.trim()}` : ''}]`
                : stockToAdd.origem === 'FORNECIDO PELO ESTADO'
                ? `[ORIGEM: FORNECIDO PELO ESTADO${stockToAdd.documento_origem.trim() ? ` | Guia/Doc SES: ${stockToAdd.documento_origem.trim()}` : ''}${stockToAdd.doador_nome.trim() ? ` | Órgão: ${stockToAdd.doador_nome.trim()}` : ''}]`
                : `[ORIGEM: COMPRADO${stockToAdd.documento_origem.trim() ? ` | NF/Doc: ${stockToAdd.documento_origem.trim()}` : ''}${stockToAdd.fornecedor.trim() ? ` | Fornecedor: ${stockToAdd.fornecedor.trim()}` : ''}]`;

            if (existingLote) {
                await db.updateMedicamento(existingLote.id, {
                    validade: stockToAdd.validade,
                    origem: stockToAdd.origem || existingLote.origem,
                    doador_nome: (stockToAdd.origem === 'DOADO' || stockToAdd.origem === 'FORNECIDO PELO ESTADO') ? stockToAdd.doador_nome.trim() : (existingLote.doador_nome || ''),
                    documento_origem: stockToAdd.documento_origem.trim() || existingLote.documento_origem || ''
                });

                await db.registrarMovimentacao({
                    medicamento_id: existingLote.id,
                    tipo: 'Entrada',
                    quantidade: qtyNum,
                    medicamento_nome: existingLote.nome,
                    medicamento_categoria: existingLote.categoria,
                    medicamento_tipo: existingLote.tipo,
                    medicamento_dosagem: existingLote.dosagem,
                    lote: existingLote.lote,
                    validade: stockToAdd.validade,
                    responsavel_nome: currentUser?.name || '',
                    responsavel_id: currentUser?.id || '',
                    data: new Date().toISOString(),
                    origem: stockToAdd.origem,
                    doador_nome: (stockToAdd.origem === 'DOADO' || stockToAdd.origem === 'FORNECIDO PELO ESTADO') ? stockToAdd.doador_nome.trim() : '',
                    documento_origem: stockToAdd.documento_origem.trim(),
                    observacoes: `Adição de estoque ${obsProcedencia}`
                });

                showAlert('Estoque adicionado com sucesso!', 'success');
            } else {
                const newMed = await db.createMedicamento({
                    nome: selectedMed.nome,
                    categoria: selectedMed.categoria,
                    quantidade: 0,
                    unidade: selectedMed.unidade,
                    validade: stockToAdd.validade,
                    lote: stockToAdd.lote.toUpperCase(),
                    limite_minimo: selectedMed.limite_minimo,
                    tipo: selectedMed.tipo,
                    dosagem: selectedMed.dosagem,
                    fornecedor: stockToAdd.fornecedor.trim() || selectedMed.fornecedor,
                    principio_ativo: selectedMed.principio_ativo,
                    origem: stockToAdd.origem,
                    doador_nome: (stockToAdd.origem === 'DOADO' || stockToAdd.origem === 'FORNECIDO PELO ESTADO') ? stockToAdd.doador_nome.trim() : '',
                    documento_origem: stockToAdd.documento_origem.trim()
                });

                if (newMed) {
                    await db.registrarMovimentacao({
                        medicamento_id: newMed.id,
                        tipo: 'Entrada',
                        quantidade: qtyNum,
                        medicamento_nome: newMed.nome,
                        medicamento_categoria: newMed.categoria,
                        medicamento_tipo: newMed.tipo,
                        medicamento_dosagem: newMed.dosagem,
                        lote: newMed.lote,
                        validade: newMed.validade,
                        responsavel_nome: currentUser?.name || '',
                        responsavel_id: currentUser?.id || '',
                        data: new Date().toISOString(),
                        origem: stockToAdd.origem,
                        doador_nome: (stockToAdd.origem === 'DOADO' || stockToAdd.origem === 'FORNECIDO PELO ESTADO') ? stockToAdd.doador_nome.trim() : '',
                        documento_origem: stockToAdd.documento_origem.trim(),
                        observacoes: `Cadastro de novo lote ${obsProcedencia}`
                    });
                    showAlert('Novo lote adicionado com sucesso!', 'success');
                }
            }
            setIsAddStockModalOpen(false);
            setStockToAdd(resetStockToAdd(selectedMed));
            loadData(true);
        } catch (error: any) {
            showAlert(error.message || 'Erro ao adicionar estoque.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- STOCK CONTROL / VIEW DETAILS ---

    const handleOpenAjusteManualModal = (lote: FarmaciaMedicamento) => {
        setAjusteLoteTarget(lote);
        setAjusteNovoSaldoInput('');
        setAjusteMotivoInput('');
        setAjusteStep('form');
        setIsAjusteManualModalOpen(true);
    };

    const handleConfirmarAjusteManual = async () => {
        if (!ajusteLoteTarget) return;
        const novoSaldoNum = Number(ajusteNovoSaldoInput);
        if (isNaN(novoSaldoNum) || !Number.isInteger(novoSaldoNum) || novoSaldoNum < 0) {
            showAlert('Informe uma nova quantidade inteira e não negativa (≥ 0).', 'error');
            return;
        }
        if (!ajusteMotivoInput || ajusteMotivoInput.trim().length < 5) {
            showAlert('A justificativa do ajuste é obrigatória (mínimo de 5 caracteres).', 'error');
            return;
        }

        setIsSubmittingAjuste(true);
        try {
            const result = await db.registrarAjusteManualEstoque({
                medicamentoId: ajusteLoteTarget.id,
                saldoEsperadoAnterior: Number(ajusteLoteTarget.quantidade) || 0,
                novoSaldo: novoSaldoNum,
                motivo: ajusteMotivoInput.trim(),
                currentUser: currentUser ? { id: currentUser.id, name: currentUser.name } : undefined
            });

            if (!result.success) {
                showAlert(result.error || 'Erro ao realizar ajuste de estoque.', 'error');
                return;
            }

            showAlert('Ajuste de estoque realizado com sucesso.', 'success');
            setIsAjusteManualModalOpen(false);
            setAjusteLoteTarget(null);
            await loadData(true);
        } catch (err: any) {
            console.error('Erro ao ajustar estoque:', err);
            showAlert(err.message || 'Erro inesperado ao realizar ajuste.', 'error');
        } finally {
            setIsSubmittingAjuste(false);
        }
    };

    const handleOpenAdjustModal = (med: FarmaciaMedicamento) => {
        setSelectedMed(med);
        setIsAdjustModalOpen(true);
    };

    const handleOpenAddStockForGroup = (medReference: FarmaciaMedicamento) => {
        setSelectedMed(medReference);
        setStockToAdd(resetStockToAdd(selectedMed));
        setIsAddStockModalOpen(true);
    };

    const getStockBadgeColor = (med: FarmaciaMedicamento) => {
        if (med.quantidade === 0 && med.lote === 'LOTE-INICIAL') return 'bg-slate-50 text-slate-500 border-slate-200'; // Inativo
        if (med.quantidade === 0) return 'bg-rose-50 text-rose-700 border-rose-100';
        if (med.quantidade <= med.limite_minimo) return 'bg-amber-50 text-amber-700 border-amber-100';
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    };

    const formatDateBr = (d: string) => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length !== 3) return d;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="w-full flex flex-col flex-1 h-full min-h-0 bg-white overflow-hidden animate-in fade-in duration-300">
            {/* Header Unificado na Mesma Linha */}
            <header className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 z-40 shadow-xs">
                {/* Lado Esquerdo: Voltar + Farmácia Popular + Painel de Estoque */}
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-1.5 text-slate-500 hover:text-pink-600 font-bold transition-all p-1.5 pr-3 rounded-full bg-slate-50 hover:bg-pink-50/50 border border-slate-200/60 shadow-xs hover:shadow-sm"
                        title="Voltar ao Menu Farmácia"
                    >
                        <div className="w-6 h-6 rounded-full bg-white border border-slate-200/60 flex items-center justify-center group-hover:border-pink-200 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-pink-600" />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-pink-700">Voltar</span>
                    </button>

                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-pink-50 text-pink-600 shadow-inner">
                            <Pill className="w-5 h-5 text-pink-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight uppercase leading-none">Farmácia Popular</h2>
                                <span className="text-slate-300 font-light hidden sm:inline">|</span>
                                <span className="text-xs md:text-sm font-extrabold text-pink-600 uppercase tracking-tight flex items-center gap-1">
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-pink-500" />
                                    Painel de Estoque
                                </span>
                            </div>
                            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Gestão e dispensação de medicamentos</p>
                        </div>
                    </div>
                </div>

                {/* Lado Direito: Busca + Novo Medicamento + Alerta de Estoque */}
                <div className="flex items-center gap-2.5 flex-1 lg:max-w-3xl justify-end">
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Buscar por medicamento, lote..."
                            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-pink-500 bg-slate-50 focus:bg-white transition-all placeholder:text-slate-400 shadow-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {canCreate && (
                        <button 
                            onClick={handleOpenAddModal}
                            className="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Novo Medicamento</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Grid Container Ocupando a Tela Completa */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white">
                <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-600" />
                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Estoque de Medicamentos por Lote</h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {groupedMedicamentos.length} medicamento(s) listado(s)
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar min-h-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
                            <tr className="border-b border-slate-200/80 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="p-3.5 pl-6">Medicamento / Categoria</th>
                                <th className="p-3.5 text-center">Quantidade</th>
                                <th className="p-3.5 pr-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {paginatedMedicamentos.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center text-slate-400 font-semibold italic">
                                        Nenhum lote ou medicamento encontrado.
                                    </td>
                                </tr>
                            ) : (
                                paginatedMedicamentos.map(med => {
                                    const isExpanded = !!expandedMeds[med.key];
                                    const isAllInativo = med.lotes.every(l => l.quantidade === 0 && l.lote === 'LOTE-INICIAL');
                                    const badgeClass = getStockBadgeColor({
                                        quantidade: med.quantidadeTotal,
                                        limite_minimo: med.limite_minimo,
                                        lote: isAllInativo ? 'LOTE-INICIAL' : ''
                                    } as any);

                                    return (
                                        <React.Fragment key={med.key}>
                                            <tr 
                                                className="hover:bg-slate-50/40 transition-colors border-b border-slate-100 cursor-pointer"
                                                onClick={() => toggleExpand(med.key)}
                                            >
                                                <td className="p-3.5 pl-6">
                                                    <div className="flex items-center gap-2.5">
                                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-pink-600' : ''}`} />
                                                        <div>
                                                            <div className="font-extrabold text-slate-800 uppercase flex items-center gap-2">
                                                                {med.nome}
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                                                {isAllInativo && (
                                                                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-slate-200 text-slate-500">
                                                                        INATIVO
                                                                    </span>
                                                                )}
                                                                <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-slate-800 text-white">
                                                                    Cód: {medicamentCodes[`${med.nome.toUpperCase()} - ${med.dosagem?.toUpperCase() || ''} - ${med.tipo?.toUpperCase() || ''}`] || '00000'}
                                                                </span>
                                                                <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-600">
                                                                    {med.categoria}
                                                                </span>
                                                                {med.principio_ativo && (
                                                                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                        P.Ativo: {med.principio_ativo}
                                                                    </span>
                                                                )}
                                                                {med.dosagem && (
                                                                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-700 border border-pink-100">
                                                                        {med.dosagem}
                                                                    </span>
                                                                )}
                                                                {med.tipo && (
                                                                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-600">
                                                                        {med.tipo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${badgeClass}`}>
                                                        {med.quantidadeTotal} {med.unidade}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 pr-6 text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleOpenAddStockForGroup(med.lotes[0])}
                                                            className="px-2.5 py-1 text-[9px] font-black uppercase bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                                                            title="Adicionar novo lote ou estoque para este medicamento"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            Adicionar Estoque
                                                        </button>
                                                        <button
                                                            onClick={() => toggleExpand(med.key)}
                                                            className="px-2.5 py-1 text-[9px] font-bold uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-350/20 rounded-lg cursor-pointer"
                                                        >
                                                            {isExpanded ? 'Recolher' : `Lotes (${med.lotes.length})`}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50/30">
                                                    <td colSpan={3} className="p-4 pl-12 pr-6">
                                                        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
                                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detalhamento de Lotes e Validades</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Total de {med.lotes.length} lote(s)</span>
                                                            </div>
                                                            <table className="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr className="border-b border-slate-100 text-[8px] font-black text-slate-450 uppercase tracking-wider">
                                                                        <th className="py-2 pl-2">Identificação do Lote</th>
                                                                        <th className="py-2">Origem do Estoque</th>
                                                                        <th className="py-2">Data de Validade</th>
                                                                        <th className="py-2 text-center">Quantidade</th>
                                                                        <th className="py-2 text-right pr-2">Ações</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50 text-[11px] font-semibold text-slate-650">
                                                                    {med.lotes.map(lote => {
                                                                        const isLoteExpired = lote.lote !== 'LOTE-INICIAL' && new Date(lote.validade).getTime() <= Date.now();
                                                                        const loteBadge = getStockBadgeColor(lote);
                                                                        return (
                                                                            <tr key={lote.id} className="hover:bg-slate-50/40">
                                                                                <td className="py-2.5 pl-2 font-mono uppercase text-slate-750 font-bold">{lote.lote}</td>
                                                                                <td className="py-2.5">
                                                                                    {lote.origem === 'COMPRADO' ? (
                                                                                        <span 
                                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/70"
                                                                                            title={lote.documento_origem ? `Documento / NF: ${lote.documento_origem}` : 'Estoque adquirido por compra pública'}
                                                                                        >
                                                                                            <ShoppingBag className="w-2.5 h-2.5 text-sky-600" />
                                                                                            <span>COMPRADO</span>
                                                                                        </span>
                                                                                    ) : lote.origem === 'DOADO' ? (
                                                                                        <span 
                                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                                                                                            title={lote.documento_origem ? `Termo/Ofício: ${lote.documento_origem}` : `Doador: ${lote.doador_nome || 'Não especificado'}`}
                                                                                        >
                                                                                            <HeartHandshake className="w-2.5 h-2.5 text-emerald-600" />
                                                                                            <span className="truncate max-w-[150px]">DOADO — {lote.doador_nome || 'Doação'}</span>
                                                                                        </span>
                                                                                    ) : lote.origem === 'FORNECIDO PELO ESTADO' ? (
                                                                                        <span 
                                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/70"
                                                                                            title={lote.documento_origem ? `Guia/Doc SES: ${lote.documento_origem}` : 'Medicamento fornecido pelo Governo do Estado / SES'}
                                                                                        >
                                                                                            <Building2 className="w-2.5 h-2.5 text-purple-600" />
                                                                                            <span className="truncate max-w-[170px]">FORNECIDO PELO ESTADO</span>
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span 
                                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold text-slate-400 bg-slate-50 border border-slate-200/60"
                                                                                            title="Lote anterior sem procedência registrada"
                                                                                        >
                                                                                            Origem não informada
                                                                                        </span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5">
                                                                                    {lote.lote === 'LOTE-INICIAL' ? '-' : (
                                                                                        <span className={isLoteExpired ? 'text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded' : 'text-slate-650'}>
                                                                                            {formatDateBr(lote.validade)}
                                                                                        </span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5 text-center">
                                                                                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-black border ${loteBadge}`}>
                                                                                        {lote.quantidade} {lote.unidade}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="py-2.5 text-right pr-2">
                                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                                        <button
                                                                                            onClick={() => handleOpenAdjustModal(lote)}
                                                                                            className="px-2 py-0.5 text-[9px] font-black uppercase bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200/40 rounded transition-colors cursor-pointer"
                                                                                            title="Consultar histórico e movimentar este lote"
                                                                                        >
                                                                                            Movimentar
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleOpenAjusteManualModal(lote)}
                                                                                            className="px-2.5 py-0.5 text-[9px] font-black uppercase bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/70 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                                                                            title="Ajustar saldo conferido deste lote físico"
                                                                                        >
                                                                                            <SlidersHorizontal className="w-2.5 h-2.5 text-amber-600" />
                                                                                            <span>Ajustar</span>
                                                                                        </button>
                                                                                        {canEdit && (
                                                                                            <button
                                                                                                onClick={() => handleOpenEditModal(lote)}
                                                                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                                                                                title="Editar dados do lote"
                                                                                            >
                                                                                                <Edit className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                        )}
                                                                                        {canDelete && (
                                                                                            <button
                                                                                                onClick={() => handleDelete(lote.id, lote.nome)}
                                                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                                                                                title="Excluir este lote"
                                                                                            >
                                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200/80 bg-slate-50/60 shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, groupedMedicamentos.length)} de {groupedMedicamentos.length} registros
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-black text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-50 hover:text-pink-600 transition-colors cursor-pointer"
                            >
                                Anterior
                            </button>
                            <span className="text-[11px] font-black text-slate-700 px-2">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-black text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-50 hover:text-pink-600 transition-colors cursor-pointer"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ADD MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-center items-center relative bg-slate-50">
                            <div className="text-center">
                                <h3 className="font-black text-pink-600 uppercase text-xl tracking-wide">Novo Medicamento</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Insira os dados do lote para alimentar o estoque</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="absolute right-5 p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            {/* Linha 1: Nome do Medicamento */}
                            <div className="w-full relative">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome do Medicamento *</label>
                                <input 
                                    type="text" 
                                    className={`w-full rounded-xl border border-slate-200 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase ${
                                        isExistingMed ? 'bg-slate-150 cursor-not-allowed opacity-60 text-slate-500' : 'bg-slate-50'
                                    }`}
                                    placeholder="Ex: PARACETAMOL"
                                    value={nome} 
                                    onChange={e => {
                                        setNome(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    required 
                                    disabled={isExistingMed}
                                />
                                {isExistingMed && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedExistingMed(null);
                                            setNome('');
                                            setDosagemValor('');
                                            setTipo('Comprimido');
                                            setCategoria('CBAF');
                                            setTipoDosagem('mg');
                                            setPrincipioAtivo('');
                                        }}
                                        className="absolute right-2.5 bottom-2.5 text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase bg-white hover:bg-rose-50 px-2 py-1 rounded-lg border border-slate-200 shadow-sm z-10"
                                    >
                                        <X className="w-3 h-3" />
                                        Limpar
                                    </button>
                                )}
                                {showSuggestions && nameSuggestions.length > 0 && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)} />
                                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto py-0.5 animate-in fade-in slide-in-from-top-1 duration-100 divide-y divide-emerald-500/20">
                                            {nameSuggestions.map((sug) => (
                                                <button
                                                    key={`${sug.nome}-${sug.dosagem}-${sug.tipo}`}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedExistingMed(sug);
                                                        setNome(sug.nome);
                                                        if (sug.tipo) setTipo(sug.tipo);
                                                        const parsed = parseDosagem(sug.dosagem);
                                                        setDosagemValor(parsed.valor);
                                                        setTipoDosagem(parsed.tipo);
                                                        setPrincipioAtivo(sug.principio_ativo || '');
                                                        
                                                        const match = medicamentos.find(m => 
                                                            m.nome.toUpperCase() === sug.nome.toUpperCase() &&
                                                            (m.tipo || '').toUpperCase() === sug.tipo.toUpperCase() &&
                                                            (m.dosagem || '').toUpperCase() === sug.dosagem.toUpperCase()
                                                        );
                                                        if (match) {
                                                            setCategoria(match.categoria);
                                                        }
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors uppercase flex justify-between items-center"
                                                >
                                                    <span>{sug.nome} <span className="text-[9px] opacity-75 font-normal ml-1.5 bg-white/20 px-1.5 py-0.5 rounded">(Cód: {sug.codigoSequencial})</span></span>
                                                    <div className="flex items-center gap-1.5">
                                                        {sug.principio_ativo && (
                                                            <span className="text-[8px] opacity-90 font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10 italic">
                                                                P.Ativo: {sug.principio_ativo.toUpperCase()}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] opacity-90 font-bold bg-white/20 px-2 py-0.5 rounded-full">
                                                            {sug.dosagem ? sug.dosagem.toUpperCase() : 'Sem Dosagem'} {sug.tipo ? `• ${sug.tipo.toUpperCase()}` : ''}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Linha 2: Princípio Ativo, Tipo * */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Princípio Ativo</label>
                                    <input 
                                        type="text" 
                                        className={`w-full rounded-xl border border-slate-200 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase ${
                                            isExistingMed ? 'bg-slate-150 cursor-not-allowed opacity-60 text-slate-500' : 'bg-slate-50 text-slate-900'
                                        }`}
                                        placeholder="Ex: DIPIRONA SÓDICA"
                                        value={principioAtivo} 
                                        onChange={e => setPrincipioAtivo(e.target.value)}
                                        disabled={isExistingMed}
                                    />
                                </div>
                                {/* Custom Tipo Select */}
                                <div className={`relative ${isAddTipoOpen ? 'z-50' : ''}`}>
                                    <label className={`block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1 ${isAddTipoOpen ? 'relative z-50' : ''}`}>Forma Farmacêutica *</label>
                                    <div 
                                        onClick={() => {
                                            if (isExistingMed) return;
                                            setIsAddTipoOpen(!isAddTipoOpen);
                                            setIsAddCatOpen(false);
                                            setIsAddTipoDosagemOpen(false);
                                        }}
                                        className={`w-full rounded-xl border border-slate-200 py-3 px-4 text-sm text-slate-900 focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold flex justify-between items-center select-none ${
                                            isExistingMed ? 'bg-slate-150 cursor-not-allowed opacity-60' : 'bg-slate-50 cursor-pointer focus-within:bg-white'
                                        } ${isAddTipoOpen ? 'relative z-50' : ''}`}
                                    >
                                        <span>{tipo}</span>
                                        {!isExistingMed && <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isAddTipoOpen ? 'rotate-90' : ''}`} />}
                                    </div>

                                    {isAddTipoOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={() => setIsAddTipoOpen(false)} />
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 max-h-[14rem] overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                                                {FORMAS_FARMACEUTICAS.map((t) => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => {
                                                            setTipo(t);
                                                            setIsAddTipoOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors flex justify-between items-center ${
                                                            tipo === t ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span className="truncate pr-2">{t}</span>
                                                        {tipo === t && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Linha 4: Dosagem, Tipo Dosagem */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Dosagem (Ex: 500, 10)</label>
                                    <input 
                                        type="text" 
                                        className={`w-full rounded-xl border border-slate-200 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold ${
                                            isExistingMed ? 'bg-slate-150 cursor-not-allowed opacity-60 text-slate-500' : 'bg-slate-50 text-slate-900'
                                        }`}
                                        placeholder="Ex: 500" 
                                        value={dosagemValor} 
                                        onChange={e => setDosagemValor(e.target.value)} 
                                        disabled={isExistingMed}
                                    />
                                </div>
                                <div className={`relative ${isAddTipoDosagemOpen ? 'z-50' : ''}`}>
                                    <label className={`block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1 ${isAddTipoDosagemOpen ? 'relative z-50' : ''}`}>Tipo Dosagem</label>
                                    <div 
                                        onClick={() => {
                                            if (isExistingMed) return;
                                            setIsAddTipoDosagemOpen(!isAddTipoDosagemOpen);
                                            setIsAddCatOpen(false);
                                            setIsAddTipoOpen(false);
                                        }}
                                        className={`w-full rounded-xl border border-slate-200 py-3 px-4 text-sm text-slate-900 focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold flex justify-between items-center select-none ${
                                            isExistingMed ? 'bg-slate-150 cursor-not-allowed opacity-60 text-slate-500' : 'bg-slate-50 cursor-pointer focus-within:bg-white'
                                        } ${isAddTipoDosagemOpen ? 'relative z-50' : ''}`}
                                    >
                                        <span>{tipoDosagem}</span>
                                        {!isExistingMed && <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isAddTipoDosagemOpen ? 'rotate-90' : ''}`} />}
                                    </div>
                                    
                                    {isAddTipoDosagemOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={() => setIsAddTipoDosagemOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 max-h-[14rem] overflow-y-auto py-1 animate-in fade-in slide-in-from-bottom-1 duration-100">
                                                <div className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Sólidos / Outros</div>
                                                {['mcg (µg)', 'mg', 'g', 'kg'].map(t => (
                                                    <button key={t} type="button" onClick={() => { setTipoDosagem(t); setIsAddTipoDosagemOpen(false); }} className={`w-full text-left px-5 py-2 text-xs font-semibold hover:bg-slate-50 flex justify-between items-center ${tipoDosagem === t ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'}`}>
                                                        <span>{t}</span>{tipoDosagem === t && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                                <div className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider mt-1 border-t border-slate-100 pt-3">Líquidos</div>
                                                {['mg/mL', 'g/mL', 'mcg/mL', 'mg/5 mL'].map(t => (
                                                    <button key={t} type="button" onClick={() => { setTipoDosagem(t); setIsAddTipoDosagemOpen(false); }} className={`w-full text-left px-5 py-2 text-xs font-semibold hover:bg-slate-50 flex justify-between items-center ${tipoDosagem === t ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'}`}>
                                                        <span>{t}</span>{tipoDosagem === t && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Linha 5: Categoria * */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Custom Categoria Select */}
                                <div className={`relative ${isAddCatOpen ? 'z-50' : ''}`}>
                                    <label className={`block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1 ${isAddCatOpen ? 'relative z-50' : ''}`}>Categoria *</label>
                                    <div 
                                        onClick={() => {
                                            if (isExistingMed) return;
                                            setIsAddCatOpen(!isAddCatOpen);
                                            setIsAddTipoOpen(false);
                                            setIsAddTipoDosagemOpen(false);
                                        }}
                                        className={`w-full rounded-xl border border-slate-200 py-3 px-4 text-sm text-slate-900 focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold flex justify-between items-center select-none ${
                                            isExistingMed ? 'bg-slate-150 cursor-not-allowed opacity-60' : 'bg-slate-50 cursor-pointer focus-within:bg-white'
                                        } ${isAddCatOpen ? 'relative z-50' : ''}`}
                                    >
                                        <span>
                                            {categoria === 'CBAF' && 'Componente Básico (CBAF)'}
                                            {categoria === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                            {categoria === 'CEAF' && 'Componente Especializado (CEAF)'}
                                        </span>
                                        {!isExistingMed && <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isAddCatOpen ? 'rotate-90' : ''}`} />}
                                    </div>

                                    {isAddCatOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={() => setIsAddCatOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-bottom-1 duration-100">
                                                {(['CBAF', 'CESAF', 'CEAF'] as const).map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => {
                                                            setCategoria(cat);
                                                            setIsAddCatOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors flex justify-between items-center ${
                                                            categoria === cat ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span>
                                                            {cat === 'CBAF' && 'Componente Básico (CBAF)'}
                                                            {cat === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                                            {cat === 'CEAF' && 'Componente Especializado (CEAF)'}
                                                        </span>
                                                        {categoria === cat && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button type="submit" disabled={saving} className="w-full py-3.5 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98">
                                {saving ? 'Salvando...' : 'Cadastrar Medicamento'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-sm tracking-wide">Editar Medicamento</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Modifique os dados cadastrais do lote</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate} className="p-6 space-y-5">
                            {/* Linha 1: Nome do Medicamento */}
                            <div className="w-full relative">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome do Medicamento *</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase" 
                                    value={nome} 
                                    onChange={e => {
                                        setNome(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    required 
                                />
                                {showSuggestions && nameSuggestions.length > 0 && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)} />
                                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto py-0.5 animate-in fade-in slide-in-from-top-1 duration-100 divide-y divide-emerald-500/20">
                                            {nameSuggestions.map((sug) => (
                                                <button
                                                    key={`${sug.nome}-${sug.dosagem}-${sug.tipo}`}
                                                    type="button"
                                                    onClick={() => {
                                                        setNome(sug.nome);
                                                        if (sug.tipo) setTipo(sug.tipo);
                                                        const parsed = parseDosagem(sug.dosagem);
                                                        setDosagemValor(parsed.valor);
                                                        setTipoDosagem(parsed.tipo);
                                                        setPrincipioAtivo(sug.principio_ativo || '');
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors uppercase flex justify-between items-center"
                                                >
                                                    <span>{sug.nome} <span className="text-[9px] opacity-75 font-normal ml-1.5 bg-white/20 px-1.5 py-0.5 rounded">(Cód: {sug.codigoSequencial})</span></span>
                                                    <div className="flex items-center gap-1.5">
                                                        {sug.principio_ativo && (
                                                            <span className="text-[8px] opacity-90 font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10 italic">
                                                                P.Ativo: {sug.principio_ativo.toUpperCase()}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] opacity-90 font-bold bg-white/20 px-2 py-0.5 rounded-full">
                                                            {sug.dosagem ? sug.dosagem.toUpperCase() : 'Sem Dosagem'} {sug.tipo ? `• ${sug.tipo.toUpperCase()}` : ''}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Linha 2: Princípio Ativo, Tipo * */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Princípio Ativo</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase" 
                                        placeholder="Ex: DIPIRONA SÓDICA"
                                        value={principioAtivo} 
                                        onChange={e => setPrincipioAtivo(e.target.value)} 
                                    />
                                </div>
                                {/* Custom Tipo Select */}
                                <div className={`relative ${isEditTipoOpen ? 'z-50' : ''}`}>
                                    <label className={`block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1 ${isEditTipoOpen ? 'relative z-50' : ''}`}>Forma Farmacêutica *</label>
                                    <div 
                                        onClick={() => {
                                            setIsEditTipoOpen(!isEditTipoOpen);
                                            setIsEditCatOpen(false);
                                            setIsEditTipoDosagemOpen(false);
                                        }}
                                        className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus-within:bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer flex justify-between items-center select-none ${isEditTipoOpen ? 'relative z-50' : ''}`}
                                    >
                                        <span>{tipo}</span>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isEditTipoOpen ? 'rotate-90' : ''}`} />
                                    </div>

                                    {isEditTipoOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={() => setIsEditTipoOpen(false)} />
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 max-h-[14rem] overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                                                {FORMAS_FARMACEUTICAS.map((t) => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => {
                                                            setTipo(t);
                                                            setIsEditTipoOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors flex justify-between items-center ${
                                                            tipo === t ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span className="truncate pr-2">{t}</span>
                                                        {tipo === t && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Linha 4: Dosagem, Tipo Dosagem */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Dosagem (Ex: 500, 10)</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        value={dosagemValor} 
                                        onChange={e => setDosagemValor(e.target.value)} 
                                    />
                                </div>
                                <div className={`relative ${isEditTipoDosagemOpen ? 'z-50' : ''}`}>
                                    <label className={`block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1 ${isEditTipoDosagemOpen ? 'relative z-50' : ''}`}>Tipo Dosagem</label>
                                    <div 
                                        onClick={() => {
                                            setIsEditTipoDosagemOpen(!isEditTipoDosagemOpen);
                                            setIsEditCatOpen(false);
                                            setIsEditTipoOpen(false);
                                        }}
                                        className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus-within:bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer flex justify-between items-center select-none ${isEditTipoDosagemOpen ? 'relative z-50' : ''}`}
                                    >
                                        <span>{tipoDosagem}</span>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isEditTipoDosagemOpen ? 'rotate-90' : ''}`} />
                                    </div>
                                    
                                    {isEditTipoDosagemOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={() => setIsEditTipoDosagemOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 max-h-[14rem] overflow-y-auto py-1 animate-in fade-in slide-in-from-bottom-1 duration-100">
                                                <div className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">Sólidos / Outros</div>
                                                {['mcg (µg)', 'mg', 'g', 'kg'].map(t => (
                                                    <button key={t} type="button" onClick={() => { setTipoDosagem(t); setIsEditTipoDosagemOpen(false); }} className={`w-full text-left px-5 py-2 text-xs font-semibold hover:bg-slate-50 flex justify-between items-center ${tipoDosagem === t ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'}`}>
                                                        <span>{t}</span>{tipoDosagem === t && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                                <div className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 tracking-wider mt-1 border-t border-slate-100 pt-3">Líquidos</div>
                                                {['mg/mL', 'g/mL', 'mcg/mL', 'mg/5 mL'].map(t => (
                                                    <button key={t} type="button" onClick={() => { setTipoDosagem(t); setIsEditTipoDosagemOpen(false); }} className={`w-full text-left px-5 py-2 text-xs font-semibold hover:bg-slate-50 flex justify-between items-center ${tipoDosagem === t ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'}`}>
                                                        <span>{t}</span>{tipoDosagem === t && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Linha 5: Categoria * */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Custom Categoria Select */}
                                <div className={`relative ${isEditCatOpen ? 'z-50' : ''}`}>
                                    <label className={`block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1 ${isEditCatOpen ? 'relative z-50' : ''}`}>Categoria *</label>
                                    <div 
                                        onClick={() => {
                                            setIsEditCatOpen(!isEditCatOpen);
                                            setIsEditTipoOpen(false);
                                            setIsEditTipoDosagemOpen(false);
                                        }}
                                        className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus-within:bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer flex justify-between items-center select-none ${isEditCatOpen ? 'relative z-50' : ''}`}
                                    >
                                        <span>
                                            {categoria === 'CBAF' && 'Componente Básico (CBAF)'}
                                            {categoria === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                            {categoria === 'CEAF' && 'Componente Especializado (CEAF)'}
                                        </span>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isEditCatOpen ? 'rotate-90' : ''}`} />
                                    </div>

                                    {isEditCatOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-all" onClick={() => setIsEditCatOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-bottom-1 duration-100">
                                                {(['CBAF', 'CESAF', 'CEAF'] as const).map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => {
                                                            setCategoria(cat);
                                                            setIsEditCatOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors flex justify-between items-center ${
                                                            categoria === cat ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span>
                                                            {cat === 'CBAF' && 'Componente Básico (CBAF)'}
                                                            {cat === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                                            {cat === 'CEAF' && 'Componente Especializado (CEAF)'}
                                                        </span>
                                                        {categoria === cat && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Quantidade e Limite Mínimo */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Quantidade em Estoque *</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        value={quantidade} 
                                        onChange={e => setQuantidade(e.target.value)} 
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Limite Mínimo (Alerta) *</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        value={limiteMinimo} 
                                        onChange={e => setLimiteMinimo(e.target.value)} 
                                        required
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={saving} className="w-full py-3.5 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98">
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* VIEW STOCK DETAILS MODAL */}
            {isAdjustModalOpen && selectedMed && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-wide">
                                    Consulta de Lote
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                    Informações detalhadas do estoque
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsAdjustModalOpen(false)} 
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {/* Medicine Header */}
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-2">
                                <span className="text-[8px] font-black uppercase tracking-wider bg-slate-800 text-white self-start px-2 py-0.5 rounded">
                                    Cód: {medicamentCodes[`${selectedMed.nome.toUpperCase()} - ${selectedMed.dosagem?.toUpperCase() || ''} - ${selectedMed.tipo?.toUpperCase() || ''}`] || '00000'}
                                </span>
                                <h4 className="font-extrabold text-slate-900 text-base uppercase leading-snug">
                                    {selectedMed.nome} {selectedMed.dosagem && <span className="text-pink-600">{selectedMed.dosagem}</span>}
                                </h4>
                                {selectedMed.principio_ativo && (
                                    <div className="text-[10px] text-slate-550 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <span className="text-slate-400">P. Ativo:</span> {selectedMed.principio_ativo}
                                    </div>
                                )}
                                <span className="text-[10px] text-pink-655 font-bold uppercase mt-1">
                                    {selectedMed.categoria === 'CBAF' && 'Componente Básico (CBAF)'}
                                    {selectedMed.categoria === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                    {selectedMed.categoria === 'CEAF' && 'Componente Especializado (CEAF)'}
                                </span>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3.5 flex flex-col justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Quantidade</span>
                                    <span className="text-lg font-black text-slate-800">
                                        {selectedMed.quantidade} <span className="text-[11px] font-bold text-slate-450">{selectedMed.unidade}</span>
                                    </span>
                                </div>

                                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3.5 flex flex-col justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Tipo</span>
                                    <span className="text-sm font-extrabold text-slate-700 uppercase">
                                        {selectedMed.tipo || 'Comprimido'}
                                    </span>
                                </div>

                                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3.5 flex flex-col justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Lote</span>
                                    <span className="text-sm font-bold font-mono text-slate-600 uppercase">
                                        {selectedMed.lote}
                                    </span>
                                </div>

                                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3.5 flex flex-col justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Validade</span>
                                    {selectedMed.lote === 'LOTE-INICIAL' ? (
                                        <span className="text-sm font-bold text-slate-400">
                                            -
                                        </span>
                                    ) : (
                                        <span className={`text-sm font-bold ${
                                            new Date(selectedMed.validade).getTime() <= Date.now() 
                                                ? 'text-rose-500' 
                                                : 'text-slate-700'
                                        }`}>
                                            {formatDateBr(selectedMed.validade)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Card de Procedência e Origem do Lote */}
                            <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Origem e Procedência</span>
                                    {selectedMed.origem === 'COMPRADO' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                                            <ShoppingBag className="w-3 h-3 text-sky-600" />
                                            COMPRADO
                                        </span>
                                    ) : selectedMed.origem === 'DOADO' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            <HeartHandshake className="w-3 h-3 text-emerald-600" />
                                            DOADO
                                        </span>
                                    ) : selectedMed.origem === 'FORNECIDO PELO ESTADO' ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                                            <Building2 className="w-3 h-3 text-purple-600" />
                                            FORNECIDO PELO ESTADO
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 bg-slate-200/70">
                                            Origem não informada
                                        </span>
                                    )}
                                </div>

                                {selectedMed.origem === 'DOADO' && (
                                    <div className="text-[11px] pt-1 border-t border-slate-200/60 grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Doador / Entidade</span>
                                            <span className="font-extrabold text-slate-800 block truncate">{selectedMed.doador_nome || 'Não especificado'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Termo / Ofício</span>
                                            <span className="font-semibold text-slate-700 block truncate">{selectedMed.documento_origem || 'Não anexado'}</span>
                                        </div>
                                    </div>
                                )}

                                {selectedMed.origem === 'COMPRADO' && (
                                    <div className="text-[11px] pt-1 border-t border-slate-200/60 grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Documento / NF</span>
                                            <span className="font-semibold text-slate-800 block truncate">{selectedMed.documento_origem || 'Não informado'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Fornecedor</span>
                                            <span className="font-semibold text-slate-700 block truncate">{selectedMed.fornecedor || 'Padrão da Farmácia'}</span>
                                        </div>
                                    </div>
                                )}

                                {selectedMed.origem === 'FORNECIDO PELO ESTADO' && (
                                    <div className="text-[11px] pt-1 border-t border-slate-200/60 grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Esfera / Órgão</span>
                                            <span className="font-extrabold text-slate-800 block truncate">{selectedMed.doador_nome || 'Governo do Estado / SES'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Guia de Remessa / Doc</span>
                                            <span className="font-semibold text-slate-700 block truncate">{selectedMed.documento_origem || 'Remessa Estadual Regular'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Warning or Status banner */}
                            {(selectedMed.lote !== 'LOTE-INICIAL' && new Date(selectedMed.validade).getTime() <= Date.now()) ? (
                                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 flex items-start gap-2.5 text-[10px] font-semibold text-rose-700">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <span>Este lote está vencido e não deve ser dispensado aos pacientes. Promova o descarte correto do estoque.</span>
                                </div>
                            ) : selectedMed.quantidade === 0 ? (
                                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 flex items-start gap-2.5 text-[10px] font-semibold text-rose-700">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <span>Este lote está zerado (sem unidades disponíveis no estoque atual).</span>
                                </div>
                            ) : selectedMed.quantidade <= selectedMed.limite_minimo ? (
                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex items-start gap-2.5 text-[10px] font-semibold text-amber-700">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span>Estoque em nível crítico (igual ou menor que o limite de alerta estabelecido de {selectedMed.limite_minimo} unidades).</span>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-start gap-2.5 text-[10px] font-semibold text-emerald-700">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>Lote em situação regular. Estoque disponível e validade vigente.</span>
                                </div>
                            )}

                            {selectedMed.fornecedor && (
                                <div className="text-[10px] text-slate-400 font-semibold italic text-center">
                                    Fornecedor registrado: {selectedMed.fornecedor}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                            <button
                                onClick={() => {
                                    setIsAdjustModalOpen(false);
                                    setStockToAdd(resetStockToAdd(selectedMed));
                                    setIsAddStockModalOpen(true);
                                }}
                                className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Adicionar Estoque
                            </button>
                            <button
                                onClick={() => setIsAdjustModalOpen(false)}
                                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-98"
                            >
                                Fechar Consulta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD STOCK MODAL */}
            {isAddStockModalOpen && selectedMed && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-wide">
                                    Adicionar Estoque
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                    {selectedMed.nome}
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsAddStockModalOpen(false)} 
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateStock} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5 ml-1">Lote *</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase" 
                                    placeholder="Ex: LOTE123"
                                    value={stockToAdd.lote} 
                                    onChange={e => setStockToAdd({...stockToAdd, lote: e.target.value})} 
                                    required 
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5 ml-1">Validade *</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase" 
                                    value={stockToAdd.validade} 
                                    onChange={e => setStockToAdd({...stockToAdd, validade: e.target.value})} 
                                    required 
                                />
                            </div>

                            {/* SELETOR COMPACTO: ORIGEM DO ESTOQUE */}
                            <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/90">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 ml-0.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <span>ORIGEM DO ESTOQUE *</span>
                                    </span>
                                    {!stockToAdd.origem && (
                                        <span className="text-[9px] font-bold text-pink-600 lowercase bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200/50">
                                            seleção obrigatória
                                        </span>
                                    )}
                                </label>

                                {/* Seletor compacto Comprado vs Doado vs Fornecido pelo Estado */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setStockToAdd({ ...stockToAdd, origem: 'COMPRADO' })}
                                        className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            stockToAdd.origem === 'COMPRADO'
                                                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                                        <span>Comprado</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setStockToAdd({ ...stockToAdd, origem: 'DOADO' })}
                                        className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            stockToAdd.origem === 'DOADO'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        <Gift className="w-3.5 h-3.5 shrink-0" />
                                        <span>Doado</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setStockToAdd({ ...stockToAdd, origem: 'FORNECIDO PELO ESTADO' })}
                                        className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer text-center ${
                                            stockToAdd.origem === 'FORNECIDO PELO ESTADO'
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                        }`}
                                        title="Medicamento fornecido pelo Governo do Estado / SES"
                                    >
                                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>Fornecido pelo Estado</span>
                                    </button>
                                </div>

                                {/* Campos dinâmicos quando Comprado */}
                                {stockToAdd.origem === 'COMPRADO' && (
                                    <div className="pt-2.5 space-y-2 border-t border-slate-200 animate-in fade-in duration-200">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                Processo / Nota Fiscal / Empenho (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: NF 45892 / Processo 120/2026"
                                                value={stockToAdd.documento_origem}
                                                onChange={e => setStockToAdd({ ...stockToAdd, documento_origem: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-sky-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                Fornecedor / Distribuidor (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: União Química Farmacêutica"
                                                value={stockToAdd.fornecedor}
                                                onChange={e => setStockToAdd({ ...stockToAdd, fornecedor: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-sky-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Campos dinâmicos quando Doado */}
                                {stockToAdd.origem === 'DOADO' && (
                                    <div className="pt-2.5 space-y-2 border-t border-slate-200 animate-in fade-in duration-200">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-emerald-800 mb-1 flex items-center justify-between">
                                                <span>MUNICÍPIO OU ENTIDADE DOADORA *</span>
                                                <span className="text-[9px] font-bold text-emerald-600">Obrigatório</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Município de Ipatinga / Rotary / SES-MG"
                                                value={stockToAdd.doador_nome}
                                                onChange={e => setStockToAdd({ ...stockToAdd, doador_nome: e.target.value })}
                                                required
                                                className="w-full rounded-xl border border-emerald-300 bg-white py-2 px-3 text-xs font-semibold text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
                                            />
                                            <p className="text-[9px] text-slate-400 mt-1">
                                                Identifique a prefeitura, secretaria, instituição ou entidade responsável pela doação.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                                Termo de Doação / Ofício / Documento (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Ofício nº 145/2026 / Termo de Repasse 02"
                                                value={stockToAdd.documento_origem}
                                                onChange={e => setStockToAdd({ ...stockToAdd, documento_origem: e.target.value })}
                                                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-emerald-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Campos dinâmicos quando Fornecido pelo Estado */}
                                {stockToAdd.origem === 'FORNECIDO PELO ESTADO' && (
                                    <div className="pt-2.5 space-y-2 border-t border-slate-200 animate-in fade-in duration-200">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-purple-800 mb-1">
                                                Guia de Remessa / Nota de Fornecimento Estadual / Processo SES (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Guia SES nº 841/2026 / Remessa Estadual / Ofício GRS"
                                                value={stockToAdd.documento_origem}
                                                onChange={e => setStockToAdd({ ...stockToAdd, documento_origem: e.target.value })}
                                                className="w-full rounded-xl border border-purple-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-purple-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-purple-800 mb-1">
                                                Órgão Estadual / Regional de Saúde (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: SES-MG / Farmácia de Minas / GRS Coronel Fabriciano"
                                                value={stockToAdd.doador_nome}
                                                onChange={e => setStockToAdd({ ...stockToAdd, doador_nome: e.target.value })}
                                                className="w-full rounded-xl border border-purple-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-purple-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5 ml-1">Quantidade *</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                    placeholder="Ex: 100"
                                    value={stockToAdd.quantidade} 
                                    onChange={e => setStockToAdd({...stockToAdd, quantidade: e.target.value})} 
                                    required 
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={saving || !stockToAdd.origem || (stockToAdd.origem === 'DOADO' && !stockToAdd.doador_nome.trim())} 
                                className="w-full mt-4 py-3.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
                            >
                                {saving ? 'Adicionando...' : 'Confirmar Adição'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL MODERNO DE AJUSTE MANUAL DE ESTOQUE POR LOTE */}
            {isAjusteManualModalOpen && ajusteLoteTarget && (() => {
                const saldoAtual = Number(ajusteLoteTarget.quantidade) || 0;
                const novoSaldoNum = ajusteNovoSaldoInput === '' ? NaN : Number(ajusteNovoSaldoInput);
                const isValidNovoSaldo = !isNaN(novoSaldoNum) && Number.isInteger(novoSaldoNum) && novoSaldoNum >= 0;
                const diferenca = isValidNovoSaldo ? novoSaldoNum - saldoAtual : 0;
                const tipoAjuste = diferenca > 0 ? 'Aumento de estoque' : diferenca < 0 ? 'Redução de estoque' : 'Sem alteração';
                const podeAvancar = isValidNovoSaldo && diferenca !== 0 && ajusteMotivoInput.trim().length >= 5;
                const medKey = `${ajusteLoteTarget.nome.toUpperCase()} - ${ajusteLoteTarget.dosagem?.toUpperCase() || ''} - ${ajusteLoteTarget.tipo?.toUpperCase() || ''}`;
                const codigoMed = medicamentCodes[medKey] || '00000';

                return (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden border border-slate-200/90 flex flex-col animate-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="p-4 sm:p-5 border-b border-amber-100 flex justify-between items-center bg-amber-50/60 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                                        <SlidersHorizontal className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 uppercase text-xs sm:text-sm tracking-wide">
                                            Ajuste Manual de Estoque por Lote
                                        </h3>
                                        <p className="text-[10px] text-amber-700 font-bold uppercase mt-0.5 flex items-center gap-1">
                                            <span>Correção de saldo físico conferido</span>
                                            <span className="text-amber-400">•</span>
                                            <span>Auditoria ativa</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isSubmittingAjuste) {
                                            setIsAjusteManualModalOpen(false);
                                            setAjusteLoteTarget(null);
                                        }
                                    }}
                                    disabled={isSubmittingAjuste}
                                    className="p-1.5 hover:bg-amber-100 rounded-xl text-slate-500 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 text-xs">
                                {/* Card de Identificação do Medicamento e Lote */}
                                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-black uppercase tracking-wider bg-slate-800 text-white px-2 py-0.5 rounded">
                                            Cód: {codigoMed}
                                        </span>
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-pink-100/80 text-pink-700 border border-pink-200/50">
                                            {ajusteLoteTarget.categoria}
                                        </span>
                                    </div>

                                    <div>
                                        <h4 className="font-black text-slate-900 text-base uppercase leading-snug">
                                            {ajusteLoteTarget.nome}{' '}
                                            {ajusteLoteTarget.dosagem && <span className="text-pink-600">{ajusteLoteTarget.dosagem}</span>}
                                        </h4>
                                        {ajusteLoteTarget.principio_ativo && (
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                                                <span className="text-slate-400">P. Ativo:</span> {ajusteLoteTarget.principio_ativo}
                                            </p>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-slate-200/60 grid grid-cols-4 gap-2 text-[10px]">
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-black uppercase text-slate-400 block">Lote</span>
                                            <span className="font-mono font-bold text-slate-700 uppercase truncate block">
                                                {ajusteLoteTarget.lote}
                                            </span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-black uppercase text-slate-400 block">Origem</span>
                                            <span className="font-extrabold text-slate-800 block truncate">
                                                {ajusteLoteTarget.origem === 'COMPRADO' ? 'COMPRADO' : ajusteLoteTarget.origem === 'DOADO' ? `DOADO (${ajusteLoteTarget.doador_nome || 'Doador'})` : ajusteLoteTarget.origem === 'FORNECIDO PELO ESTADO' ? 'FORNECIDO PELO ESTADO' : 'Não informada'}
                                            </span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-black uppercase text-slate-400 block">Validade</span>
                                            <span className="font-bold text-slate-700 block">
                                                {formatDateBr(ajusteLoteTarget.validade)}
                                            </span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-black uppercase text-slate-400 block">Saldo Registrado</span>
                                            <span className="font-black text-slate-900 block">
                                                {saldoAtual} {ajusteLoteTarget.unidade}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {ajusteStep === 'form' ? (
                                    <>
                                        {/* Campo: Novo Saldo Total Correto */}
                                        <div className="space-y-1.5">
                                            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                                                Nova Quantidade Correta (Estoque Físico Conferido) *
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={ajusteNovoSaldoInput}
                                                onChange={(e) => setAjusteNovoSaldoInput(e.target.value)}
                                                placeholder="Ex: 6400"
                                                disabled={isSubmittingAjuste}
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-base font-black text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                                                required
                                            />
                                            <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">
                                                Informe o <strong>saldo total real</strong> apurado na contagem física deste lote. A diferença será calculada pelo sistema automaticamente.
                                            </p>
                                        </div>

                                        {/* Área de Conferência Visual em Tempo Real */}
                                        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                                                Conferência Visual Antes e Depois
                                            </span>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                                <div className="p-2.5 bg-white rounded-xl border border-slate-150 shadow-2xs">
                                                    <span className="text-[8px] font-black uppercase text-slate-400 block">Estoque Anterior</span>
                                                    <span className="text-sm font-black text-slate-700">{saldoAtual}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">{ajusteLoteTarget.unidade}</span>
                                                </div>
                                                <div className="p-2.5 bg-white rounded-xl border border-slate-150 shadow-2xs">
                                                    <span className="text-[8px] font-black uppercase text-slate-400 block">Novo Estoque</span>
                                                    <span className="text-sm font-black text-slate-900">
                                                        {isValidNovoSaldo ? novoSaldoNum : '—'}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">{ajusteLoteTarget.unidade}</span>
                                                </div>
                                                <div className={`p-2.5 rounded-xl border shadow-2xs ${
                                                    !isValidNovoSaldo || diferenca === 0 
                                                        ? 'bg-slate-100/70 border-slate-200 text-slate-500' 
                                                        : diferenca > 0 
                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                                            : 'bg-rose-50 border-rose-200 text-rose-700'
                                                }`}>
                                                    <span className="text-[8px] font-black uppercase block opacity-80">Diferença</span>
                                                    <span className="text-sm font-black">
                                                        {isValidNovoSaldo ? (diferenca > 0 ? `+${diferenca}` : `${diferenca}`) : '—'}
                                                    </span>
                                                    <span className="text-[9px] font-bold opacity-80 uppercase block">{ajusteLoteTarget.unidade}</span>
                                                </div>
                                                <div className={`p-2.5 rounded-xl border shadow-2xs flex flex-col justify-center ${
                                                    !isValidNovoSaldo || diferenca === 0 
                                                        ? 'bg-slate-100/70 border-slate-200 text-slate-500' 
                                                        : diferenca > 0 
                                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                                            : 'bg-amber-50 border-amber-200 text-amber-800'
                                                }`}>
                                                    <span className="text-[8px] font-black uppercase block opacity-80">Tipo de Ajuste</span>
                                                    <span className="text-[10px] font-extrabold uppercase leading-tight mt-0.5">
                                                        {isValidNovoSaldo ? tipoAjuste : '—'}
                                                    </span>
                                                </div>
                                            </div>

                                            {isValidNovoSaldo && diferenca === 0 && (
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50/90 border border-amber-200 p-2 rounded-xl mt-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                    <span>O novo estoque é idêntico ao saldo atual. Informe uma quantidade diferente para realizar o ajuste.</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Campo: Justificativa Obrigatória */}
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                                <span>Justificativa do Ajuste *</span>
                                                <span className="text-[9px] font-bold text-slate-400 lowercase">mínimo 5 caracteres</span>
                                            </label>
                                            <textarea
                                                rows={2}
                                                placeholder="Informe o motivo da correção do estoque..."
                                                value={ajusteMotivoInput}
                                                onChange={(e) => setAjusteMotivoInput(e.target.value)}
                                                disabled={isSubmittingAjuste}
                                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-400 resize-none shadow-2xs"
                                                required
                                            />
                                            {/* Chips de sugestão rápida */}
                                            <div className="flex flex-wrap items-center gap-1 pt-1">
                                                <span className="text-[8px] font-black uppercase text-slate-400 mr-0.5">Sugestões:</span>
                                                {[
                                                    'Conferência física do estoque',
                                                    'Correção de divergência de inventário',
                                                    'Correção de lançamento anterior',
                                                    'Perda identificada',
                                                    'Ajuste decorrente de avaria'
                                                ].map((sug) => (
                                                    <button
                                                        key={sug}
                                                        type="button"
                                                        onClick={() => setAjusteMotivoInput(sug)}
                                                        className="px-2 py-0.5 text-[8px] font-bold uppercase rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 border border-slate-200/80 transition-colors cursor-pointer"
                                                    >
                                                        + {sug}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* ETAPA 2: CONFERÊNCIA FINAL E CONFIRMAÇÃO */
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold flex items-start gap-2">
                                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <span>
                                                Atenção: Por favor, confira atentamente os dados abaixo antes de aplicar a alteração definitiva no banco de dados. Esta operação é permanente e auditada.
                                            </span>
                                        </div>

                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-1">
                                                Resumo da Operação de Ajuste
                                            </span>

                                            <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                <div>
                                                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Medicamento</span>
                                                    <span className="font-extrabold text-slate-800 uppercase block truncate">
                                                        {ajusteLoteTarget.nome}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Lote Afetado</span>
                                                    <span className="font-mono font-bold text-slate-800 uppercase block">
                                                        {ajusteLoteTarget.lote}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Saldo Anterior</span>
                                                    <span className="font-black text-slate-700 block">
                                                        {saldoAtual} {ajusteLoteTarget.unidade}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold uppercase text-slate-400 block">Novo Saldo Aplicado</span>
                                                    <span className="font-black text-slate-900 block">
                                                        {novoSaldoNum} {ajusteLoteTarget.unidade}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-2.5 rounded-xl bg-white border border-slate-150 flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Diferença Efetiva:</span>
                                                <span className={`text-xs font-black ${diferenca > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {diferenca > 0 ? `+${diferenca}` : diferenca} {ajusteLoteTarget.unidade} ({tipoAjuste})
                                                </span>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-[8px] font-bold uppercase text-slate-400 block">Justificativa:</span>
                                                <p className="text-[10px] font-semibold text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-150">
                                                    "{ajusteMotivoInput}"
                                                </p>
                                            </div>

                                            <div className="text-[9px] text-slate-400 font-bold uppercase flex items-center justify-between pt-1">
                                                <span>Responsável:</span>
                                                <span className="text-slate-600">{currentUser?.name || 'Operador Autorizado'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5 shrink-0">
                                {ajusteStep === 'form' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setIsAjusteManualModalOpen(false)}
                                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!podeAvancar}
                                            onClick={() => setAjusteStep('confirm')}
                                            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-pink-600 hover:from-amber-700 hover:to-pink-700 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                                        >
                                            <span>Confirmar Ajuste</span>
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setAjusteStep('form')}
                                            disabled={isSubmittingAjuste}
                                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                            Voltar e Corrigir
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isSubmittingAjuste}
                                            onClick={handleConfirmarAjusteManual}
                                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                                        >
                                            {isSubmittingAjuste ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Aplicando Ajuste...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span>Sim, Aplicar Ajuste Agora</span>
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
};
