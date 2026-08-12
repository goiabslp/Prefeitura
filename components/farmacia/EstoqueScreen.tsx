import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import { Package, Plus, Edit, Trash2, Calendar, AlertTriangle, ChevronRight, CheckCircle2, TrendingUp, Info, Loader2, Sparkles, SlidersHorizontal, X, XCircle, Search } from 'lucide-react';
import * as db from '../../services/farmaciaService';
import { useFarmaciaAlert } from './FarmaciaAlertContext';
import { RAW_MEDS } from './medsToImportData';
import { getMedsToImport } from './medsToImport';

const FORMAS_FARMACEUTICAS = [
  'Adesivo transdérmico', 'Aerossol oral', 'Cápsula', 'Cápsula de liberação prolongada', 'Cápsula de liberação retardada', 'Cápsula gelatinosa dura', 'Cápsula inalatória', 'Cápsula mole', 'Cápsula para inalação oral', 'Comprimido', 'Comprimido de liberação prolongada', 'Comprimido de liberação retardada', 'Comprimido dispersível', 'Comprimido mastigável', 'Comprimido orodispersível', 'Comprimido para suspensão', 'Comprimido para suspensão oral', 'Comprimido para uso tópico', 'Comprimido revestido', 'Comprimido solúvel', 'Comprimido sublingual', 'Comprimido vaginal', 'Comprimidos dispersíveis', 'Creme', 'Creme dermatológico', 'Creme vaginal', 'Dispositivo intrauterino (DIU)', 'Elixir', 'Emulsão oral', 'Enema', 'Frasco-ampola', 'Gel', 'Gel oral', 'Gel vaginal', 'Goma de mascar', 'Granulado oral', 'Granulado para suspensão oral', 'Granulado revestido de liberação prolongada', 'Grânulo para suspensão oral', 'Grânulos revestidos', 'Implante', 'Loção', 'Óleo para uso oral', 'Óvulo vaginal', 'Pasta', 'Pastilha', 'Pó', 'Pó estéril para solução injetável', 'Pó inalatório', 'Pó liofilizado para solução injetável', 'Pó liofilizado para solução para infusão', 'Pó liofilizado para suspensão injetável de liberação prolongada', 'Pó liófilizado para injetável', 'Pó para dispersão oral', 'Pó para inalação', 'Pó para inalação oral', 'Pó para solução injetável', 'Pó para solução oral', 'Pó para solução para infusão', 'Pó para solução para infusão e inalação', 'Pó para suspensão injetável', 'Pó para suspensão injetável de liberação prolongada', 'Pó para suspensão oral', 'Pomada', 'Pomada oftálmica', 'Solução', 'Solução aerossol', 'Solução bucal', 'Solução capilar', 'Solução inalatória', 'Solução injetável', 'Solução injetável de liberação prolongada', 'Solução injetável depot', 'Solução nasal', 'Solução oftálmica', 'Solução oral', 'Solução otológica', 'Solução para diluição para infusão', 'Solução para infusão', 'Solução para inalação', 'Solução para uso tópico', 'Solução retal', 'Solução spray', 'Solução spray nasal', 'Solução tópica', 'Suspensão aerossol', 'Suspensão injetável', 'Suspensão injetável de liberação prolongada', 'Suspensão injetável intratecal ou intrabrônquica', 'Suspensão oftálmica', 'Suspensão oral', 'Suspensão para inalação nasal', 'Tintura', 'Unidade', 'Xampu'
];

interface EstoqueScreenProps {
    currentUser?: User | null;
    onBack: () => void;
    appState: any;
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
    onBack
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
    const [stockToAdd, setStockToAdd] = useState({ lote: '', validade: '', quantidade: '' });

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


    // Permissions
    const isAdmin = currentUser?.role === 'admin';
    const canCreate = currentUser?.permissions?.includes('parent_farmacia_criar') || isAdmin;
    const canEdit = currentUser?.permissions?.includes('parent_farmacia_editar') || isAdmin;
    const canDelete = currentUser?.permissions?.includes('parent_farmacia_excluir') || isAdmin;
    const canApprove = currentUser?.permissions?.includes('parent_farmacia_aprovar') || isAdmin;

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
        const withdrawals = movimentacoes.filter(m => m.tipo === 'Saída');
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
            showAlert('Preencha os campos obrigatórios.', 'error');
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
            if (existingLote) {
                await db.updateMedicamento(existingLote.id, {
                    validade: stockToAdd.validade
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
                    observacoes: 'Adição de estoque'
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
                    fornecedor: selectedMed.fornecedor,
                    principio_ativo: selectedMed.principio_ativo
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
                        observacoes: 'Cadastro de novo lote'
                    });
                    showAlert('Novo lote adicionado com sucesso!', 'success');
                }
            }
            setIsAddStockModalOpen(false);
            setStockToAdd({ lote: '', validade: '', quantidade: '' });
            loadData(true);
        } catch (error: any) {
            showAlert(error.message || 'Erro ao adicionar estoque.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- STOCK CONTROL / VIEW DETAILS ---

    const handleOpenAdjustModal = (med: FarmaciaMedicamento) => {
        setSelectedMed(med);
        setIsAdjustModalOpen(true);
    };

    const handleOpenAddStockForGroup = (medReference: FarmaciaMedicamento) => {
        setSelectedMed(medReference);
        setStockToAdd({ lote: '', validade: '', quantidade: '' });
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
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-slate-50/20 rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden animate-in fade-in duration-300">
            {/* Main Action Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-pink-600" />
                    <h3 className="font-extrabold text-slate-800 text-sm md:text-base uppercase tracking-tight">Painel de Estoque</h3>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto justify-end">
                    <div className="relative w-full sm:w-[520px]">
                        <input
                            type="text"
                            placeholder="Buscar por medicamento, lote..."
                            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-pink-500 bg-slate-50 focus:bg-white transition-all placeholder:text-slate-400"
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
                            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Medicamento
                        </button>
                    )}
                </div>
            </div>

            {/* Lote List Container */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
                <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col w-full">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-slate-700" />
                        <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Estoque de Medicamentos por Lote</h4>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                    <th className="p-3">Medicamento / Categoria</th>
                                    <th className="p-3 text-center">Quantidade</th>
                                    <th className="p-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                {paginatedMedicamentos.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-slate-400 font-semibold italic">
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
                                                    className="hover:bg-slate-50/20 transition-colors border-b border-slate-100 cursor-pointer"
                                                    onClick={() => toggleExpand(med.key)}
                                                >
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
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
                                                    <td className="p-3 text-center">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${badgeClass}`}>
                                                            {med.quantidadeTotal} {med.unidade}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleOpenAddStockForGroup(med.lotes[0])}
                                                                className="px-2.5 py-1 text-[9px] font-black uppercase bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center gap-1 shadow-sm transition-all"
                                                                title="Adicionar novo lote ou estoque para este medicamento"
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                                Adicionar Estoque
                                                            </button>
                                                            <button
                                                                onClick={() => toggleExpand(med.key)}
                                                                className="px-2.5 py-1 text-[9px] font-bold uppercase bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-350/20 rounded-lg"
                                                            >
                                                                {isExpanded ? 'Recolher' : `Lotes (${med.lotes.length})`}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/20">
                                                        <td colSpan={3} className="p-4 pl-12">
                                                            <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-xs space-y-3">
                                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detalhamento de Lotes e Validades</span>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Total de {med.lotes.length} lote(s)</span>
                                                                </div>
                                                                <table className="w-full text-left border-collapse">
                                                                    <thead>
                                                                        <tr className="border-b border-slate-100 text-[8px] font-black text-slate-450 uppercase tracking-wider">
                                                                            <th className="py-2 pl-2">Identificação do Lote</th>
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
                                                                                    <td className="py-2.5 pl-2 font-mono uppercase text-slate-750">{lote.lote}</td>
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
                                                                                                className="px-2 py-0.5 text-[9px] font-black uppercase bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200/40 rounded transition-colors"
                                                                                                title="Ajustar ou movimentar este lote específico"
                                                                                            >
                                                                                                Movimentar
                                                                                            </button>
                                                                                            {canEdit && (
                                                                                                <button
                                                                                                    onClick={() => handleOpenEditModal(lote)}
                                                                                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                                                                                                    title="Editar dados do lote"
                                                                                                >
                                                                                                    <Edit className="w-3.5 h-3.5" />
                                                                                                </button>
                                                                                            )}
                                                                                            {canDelete && (
                                                                                                <button
                                                                                                    onClick={() => handleDelete(lote.id, lote.nome)}
                                                                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
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
                        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, groupedMedicamentos.length)} de {groupedMedicamentos.length} registros
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-black text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-50 hover:text-pink-600 transition-colors"
                                >
                                    Anterior
                                </button>
                                <span className="text-[11px] font-black text-slate-700 px-2">
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-black text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-50 hover:text-pink-600 transition-colors"
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>
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
                                    setStockToAdd({ lote: '', validade: '', quantidade: '' });
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
                        <form onSubmit={handleCreateStock} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Lote *</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase" 
                                    placeholder="Ex: LOTE123"
                                    value={stockToAdd.lote} 
                                    onChange={e => setStockToAdd({...stockToAdd, lote: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Validade *</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase" 
                                    value={stockToAdd.validade} 
                                    onChange={e => setStockToAdd({...stockToAdd, validade: e.target.value})} 
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Quantidade *</label>
                                <input 
                                    type="number" 
                                    min="1"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                    placeholder="Ex: 100"
                                    value={stockToAdd.quantidade} 
                                    onChange={e => setStockToAdd({...stockToAdd, quantidade: e.target.value})} 
                                    required 
                                />
                            </div>
                            <button type="submit" disabled={saving} className="w-full mt-4 py-3.5 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98">
                                {saving ? 'Adicionando...' : 'Confirmar Adição'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
