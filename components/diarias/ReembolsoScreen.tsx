import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from '../../types';
import {
  ArrowLeft, FileText, CheckCircle2, Download, UserCheck, Calendar as CalendarIcon,
  CreditCard, Banknote, ShieldAlert, Sparkles, ChevronRight, ChevronLeft, Clock,
  MapPin, Printer, Plus, Trash2, Edit3, Paperclip, Eye, Search, AlertCircle,
  FileCheck, DollarSign, X, Check, UploadCloud, RefreshCw, FileQuestion
} from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { getPersons, getJobs } from '../../services/entityService';
import { supabase } from '../../services/supabaseClient';
import { getGlobalSettings } from '../../services/settingsService';
import { uploadFile } from '../../services/storageService';
import {
  SolicitacaoReembolso,
  DespesaReembolso,
  ComprovanteDespesa,
  getSolicitacoesReembolso,
  saveSolicitacaoReembolso,
  updateStatusReembolso,
  deleteSolicitacaoReembolso
} from '../../services/reembolsoService';
import {
  formatarMoedaBRL,
  parseMoedaBRL,
  numeroParaMoedaPorExtenso,
  somarDespesas
} from '../../utils/currencyUtils';

interface ReembolsoScreenProps {
  currentUser?: User | null;
  onBack: () => void;
}

type TabType = 'dados' | 'descricao' | 'despesas' | 'anexos';

const TAB_ROUTES: Record<TabType, string> = {
  dados: '/Diarias/Reembolso/Dados',
  descricao: '/Diarias/Reembolso/Descricao',
  despesas: '/Diarias/Reembolso/Despesas',
  anexos: '/Diarias/Reembolso/Anexos'
};

const TABS: { id: TabType; label: string; icon: any; num: number }[] = [
  { id: 'dados', label: '1. Dados', icon: UserCheck, num: 1 },
  { id: 'descricao', label: '2. Descrição', icon: FileText, num: 2 },
  { id: 'despesas', label: '3. Despesas', icon: Banknote, num: 3 },
  { id: 'anexos', label: '4. Anexos', icon: Paperclip, num: 4 }
];

export const ReembolsoScreen: React.FC<ReembolsoScreenProps> = ({
  currentUser,
  onBack
}) => {
  const { addNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoReembolso[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  // Modo: 'lista' (Dashboard / Histórico) ou 'formulario' (Nova Solicitação / Edição)
  const isFormRoute = () => {
    if (typeof window === 'undefined') return false;
    const p = window.location.pathname.toLowerCase();
    return p.includes('/dados') || p.includes('/descricao') || p.includes('/despesas') || p.includes('/anexos') || p.includes('/novo');
  };

  const [mode, setMode] = useState<'lista' | 'formulario'>(isFormRoute() ? 'formulario' : 'lista');

  // Detecta aba inicial pela URL
  const getTabFromUrl = (): TabType => {
    if (typeof window === 'undefined') return 'dados';
    const p = window.location.pathname.toLowerCase();
    if (p.includes('/descricao')) return 'descricao';
    if (p.includes('/despesas')) return 'despesas';
    if (p.includes('/anexos')) return 'anexos';
    return 'dados';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromUrl);

  // Logo Oficial do Sistema
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [municipioNome, setMunicipioNome] = useState<string>('Prefeitura Municipal');

  // Servidores do sistema para autocomplete
  const [servidores, setServidores] = useState<{ id: string; name: string; cargo?: string; cpf?: string; setor?: string }[]>([]);

  // Estados do Formulário
  const [servidorNome, setServidorNome] = useState(currentUser?.name || '');
  const [servidorCpf, setServidorCpf] = useState('');
  const [servidorMatricula, setServidorMatricula] = useState('');
  const [servidorCargo, setServidorCargo] = useState(currentUser?.jobTitle || '');
  const [servidorSetor, setServidorSetor] = useState(currentUser?.sector || '');

  // Dados Bancários
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [tipoConta, setTipoConta] = useState('Corrente');
  const [pix, setPix] = useState('');

  // Viagem e Itinerário
  const [destino, setDestino] = useState('');
  const [dataViagemInicio, setDataViagemInicio] = useState('');
  const [dataViagemFim, setDataViagemFim] = useState('');
  const [motivo, setMotivo] = useState('');

  // Lançamentos de Despesas
  const [despesas, setDespesas] = useState<DespesaReembolso[]>([]);

  // Estado para cadastro/edição individual de despesa
  const [editingDespesaIndex, setEditingDespesaIndex] = useState<number | null>(null);
  const [despesaDescricao, setDespesaDescricao] = useState('');
  const [despesaValorStr, setDespesaValorStr] = useState('');
  const [despesaData, setDespesaData] = useState(new Date().toISOString().split('T')[0]);
  const [despesaComprovantes, setDespesaComprovantes] = useState<ComprovanteDespesa[]>([]);
  const [isUploadingComprovante, setIsUploadingComprovante] = useState(false);
  const [isDespesaModalOpen, setIsDespesaModalOpen] = useState(false);

  // Anexos gerais adicionais
  const [anexosGerais, setAnexosGerais] = useState<ComprovanteDespesa[]>([]);

  // Modais de Resumo e Detalhes
  const [showResumoModal, setShowResumoModal] = useState(false);
  const [selectedSolicitacaoDetalhes, setSelectedSolicitacaoDetalhes] = useState<SolicitacaoReembolso | null>(null);
  const [submittedData, setSubmittedData] = useState<SolicitacaoReembolso | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const geralFileInputRef = useRef<HTMLInputElement>(null);

  // Carrega lista inicial de reembolsos e servidores
  const loadData = async () => {
    try {
      setLoading(true);
      const list = await getSolicitacoesReembolso();
      setSolicitacoes(list);

      const [personsData, jobsData] = await Promise.all([
        getPersons(),
        getJobs()
      ]);

      const jobMap = new Map<string, string>();
      jobsData.forEach(j => {
        if (j.id && j.name) jobMap.set(j.id, j.name);
      });

      const servs = personsData.map(p => ({
        id: p.id,
        name: p.name,
        cargo: jobMap.get(p.jobId || '') || p.jobId || '',
        cpf: (p as any).cpf || '',
        setor: (p as any).sector || ''
      }));

      setServidores(servs);
    } catch (err) {
      console.warn('Erro ao carregar dados de reembolso:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    async function loadBranding() {
      try {
        const settings = await getGlobalSettings();
        if (settings?.branding?.logoUrl) {
          setLogoUrl(settings.branding.logoUrl);
        } else if (settings?.ui?.headerLogoUrl) {
          setLogoUrl(settings.ui.headerLogoUrl);
        }
        const muni = (settings as any)?.municipio || (settings as any)?.institutionName || (settings as any)?.branding?.institutionName;
        if (muni) {
          setMunicipioNome(muni);
        }
      } catch (err) {
        console.warn('Erro ao carregar branding:', err);
      }
    }
    loadBranding();

    const handlePopState = () => {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/dados') || p.includes('/descricao') || p.includes('/despesas') || p.includes('/anexos') || p.includes('/novo')) {
        setMode('formulario');
        setActiveTab(getTabFromUrl());
      } else {
        setMode('lista');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('reembolso_updated', loadData);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('reembolso_updated', loadData);
    };
  }, []);

  // Sincronização de rotas com URL
  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    const targetRoute = TAB_ROUTES[tab];
    if (window.location.pathname !== targetRoute) {
      window.history.pushState({}, '', targetRoute);
    }
  };

  const handleOpenNewForm = () => {
    setMode('formulario');
    setActiveTab('dados');
    setDespesas([]);
    setSubmittedData(null);
    window.history.pushState({}, '', '/Diarias/Reembolso/Dados');
  };

  const handleBackToList = () => {
    setMode('lista');
    window.history.pushState({}, '', '/Diarias/Reembolso');
  };

  // Cálculo automático do total em tempo real com precisão de centavos
  const totalReembolso = useMemo(() => {
    return somarDespesas(despesas);
  }, [despesas]);

  const totalReembolsoExtenso = useMemo(() => {
    return numeroParaMoedaPorExtenso(totalReembolso);
  }, [totalReembolso]);

  // Cálculos do Dashboard Consolidado
  const dashboardStats = useMemo(() => {
    let solicitado = 0;
    let aprovado = 0;
    let pendente = 0;
    let rejeitado = 0;

    let countSolicitado = 0;
    let countAprovado = 0;
    let countPendente = 0;
    let countRejeitado = 0;

    solicitacoes.forEach(s => {
      const v = Number(s.valorTotal) || 0;
      solicitado += v;
      countSolicitado++;

      if (s.status === 'aprovado' || s.status === 'pago') {
        aprovado += v;
        countAprovado++;
      } else if (s.status === 'rejeitado') {
        rejeitado += v;
        countRejeitado++;
      } else {
        pendente += v;
        countPendente++;
      }
    });

    return {
      solicitado: Math.round(solicitado * 100) / 100,
      aprovado: Math.round(aprovado * 100) / 100,
      pendente: Math.round(pendente * 100) / 100,
      rejeitado: Math.round(rejeitado * 100) / 100,
      countSolicitado,
      countAprovado,
      countPendente,
      countRejeitado
    };
  }, [solicitacoes]);

  // Filtros da Listagem
  const solicitacoesFiltradas = useMemo(() => {
    return solicitacoes.filter(s => {
      const matchSearch = (s.protocol || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.servidorNome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.motivo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.destino || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchSearch) return false;

      if (filterStatus === 'todos') return true;
      return s.status === filterStatus;
    });
  }, [solicitacoes, searchTerm, filterStatus]);

  // Autocomplete do Servidor
  const handleSelectServidor = (nome: string) => {
    setServidorNome(nome);
    const found = servidores.find(s => s.name.toLowerCase() === nome.toLowerCase());
    if (found) {
      if (found.cargo) setServidorCargo(found.cargo);
      if (found.cpf) setServidorCpf(found.cpf);
      if (found.setor) setServidorSetor(found.setor);
    }
  };

  // Upload de Comprovante de Despesa
  const handleUploadComprovante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingComprovante(true);
    try {
      const uploadedList: ComprovanteDespesa[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const publicUrl = await uploadFile(file, 'attachments', `reembolsos/${Date.now()}_${file.name}`);
        uploadedList.push({
          id: `comp-${Date.now()}-${i}`,
          name: file.name,
          url: publicUrl || URL.createObjectURL(file),
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        });
      }
      setDespesaComprovantes(prev => [...prev, ...uploadedList]);
      addNotification('Sucesso', `${uploadedList.length} comprovante(s) anexado(s) com sucesso!`, 'success');
    } catch (err: any) {
      addNotification('Erro', `Falha ao anexar comprovante: ${err.message}`, 'error');
    } finally {
      setIsUploadingComprovante(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Upload de Anexo Geral
  const handleUploadAnexoGeral = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const uploadedList: ComprovanteDespesa[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const publicUrl = await uploadFile(file, 'attachments', `reembolsos_gerais/${Date.now()}_${file.name}`);
        uploadedList.push({
          id: `anx-${Date.now()}-${i}`,
          name: file.name,
          url: publicUrl || URL.createObjectURL(file),
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        });
      }
      setAnexosGerais(prev => [...prev, ...uploadedList]);
      addNotification('Sucesso', `${uploadedList.length} anexo(s) adicionado(s)!`, 'success');
    } catch (err: any) {
      addNotification('Erro', `Falha no envio de anexo: ${err.message}`, 'error');
    } finally {
      if (geralFileInputRef.current) geralFileInputRef.current.value = '';
    }
  };

  // Salvar despesa na lista (Adicionar ou Editar)
  const handleSaveDespesa = () => {
    const desc = despesaDescricao.trim();
    if (!desc) {
      addNotification('Aviso', 'A descrição da despesa é obrigatória.', 'warning');
      return;
    }

    const valor = parseMoedaBRL(despesaValorStr);
    if (isNaN(valor) || valor <= 0) {
      addNotification('Aviso', 'Informe um valor válido e superior a zero.', 'warning');
      return;
    }

    const novaDespesa: DespesaReembolso = {
      id: editingDespesaIndex !== null ? despesas[editingDespesaIndex].id : `desp-${Date.now()}`,
      descricao: desc,
      valor: Math.round(valor * 100) / 100,
      dataDespesa: despesaData || new Date().toISOString().split('T')[0],
      comprovantes: despesaComprovantes
    };

    if (editingDespesaIndex !== null) {
      const updated = [...despesas];
      updated[editingDespesaIndex] = novaDespesa;
      setDespesas(updated);
      addNotification('Sucesso', 'Despesa atualizada com sucesso!', 'success');
    } else {
      setDespesas(prev => [...prev, novaDespesa]);
      addNotification('Sucesso', 'Despesa adicionada com sucesso!', 'success');
    }

    // Resetar form de despesa
    setDespesaDescricao('');
    setDespesaValorStr('');
    setDespesaData(new Date().toISOString().split('T')[0]);
    setDespesaComprovantes([]);
    setEditingDespesaIndex(null);
    setIsDespesaModalOpen(false);
  };

  const handleEditDespesa = (index: number) => {
    const d = despesas[index];
    setEditingDespesaIndex(index);
    setDespesaDescricao(d.descricao);
    setDespesaValorStr(d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setDespesaData(d.dataDespesa);
    setDespesaComprovantes(d.comprovantes || []);
    setIsDespesaModalOpen(true);
  };

  const handleRemoveDespesa = (index: number) => {
    const updated = despesas.filter((_, i) => i !== index);
    setDespesas(updated);
    addNotification('Info', 'Despesa removida.', 'info');
  };

  // Validação geral antes de abrir o Resumo
  const handleValidateBeforeSubmit = () => {
    if (!servidorNome.trim()) {
      addNotification('Aviso', 'Por favor, informe o nome do servidor solicitante.', 'warning');
      switchTab('dados');
      return;
    }
    if (!motivo.trim()) {
      addNotification('Aviso', 'Por favor, preencha a descrição/motivo do reembolso na aba Descrição.', 'warning');
      switchTab('descricao');
      return;
    }
    if (despesas.length === 0) {
      addNotification('Aviso', 'É obrigatório registrar pelo menos uma despesa na aba Despesas.', 'warning');
      switchTab('despesas');
      return;
    }

    setShowResumoModal(true);
  };

  // Gravação final e geração de PDF
  const handleConfirmFinalSubmit = async () => {
    try {
      setLoading(true);

      const novaSolicitacao = await saveSolicitacaoReembolso({
        servidorId: currentUser?.id || '',
        servidorNome: servidorNome.trim(),
        servidorCpf: servidorCpf.trim(),
        servidorMatricula: servidorMatricula.trim(),
        servidorCargo: servidorCargo.trim(),
        servidorSetor: servidorSetor.trim(),
        dadosBancarios: {
          banco: banco.trim(),
          agencia: agencia.trim(),
          conta: conta.trim(),
          tipoConta: tipoConta,
          pix: pix.trim()
        },
        destino: destino.trim(),
        dataViagemInicio,
        dataViagemFim,
        motivo: motivo.trim(),
        despesas,
        anexosGerais,
        status: 'pendente'
      });

      setSubmittedData(novaSolicitacao);
      setShowResumoModal(false);
      addNotification('Sucesso', 'Solicitação de Reembolso registrada e demonstrativo gerado com sucesso!', 'success');
      await loadData();
    } catch (err: any) {
      addNotification('Erro', err.message || 'Erro ao registrar solicitação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // GERAÇÃO E IMPRESSÃO DO DOCUMENTO OFICIAL DE REEMBOLSO COM DEMONSTRATIVO DE DESPESAS
  const handlePrintOfficialPDF = (solicitacao?: SolicitacaoReembolso | null) => {
    const target = solicitacao || submittedData;
    if (!target) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addNotification('Erro', 'Bloqueador de pop-ups impediu a impressão. Permita pop-ups no navegador.', 'error');
      return;
    }

    const dataSolicitacaoFormatted = new Date(target.createdAt).toLocaleDateString('pt-BR');
    const valorTotalFormatado = formatarMoedaBRL(target.valorTotal);
    const valorExtenso = target.valorTotalExtenso || numeroParaMoedaPorExtenso(target.valorTotal);

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Solicitação de Reembolso de Despesas - ${target.protocol}</title>
      <style>
        * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .page {
          width: 210mm;
          min-height: 297mm;
          padding: 16mm 14mm 20mm 14mm;
          margin: 0 auto;
          box-sizing: border-box;
          position: relative;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 14px;
        }
        .header-title {
          font-size: 14px;
          font-weight: 900;
          text-transform: uppercase;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .header-subtitle {
          font-size: 9.5px;
          color: #64748b;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 1px;
        }
        .protocol-badge {
          font-family: monospace;
          font-size: 11px;
          font-weight: 800;
          background: #f1f5f9;
          color: #1e293b;
          padding: 5px 12px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          text-align: right;
        }
        .section-box {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 12px;
          background: #ffffff;
        }
        .section-header {
          background: #f8fafc;
          padding: 5px 12px;
          border-bottom: 1px solid #cbd5e1;
          font-size: 8.5pt;
          font-weight: 900;
          text-transform: uppercase;
          color: #1e293b;
          letter-spacing: 0.05em;
        }
        .section-content {
          padding: 8px 12px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .grid-4 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 8px;
        }
        .field-label {
          font-size: 7pt;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 2px;
        }
        .field-value {
          font-size: 8.5pt;
          font-weight: 700;
          color: #0f172a;
        }
        /* TABELA DO DEMONSTRATIVO DE DESPESAS */
        table.demonstrativo {
          width: 100%;
          border-collapse: collapse;
          margin-top: 4px;
        }
        table.demonstrativo th {
          background: #f1f5f9;
          color: #334155;
          font-size: 7.5pt;
          font-weight: 900;
          text-transform: uppercase;
          padding: 6px 8px;
          border: 1px solid #cbd5e1;
          text-align: left;
        }
        table.demonstrativo td {
          font-size: 8pt;
          padding: 6px 8px;
          border: 1px solid #cbd5e1;
          color: #0f172a;
        }
        table.demonstrativo tr:nth-child(even) {
          background: #f8fafc;
        }
        table.demonstrativo .total-row {
          background: #e2e8f0;
          font-weight: 900;
        }
        table.demonstrativo .total-row td {
          font-weight: 900;
          font-size: 8.5pt;
          border-top: 2px solid #0f172a;
        }
        .extenso-box {
          background: #f8fafc;
          border-left: 3px solid #4f46e5;
          padding: 6px 10px;
          margin-top: 8px;
          font-size: 8pt;
          font-weight: 700;
          color: #1e1b4b;
        }
        .comprovantes-list {
          margin-top: 6px;
          font-size: 7.5pt;
          color: #475569;
        }
        .comprovante-item {
          padding: 2px 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 25px;
          page-break-inside: avoid;
        }
        .signature-box {
          border-top: 1px solid #0f172a;
          padding-top: 6px;
          text-align: center;
        }
        .signature-name {
          font-size: 8.5pt;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
        }
        .signature-role {
          font-size: 7.5pt;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 1px;
        }
        .footer-note {
          font-size: 7pt;
          color: #94a3b8;
          text-align: center;
          margin-top: 15px;
          border-top: 1px dashed #e2e8f0;
          padding-top: 5px;
        }
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page { width: 100%; min-height: 100vh; padding: 14mm 14mm; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- HEADER INSTITUCIONAL -->
        <div class="header">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height: 52px; width: auto; object-fit: contain;" />` : ''}
            <div>
              <div class="header-title">${municipioNome}</div>
              <div class="header-subtitle">Processo de Gestão de Diárias & Reembolsos</div>
              <div style="font-size: 11pt; font-weight: 900; color: #4338ca; margin-top: 2px; text-transform: uppercase;">
                Solicitação de Reembolso de Despesas
              </div>
            </div>
          </div>
          <div class="protocol-badge">
            <div style="font-size: 7pt; color: #64748b; text-transform: uppercase;">Protocolo Oficial</div>
            <div>${target.protocol}</div>
            <div style="font-size: 7.5pt; font-weight: 700; color: #475569; margin-top: 2px;">Data: ${dataSolicitacaoFormatted}</div>
          </div>
        </div>

        <!-- 1. IDENTIFICAÇÃO DO SERVIDOR SOLICITANTE -->
        <div class="section-box">
          <div class="section-header">1. Identificação do Servidor Solicitante</div>
          <div class="section-content">
            <div class="grid-3" style="margin-bottom: 6px;">
              <div>
                <div class="field-label">Nome Completo</div>
                <div class="field-value">${target.servidorNome}</div>
              </div>
              <div>
                <div class="field-label">Cargo / Função</div>
                <div class="field-value">${target.servidorCargo || 'Não informado'}</div>
              </div>
              <div>
                <div class="field-label">Setor / Secretaria</div>
                <div class="field-value">${target.servidorSetor || 'Não informado'}</div>
              </div>
            </div>
            <div class="grid-3">
              <div>
                <div class="field-label">CPF</div>
                <div class="field-value">${target.servidorCpf || 'Não informado'}</div>
              </div>
              <div>
                <div class="field-label">Matrícula</div>
                <div class="field-value">${target.servidorMatricula || '---'}</div>
              </div>
              <div>
                <div class="field-label">Status do Reembolso</div>
                <div class="field-value" style="color: ${target.status === 'aprovado' ? '#15803d' : target.status === 'rejeitado' ? '#b91c1c' : '#b45309'}; text-transform: uppercase;">
                  ${target.status}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. DADOS BANCÁRIOS PARA CRÉDITO -->
        <div class="section-box">
          <div class="section-header">2. Dados Bancários Para Pagamento do Reembolso</div>
          <div class="section-content">
            <div class="grid-4">
              <div>
                <div class="field-label">Banco</div>
                <div class="field-value">${target.dadosBancarios?.banco || 'Não informado'}</div>
              </div>
              <div>
                <div class="field-label">Agência</div>
                <div class="field-value">${target.dadosBancarios?.agencia || '---'}</div>
              </div>
              <div>
                <div class="field-label">Conta (${target.dadosBancarios?.tipoConta || 'Corrente'})</div>
                <div class="field-value">${target.dadosBancarios?.conta || '---'}</div>
              </div>
              <div>
                <div class="field-label">Chave PIX</div>
                <div class="field-value">${target.dadosBancarios?.pix || '---'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. MOTIVO E CONTEXTO DA VIAGEM / SERVIÇO -->
        <div class="section-box">
          <div class="section-header">3. Motivo e Justificativa das Despesas</div>
          <div class="section-content">
            <div class="grid-2" style="margin-bottom: 6px;">
              <div>
                <div class="field-label">Destino / Itinerário</div>
                <div class="field-value">${target.destino || 'Deslocamento oficial'}</div>
              </div>
              <div>
                <div class="field-label">Período da Viagem / Deslocamento</div>
                <div class="field-value">
                  ${target.dataViagemInicio ? new Date(target.dataViagemInicio + 'T12:00:00').toLocaleDateString('pt-BR') : '---'} 
                  ${target.dataViagemFim ? `até ${new Date(target.dataViagemFim + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                </div>
              </div>
            </div>
            <div>
              <div class="field-label">Justificativa Detalhada</div>
              <div class="field-value" style="font-weight: 500; font-size: 8pt; line-height: 1.4; white-space: pre-wrap;">${target.motivo || 'Reembolso referente a despesas necessárias incorridas no cumprimento de atribuições do serviço público municipal.'}</div>
            </div>
          </div>
        </div>

        <!-- 4. DEMONSTRATIVO DE DESPESAS (SEÇÃO EXIGIDA PELO PROMPT) -->
        <div class="section-box">
          <div class="section-header" style="background: #eef2ff; color: #3730a3; border-bottom: 1.5px solid #c7d2fe;">
            4. Demonstrativo de Despesas
          </div>
          <div class="section-content">
            <table class="demonstrativo">
              <thead>
                <tr>
                  <th style="width: 38px; text-align: center;">Nº</th>
                  <th>Descrição da Despesa</th>
                  <th style="width: 85px; text-align: center;">Data</th>
                  <th style="width: 110px; text-align: center;">Comprovantes</th>
                  <th style="width: 100px; text-align: right;">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                ${target.despesas.map((d, index) => {
                  const numStr = String(index + 1).padStart(2, '0');
                  const dataFormatada = d.dataDespesa ? new Date(d.dataDespesa + 'T12:00:00').toLocaleDateString('pt-BR') : '---';
                  const compCount = d.comprovantes?.length || 0;
                  return `
                    <tr>
                      <td style="text-align: center; font-weight: 800; font-family: monospace;">${numStr}</td>
                      <td style="font-weight: 600;">${d.descricao}</td>
                      <td style="text-align: center;">${dataFormatada}</td>
                      <td style="text-align: center; font-size: 7.5pt; color: #475569;">
                        ${compCount > 0 ? `${compCount} anexo(s) vinculado(s)` : '<span style="color: #94a3b8;">Sem anexo</span>'}
                      </td>
                      <td style="text-align: right; font-weight: 800; font-family: monospace;">${formatarMoedaBRL(d.valor)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr class="total-row">
                  <td colspan="4" style="text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">
                    TOTAL SOLICITADO:
                  </td>
                  <td style="text-align: right; color: #1e1b4b; font-size: 9.5pt;">
                    ${valorTotalFormatado}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- VALOR POR EXTENSO EM DESTAQUE -->
            <div class="extenso-box">
              <strong>Valor total solicitado:</strong> ${valorTotalFormatado} (${valorExtenso}).
            </div>

            ${target.despesas.some(d => d.comprovantes && d.comprovantes.length > 0) ? `
              <div class="comprovantes-list">
                <div style="font-weight: 800; text-transform: uppercase; margin-top: 6px; color: #334155; font-size: 7pt;">
                  Relação de Comprovantes Anexados:
                </div>
                ${target.despesas.map((d, idx) => {
                  if (!d.comprovantes || d.comprovantes.length === 0) return '';
                  return `
                    <div style="margin-top: 2px;">
                      <strong>Despesa ${String(idx + 1).padStart(2, '0')} (${d.descricao}):</strong>
                      ${d.comprovantes.map(c => `<span style="margin-left: 4px; font-family: monospace;">📎 ${c.name}</span>`).join(', ')}
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- TERMO DE DECLARAÇÃO -->
        <div style="font-size: 7pt; color: #475569; line-height: 1.35; margin-top: 4px; padding: 6px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
          Declaro para os devidos fins de direito que as despesas acima discriminadas foram efetivamente realizadas no desempenho de funções estritamente ligadas ao serviço público deste Município, responsabilizando-me pela veracidade das informações e pela idoneidade dos comprovantes fiscais apresentados.
        </div>

        <!-- ASSINATURAS INSTITUCIONAIS -->
        <div class="signatures-grid">
          <div class="signature-box">
            <div class="signature-name">${target.servidorNome}</div>
            <div class="signature-role">Servidor Solicitante</div>
            <div style="font-size: 7pt; color: #94a3b8; margin-top: 2px;">Assinado em: ${dataSolicitacaoFormatted}</div>
          </div>
          <div class="signature-box">
            <div class="signature-name">${target.aprovadoPor || 'Autoridade Competente / Gestor'}</div>
            <div class="signature-role">Aprovação Administrativa / Controle Interno</div>
            <div style="font-size: 7pt; color: #94a3b8; margin-top: 2px;">
              ${target.status === 'aprovado' ? `Aprovado em: ${target.aprovadoEm ? new Date(target.aprovadoEm).toLocaleDateString('pt-BR') : dataSolicitacaoFormatted}` : 'Visto da Chefia Imediata'}
            </div>
          </div>
        </div>

        <div class="footer-note">
          Documento emitido eletronicamente pelo Sistema de Gestão Integrada da Prefeitura Municipal — Autenticidade garantida por chave digital de protocolo.
        </div>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const isAdminOrGestor = currentUser?.role === 'admin' || (currentUser as any)?.role === 'gestor' || currentUser?.role === 'contabilidade';

  return (
    <div className="w-full h-full flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-slate-50 text-slate-800 pb-12">
      {/* CABEÇALHO SUPERIOR - 100% DA LARGURA */}
      <div className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (mode === 'formulario') {
                  handleBackToList();
                } else {
                  onBack();
                }
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-95"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Diárias & Custeio
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-bold text-slate-500">Módulo de Reembolso</span>
              </div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                {mode === 'formulario' ? 'Nova Solicitação de Reembolso' : 'Controle & Histórico de Reembolsos'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'lista' ? (
              <button
                onClick={handleOpenNewForm}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Solicitação</span>
              </button>
            ) : (
              <button
                onClick={handleBackToList}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                <span>Ver Histórico</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full flex-1 px-4 sm:px-6 lg:px-8 xl:px-10 mt-5">
        {mode === 'lista' ? (
          /* ========================================================================= */
          /* MODO LISTA: DASHBOARD COM INDICADORES CONSOLIDADOS E TABELA DE HISTÓRICO   */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* CARDS DE INDICADORES CONSOLIDADOS (ITEM 6 DO PROMPT) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Solicitado */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Total Solicitado
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                    {formatarMoedaBRL(dashboardStats.solicitado)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                    <span className="font-bold text-indigo-600">{dashboardStats.countSolicitado}</span> solicitações registradas
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500"></div>
              </div>

              {/* Card 2: Total Aprovado */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Total Aprovado
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
                    {formatarMoedaBRL(dashboardStats.aprovado)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                    <span className="font-bold text-emerald-600">{dashboardStats.countAprovado}</span> reembolsos deferidos
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
              </div>

              {/* Card 3: Total Pendente */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Total Pendente
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-amber-700 font-mono tracking-tight">
                    {formatarMoedaBRL(dashboardStats.pendente)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                    <span className="font-bold text-amber-600">{dashboardStats.countPendente}</span> aguardando autorização
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
              </div>

              {/* Card 4: Total Rejeitado */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Total Rejeitado
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-rose-700 font-mono tracking-tight">
                    {formatarMoedaBRL(dashboardStats.rejeitado)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                    <span className="font-bold text-rose-600">{dashboardStats.countRejeitado}</span> pedidos indeferidos
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500"></div>
              </div>
            </div>

            {/* BARRA DE FILTROS E BUSCA */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por protocolo, servidor ou motivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 whitespace-nowrap">Filtrar:</span>
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'pendente', label: 'Pendentes' },
                  { id: 'aprovado', label: 'Aprovados' },
                  { id: 'rejeitado', label: 'Rejeitados' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setFilterStatus(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      filterStatus === opt.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TABELA DE SOLICITAÇÕES COM COLUNA "VALOR SOLICITADO" (ITEM 6) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Solicitações de Reembolso ({solicitacoesFiltradas.length})
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">
                  Valores solicitados não são considerados como despesas pagas até quitação definitiva
                </span>
              </div>

              {solicitacoesFiltradas.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <FileQuestion className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Nenhuma solicitação encontrada</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {searchTerm || filterStatus !== 'todos'
                      ? 'Nenhum reembolso corresponde aos filtros selecionados.'
                      : 'Nenhuma solicitação de reembolso foi cadastrada até o momento.'}
                  </p>
                  <button
                    onClick={handleOpenNewForm}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    <Plus className="w-4 h-4" /> Cadastrar Primeira Solicitação
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-black border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Protocolo</th>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Servidor / Cargo</th>
                        <th className="py-3 px-4 text-center">Despesas</th>
                        <th className="py-3 px-4 text-right bg-indigo-50/50 text-indigo-950 font-black">
                          Valor Solicitado
                        </th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {solicitacoesFiltradas.map((sol) => (
                        <tr key={sol.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                            {sol.protocol}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {new Date(sol.createdAt).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{sol.servidorNome}</div>
                            <div className="text-[10px] text-slate-500">{sol.servidorCargo || sol.servidorSetor || 'Servidor Municipal'}</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {sol.despesas.length} {sol.despesas.length === 1 ? 'item' : 'itens'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-sm text-slate-900 bg-indigo-50/30">
                            {formatarMoedaBRL(sol.valorTotal)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {sol.status === 'aprovado' || sol.status === 'pago' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Aprovado
                              </span>
                            ) : sol.status === 'rejeitado' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertCircle className="w-3 h-3" /> Rejeitado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" /> Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedSolicitacaoDetalhes(sol)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Ver Detalhes do Demonstrativo"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handlePrintOfficialPDF(sol)}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Imprimir / Baixar Demonstrativo PDF"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {isAdminOrGestor && sol.status === 'pendente' && (
                                <>
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Deseja aprovar o reembolso do protocolo ${sol.protocol}?`)) {
                                        await updateStatusReembolso(sol.id, 'aprovado', undefined, currentUser?.name);
                                        addNotification('Sucesso', 'Reembolso aprovado!', 'success');
                                      }
                                    }}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    title="Aprovar Reembolso"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const just = prompt('Informe a justificativa da rejeição:');
                                      if (just) {
                                        await updateStatusReembolso(sol.id, 'rejeitado', just, currentUser?.name);
                                        addNotification('Info', 'Reembolso rejeitado.', 'info');
                                      }
                                    }}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Rejeitar Reembolso"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {isAdminOrGestor && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`Tem certeza que deseja excluir o reembolso ${sol.protocol}?`)) {
                                      await deleteSolicitacaoReembolso(sol.id);
                                      addNotification('Sucesso', 'Registro excluído.', 'success');
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Excluir Solicitação"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* MODO FORMULÁRIO: 4 ABAS COM ROTAS URL ESPECÍFICAS (ITEM 1 DO PROMPT)      */
          /* ========================================================================= */
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* NAVEGAÇÃO POR ABAS COM ROTA URL ATUALIZADA */}
            <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6">
              <div className="flex space-x-2 sm:space-x-4 overflow-x-auto py-3 custom-scrollbar">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => switchTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* ---------------- ABA 1: DADOS ---------------- */}
              {activeTab === 'dados' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Identificação do Servidor & Dados Bancários</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Informe os dados do servidor solicitante e a conta bancária para crédito do reembolso.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        Nome do Servidor *
                      </label>
                      <input
                        type="text"
                        list="servidores-list"
                        value={servidorNome}
                        onChange={(e) => handleSelectServidor(e.target.value)}
                        placeholder="Digite ou selecione o servidor..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <datalist id="servidores-list">
                        {servidores.map(s => <option key={s.id} value={s.name} />)}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        Cargo / Função
                      </label>
                      <input
                        type="text"
                        value={servidorCargo}
                        onChange={(e) => setServidorCargo(e.target.value)}
                        placeholder="Ex: Motorista, Fiscal, Secretário..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        CPF do Servidor
                      </label>
                      <input
                        type="text"
                        value={servidorCpf}
                        onChange={(e) => setServidorCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        Setor / Secretaria
                      </label>
                      <input
                        type="text"
                        value={servidorSetor}
                        onChange={(e) => setServidorSetor(e.target.value)}
                        placeholder="Ex: Secretaria de Saúde, Obras..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Dados Bancários */}
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      Conta para Pagamento do Reembolso
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                          Banco
                        </label>
                        <input
                          type="text"
                          value={banco}
                          onChange={(e) => setBanco(e.target.value)}
                          placeholder="Ex: Banco do Brasil"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                          Agência
                        </label>
                        <input
                          type="text"
                          value={agencia}
                          onChange={(e) => setAgencia(e.target.value)}
                          placeholder="0000-0"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                          Conta
                        </label>
                        <input
                          type="text"
                          value={conta}
                          onChange={(e) => setConta(e.target.value)}
                          placeholder="00000-0"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                          Chave PIX
                        </label>
                        <input
                          type="text"
                          value={pix}
                          onChange={(e) => setPix(e.target.value)}
                          placeholder="CPF, E-mail ou Telefone"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => switchTab('descricao')}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                    >
                      <span>Avançar para Descrição</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- ABA 2: DESCRIÇÃO ---------------- */}
              {activeTab === 'descricao' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Finalidade & Contexto da Despesa</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Descreva a viagem ou serviço oficial que originou a necessidade do reembolso.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        Destino da Viagem / Local do Serviço
                      </label>
                      <input
                        type="text"
                        value={destino}
                        onChange={(e) => setDestino(e.target.value)}
                        placeholder="Ex: Belo Horizonte / MG"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={dataViagemInicio}
                        onChange={(e) => setDataViagemInicio(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        Data de Término
                      </label>
                      <input
                        type="date"
                        value={dataViagemFim}
                        onChange={(e) => setDataViagemFim(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      Justificativa / Descrição do Motivo do Reembolso *
                    </label>
                    <textarea
                      rows={5}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Descreva detalhadamente o motivo da solicitação de reembolso, serviço prestado, reuniões ou necessidades extraordinárias atendidas durante o deslocamento oficial..."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => switchTab('dados')}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <button
                      onClick={() => switchTab('despesas')}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                    >
                      <span>Avançar para Despesas</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- ABA 3: DESPESAS (SEÇÃO CENTRAL DO PROMPT) ---------------- */}
              {activeTab === 'despesas' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <span>Lançamento Detalhado de Despesas</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {despesas.length} {despesas.length === 1 ? 'lançamento' : 'lançamentos'}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Registre cada gasto individualmente com descrição, valor, data e comprovantes fiscais vinculados.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setEditingDespesaIndex(null);
                        setDespesaDescricao('');
                        setDespesaValorStr('');
                        setDespesaData(new Date().toISOString().split('T')[0]);
                        setDespesaComprovantes([]);
                        setIsDespesaModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Adicionar Despesa</span>
                    </button>
                  </div>

                  {/* LISTAGEM DE DESPESAS EM CARDS COMPACTOS */}
                  {despesas.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center bg-slate-50/50">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">Nenhuma despesa registrada ainda</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Clique no botão acima para adicionar a primeira despesa (ex: Alimentação, Estacionamento, Pedágio, etc.).
                      </p>
                      <button
                        onClick={() => {
                          setEditingDespesaIndex(null);
                          setDespesaDescricao('');
                          setDespesaValorStr('');
                          setDespesaComprovantes([]);
                          setIsDespesaModalOpen(true);
                        }}
                        className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        + Adicionar Despesa
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {despesas.map((desp, idx) => (
                        <div
                          key={desp.id}
                          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-mono font-black text-xs flex items-center justify-center shrink-0 border border-slate-200">
                              {String(idx + 1).padStart(2, '0')}
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900">
                                {desp.descricao}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                  <CalendarIcon className="w-3 h-3 text-slate-400" />
                                  {new Date(desp.dataDespesa + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                  <Paperclip className="w-3 h-3 text-slate-400" />
                                  {desp.comprovantes?.length || 0} comprovante(s)
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                            <div className="text-right">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                Valor
                              </span>
                              <span className="text-base font-black font-mono text-indigo-700">
                                {formatarMoedaBRL(desp.valor)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleEditDespesa(idx)}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title="Editar Despesa"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveDespesa(idx)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                title="Remover Despesa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CAMPO DE DESTAQUE: TOTAL DO REEMBOLSO SOLICITADO (ITEM 3 DO PROMPT) */}
                  <div className="mt-8 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl shadow-indigo-950/20 border border-indigo-500/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-full border border-indigo-400/20">
                            Cálculo Automático & Auditado
                          </span>
                          <span className="text-xs text-indigo-300">•</span>
                          <span className="text-xs font-bold text-slate-300">
                            {despesas.length} {despesas.length === 1 ? 'despesa registrada' : 'despesas registradas'}
                          </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-black uppercase tracking-wider mt-1 text-white">
                          Total do Reembolso Solicitado
                        </h2>
                        <div className="text-xs text-indigo-200/90 mt-1 font-medium max-w-xl">
                          {totalReembolso > 0 ? (
                            <span>Valor por extenso: <strong className="text-white">{totalReembolsoExtenso}</strong></span>
                          ) : (
                            <span>Adicione as despesas para calcular automaticamente o valor total.</span>
                          )}
                        </div>
                      </div>

                      <div className="text-left sm:text-right bg-white/5 sm:bg-transparent p-4 sm:p-0 rounded-2xl border border-white/10 sm:border-0">
                        <span className="text-[10px] uppercase tracking-widest text-indigo-300 font-black block">
                          Valor Final
                        </span>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tight">
                          {formatarMoedaBRL(totalReembolso)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => switchTab('descricao')}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <button
                      onClick={() => switchTab('anexos')}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                    >
                      <span>Avançar para Anexos</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- ABA 4: ANEXOS ---------------- */}
              {activeTab === 'anexos' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Comprovantes & Anexos Consolidados</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Visualize todos os comprovantes das despesas e adicione anexos gerais do processo.</p>
                  </div>

                  {/* Comprovantes vinculados às despesas */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">
                      Comprovantes das Despesas Vinculadas
                    </h4>

                    {despesas.every(d => !d.comprovantes || d.comprovantes.length === 0) ? (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 text-center">
                        Nenhum comprovante foi anexado diretamente às despesas registradas.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {despesas.map((d, dIdx) => (
                          d.comprovantes?.map((c, cIdx) => (
                            <div key={c.id || `${dIdx}-${cIdx}`} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <Paperclip className="w-4 h-4 text-indigo-600 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-800 truncate" title={c.name}>{c.name}</div>
                                  <div className="text-[10px] text-slate-500">Despesa #{String(dIdx + 1).padStart(2, '0')}: {d.descricao}</div>
                                </div>
                              </div>
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg shrink-0"
                                title="Abrir Arquivo"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                            </div>
                          ))
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Anexos Gerais Adicionais */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Documentos Gerais Adicionais (Portarias, Relatórios de Viagem, etc.)
                      </h4>
                      <button
                        onClick={() => geralFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Adicionar Anexo</span>
                      </button>
                      <input
                        type="file"
                        ref={geralFileInputRef}
                        onChange={handleUploadAnexoGeral}
                        multiple
                        className="hidden"
                      />
                    </div>

                    {anexosGerais.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                        Nenhum anexo geral adicionado.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {anexosGerais.map((anx, idx) => (
                          <div key={anx.id || idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div className="text-xs font-bold text-slate-800 truncate" title={anx.name}>{anx.name}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <a href={anx.url} target="_blank" rel="noreferrer" className="p-1 text-indigo-600 hover:bg-indigo-50 rounded">
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => setAnexosGerais(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BOTÃO FINAL: REVISÃO E CONCLUSÃO */}
                  <div className="flex justify-between pt-6 border-t border-slate-200">
                    <button
                      onClick={() => switchTab('despesas')}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <button
                      onClick={handleValidateBeforeSubmit}
                      disabled={loading || despesas.length === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Revisar & Concluir Solicitação</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE DESPESA INDIVIDUAL (ITEM 1 E 2 DO PROMPT)     */}
      {/* ========================================================================= */}
      {isDespesaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Banknote className="w-4 h-4 text-indigo-600" />
                {editingDespesaIndex !== null ? 'Editar Despesa' : 'Nova Despesa para Reembolso'}
              </h3>
              <button
                onClick={() => setIsDespesaModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  Descrição da Despesa *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Alimentação durante deslocamento, Estacionamento, Pedágio..."
                  value={despesaDescricao}
                  onChange={(e) => setDespesaDescricao(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Valor da Despesa (R$) *
                  </label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={despesaValorStr}
                    onChange={(e) => setDespesaValorStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    Data da Despesa *
                  </label>
                  <input
                    type="date"
                    value={despesaData}
                    onChange={(e) => setDespesaData(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              {/* Upload e Vinculação de Comprovantes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Comprovante(s) Fiscal / Recibo
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingComprovante}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Anexar Arquivo
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleUploadComprovante}
                    multiple
                    className="hidden"
                  />
                </div>

                {despesaComprovantes.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-2xl text-center cursor-pointer bg-slate-50 transition-colors"
                  >
                    <Paperclip className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500 font-medium">Clique para vincular comprovante (PDF, JPG, PNG)</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {despesaComprovantes.map((comp, cIdx) => (
                      <div key={comp.id || cIdx} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs border border-slate-200">
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate font-medium">{comp.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDespesaComprovantes(prev => prev.filter((_, i) => i !== cIdx))}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDespesaModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveDespesa}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20"
              >
                {editingDespesaIndex !== null ? 'Salvar Alterações' : 'Adicionar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESUMO ANTES DE CONCLUIR (ITEM 5 DO PROMPT)                         */}
      {/* ========================================================================= */}
      {showResumoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Confirmação Obrigatória
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">Resumo da Solicitação de Reembolso</h3>
              </div>
              <button
                onClick={() => setShowResumoModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Servidor Solicitante</span>
                  <span className="font-bold text-slate-800">{servidorNome}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cargo / Setor</span>
                  <span className="font-bold text-slate-800">{servidorCargo || servidorSetor || 'Servidor Municipal'}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Destino / Itinerário</span>
                  <span className="font-medium text-slate-700">{destino || 'Não especificado'}</span>
                </div>
              </div>

              {/* Relação das Despesas e Valores */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Despesas Registradas ({despesas.length})
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {despesas.reduce((acc, d) => acc + (d.comprovantes?.length || 0), 0)} comprovante(s)
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {despesas.map((d, i) => (
                    <div key={d.id || i} className="p-3 flex items-center justify-between text-xs bg-white">
                      <div>
                        <span className="font-bold text-slate-800">{i + 1}. {d.descricao}</span>
                        <span className="text-[10px] text-slate-400 block">{d.dataDespesa} • {d.comprovantes?.length || 0} anexo(s)</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{formatarMoedaBRL(d.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Destaque do Valor Total */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">
                    Valor Total do Reembolso Solicitado
                  </span>
                  <span className="text-xs text-indigo-900 font-medium">
                    {totalReembolsoExtenso}
                  </span>
                </div>
                <span className="text-xl font-black font-mono text-indigo-700">
                  {formatarMoedaBRL(totalReembolso)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResumoModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Corrigir Informações
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalSubmit}
                disabled={loading}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar & Gerar Demonstrativo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE SUCESSO / IMPRESSÃO APÓS GERAR                                   */}
      {/* ========================================================================= */}
      {submittedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-900">Solicitação Concluída com Sucesso!</h3>
            <p className="text-xs text-slate-500">
              O processo de reembolso <strong className="text-indigo-600 font-mono">{submittedData.protocol}</strong> no valor total de <strong className="text-slate-800">{formatarMoedaBRL(submittedData.valorTotal)}</strong> foi registrado.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handlePrintOfficialPDF(submittedData)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Baixar Demonstrativo PDF</span>
              </button>
              <button
                onClick={() => {
                  setSubmittedData(null);
                  handleBackToList();
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Ir para o Histórico de Reembolsos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VISUALIZAÇÃO DE DETALHES DE UMA SOLICITAÇÃO EXISTENTE              */}
      {/* ========================================================================= */}
      {selectedSolicitacaoDetalhes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <span className="font-mono text-xs font-black text-indigo-600">{selectedSolicitacaoDetalhes.protocol}</span>
                <h3 className="text-sm font-black text-slate-900">Demonstrativo de Solicitação de Reembolso</h3>
              </div>
              <button
                onClick={() => setSelectedSolicitacaoDetalhes(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1">
              <div className="p-3 bg-slate-50 rounded-2xl grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Servidor</span>
                  <span className="font-bold text-slate-800">{selectedSolicitacaoDetalhes.servidorNome}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cargo</span>
                  <span className="font-bold text-slate-800">{selectedSolicitacaoDetalhes.servidorCargo || '---'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Data do Pedido</span>
                  <span className="font-bold text-slate-800">{new Date(selectedSolicitacaoDetalhes.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">Despesas Discriminadas</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {selectedSolicitacaoDetalhes.despesas.map((d, idx) => (
                    <div key={d.id || idx} className="p-3 flex items-center justify-between text-xs bg-white">
                      <div>
                        <div className="font-bold text-slate-800">{idx + 1}. {d.descricao}</div>
                        <div className="text-[10px] text-slate-400">{d.dataDespesa} • {d.comprovantes?.length || 0} comprovante(s)</div>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-900">
                        {formatarMoedaBRL(d.valor)}
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-indigo-50 flex items-center justify-between font-black text-xs text-indigo-900">
                    <span>TOTAL SOLICITADO</span>
                    <span className="font-mono text-sm">{formatarMoedaBRL(selectedSolicitacaoDetalhes.valorTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Valor por Extenso</span>
                <span className="font-medium text-slate-700">{selectedSolicitacaoDetalhes.valorTotalExtenso}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setSelectedSolicitacaoDetalhes(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
              <button
                onClick={() => handlePrintOfficialPDF(selectedSolicitacaoDetalhes)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Demonstrativo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
