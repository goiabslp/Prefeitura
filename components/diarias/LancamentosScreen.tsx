import React, { useEffect, useState, useMemo } from 'react';
import { 
  ArrowLeft, Loader2, Calendar, MapPin, Users, RefreshCw, 
  FileText, Search, Hash as HashIcon, CheckCircle2, 
  X, AlertTriangle, Upload, Paperclip, Check, Trash2,
  Car, Navigation, Hotel, BookOpen, Copy
} from 'lucide-react';
import { DiariaEvento, User, Attachment, Sector, Job, Person } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { 
  getDiariaEventosBySector, 
  getAllDiariaEventos, 
  updateDiariaEvento,
  getDiariasGestores,
  deleteDiariaEvento
} from '../../services/diariasEventosService';
import { uploadFile } from '../../services/storageService';

const GESTORES_CARGOS = [
  'Chefe do Departamento de Educação',
  'Chefe do Departamento de Agricultura',
  'Chefe do Departamento de Obras',
  'Chefe de Gabinete',
  'Secretario de Saúde',
  'Prefeito',
  'Secretário de Administração e Finanças'
];

interface LancamentosScreenProps {
  currentUser: User | null;
  onBack: () => void;
  onGenerateDiaria?: (diariaContent: {
    requesterName: string;
    destination: string;
    departureDateTime: string;
    returnDateTime: string;
    reason: string;
    requestedValue: string;
    relatorioViagem: string;
    attachments: Attachment[];
  }) => void;
}

export const LancamentosScreen: React.FC<LancamentosScreenProps> = ({
  currentUser,
  onBack,
  onGenerateDiaria
}) => {
  const [eventos, setEventos] = useState<DiariaEvento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [gestoresMap, setGestoresMap] = useState<Record<string, string>>({});

  // Controle de Modais
  const [selectedEvento, setSelectedEvento] = useState<DiariaEvento | null>(null);
  const [modalType, setModalType] = useState<'gestor' | 'admin' | null>(null);

  // Estados para o Modal do Gestor
  const [justificativaGestor, setJustificativaGestor] = useState('');
  const [comprovantes, setComprovantes] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Novos campos de despesa do comprovante
  const [newExpenseType, setNewExpenseType] = useState('Alimentação');
  const [newExpenseValue, setNewExpenseValue] = useState('');

  // Estados para o Modal do Administrador (Aprovação Final) e Abas
  const [adminStep, setAdminStep] = useState<'review' | 'approve'>('review');
  const [valorDiaria, setValorDiaria] = useState('');
  const [relatorioViagem, setRelatorioViagem] = useState('');
  const [modalActiveTab, setModalActiveTab] = useState<'resumo' | 'justificativa' | 'comprovantes' | 'relatorio'>('resumo');
  const [transferGestorCargo, setTransferGestorCargo] = useState<string>('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [isCopiedNarrative, setIsCopiedNarrative] = useState(false);

  useEffect(() => {
    const loadAuxiliaryData = async () => {
      try {
        const { data: sData } = await supabase.from('sectors').select('*');
        if (sData) setSectors(sData);

        const { data: pData } = await supabase.from('profiles').select('*');
        if (pData) setProfiles(pData);

        const { data: jData } = await supabase.from('jobs').select('*');
        if (jData) setJobs(jData);

        const { data: peData } = await supabase.from('persons').select('*');
        if (peData) {
          setPersons(peData.map((p: any) => ({
            id: p.id,
            name: p.name,
            sectorId: p.sector_id,
            jobId: p.job_id,
            birth_date: p.birth_date,
            driver_code: p.driver_code
          })));
        }
      } catch (e) {
        console.warn("Erro ao carregar dados auxiliares:", e);
      }
    };
    loadAuxiliaryData();
  }, []);

  const fetchEventos = async () => {
    setIsLoading(true);
    try {
      // 1. Buscar gestores mapeados
      const gestores = await getDiariasGestores();
      const gMap: Record<string, string> = {};
      gestores.forEach(g => {
        gMap[g.pessoa_id] = g.gestor_id;
      });
      setGestoresMap(gMap);

      // 2. Buscar eventos
      let data: DiariaEvento[] = [];
      // Buscamos todos os eventos para poder cruzar as permissões de gestor no front-end de forma flexível
      data = await getAllDiariaEventos();
      setEventos(data);
    } catch (error) {
      console.error(error);
      alert("Erro ao buscar lançamentos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEventos();
  }, [currentUser]);

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch (e) {
      return '---';
    }
  };

  const filteredEventos = eventos.filter(evento => {
    // Regra de visibilidade por perfil
    const pessoaId = evento.pessoas[0]?.id || '';
    const gestorId = gestoresMap[pessoaId] || '';
    const isGestor = currentUser?.id === gestorId;
    const isOwner = evento.user_id === currentUser?.id;

    // Se não for admin, e não for gestor do servidor, e não for quem criou, oculta do histórico
    if (currentUser?.role !== 'admin' && !isGestor && !isOwner) {
      return false;
    }

    const term = searchTerm.toLowerCase();
    const matchesSearch = evento.destino.toLowerCase().includes(term) ||
           evento.motivo.toLowerCase().includes(term) ||
           evento.pessoas.some(p => p.name.toLowerCase().includes(term)) ||
           (evento.status || '').toLowerCase().includes(term);
    return matchesSearch;
  });

  const handleSelectModalTab = (tab: 'resumo' | 'justificativa' | 'comprovantes' | 'relatorio') => {
    setModalActiveTab(tab);
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('modalTab', tab);
      window.history.replaceState({}, '', currentUrl.toString());
    } catch (e) {}
  };

  const handleOpenReview = (evento: DiariaEvento) => {
    setSelectedEvento(evento);
    setModalActiveTab('resumo');
    setTransferGestorCargo(evento.gestor_transferido_cargo || '');
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('modalTab', 'resumo');
      window.history.replaceState({}, '', currentUrl.toString());
    } catch (e) {}

    if (evento.status === 'aguardando_administrador' && currentUser?.role === 'admin') {
      setModalType('admin');
      setAdminStep('review');
      setValorDiaria(evento.valor_diaria ? String(evento.valor_diaria) : '');
      setRelatorioViagem(evento.relatorio_viagem || '');
    } else {
      setModalType('gestor');
      setJustificativaGestor(evento.justificativa_gestor || '');
      setComprovantes(evento.comprovantes_gestor || []);
    }
  };

  const handleCloseModal = () => {
    setSelectedEvento(null);
    setModalType(null);
    setJustificativaGestor('');
    setComprovantes([]);
    setAdminStep('review');
    setModalActiveTab('resumo');
    setTransferGestorCargo('');
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('modalTab');
      window.history.replaceState({}, '', currentUrl.toString());
    } catch (e) {}
  };

  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedEvento) {
      setIsUploading(true);
      try {
        const publicUrl = await uploadFile(file, 'attachments', `comprovante_evento_${selectedEvento.id}_${Date.now()}_${file.name}`);
        if (publicUrl) {
          const newAttachment: Attachment = {
            id: Date.now().toString(),
            name: file.name,
            url: publicUrl,
            type: file.type,
            date: new Date().toISOString(),
            expenseType: newExpenseType,
            expenseValue: newExpenseValue
          };
          setComprovantes(prev => [...prev, newAttachment]);
          setNewExpenseValue('');
        }
      } catch (err) {
        console.error(err);
        alert("Erro ao enviar o comprovante.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeComprovante = (id: string) => {
    setComprovantes(prev => prev.filter(c => c.id !== id));
  };

  const handleGestorApprove = async () => {
    if (!selectedEvento || justificativaGestor.trim().length < 300) return;
    setIsSubmitting(true);
    try {
      const isTransferring = Boolean(transferGestorCargo);
      await updateDiariaEvento(selectedEvento.id, {
        justificativa_gestor: justificativaGestor.trim(),
        comprovantes_gestor: comprovantes,
        gestor_transferido_cargo: transferGestorCargo || undefined,
        status: isTransferring ? 'aguardando_gestor' : 'aguardando_administrador'
      });
      fetchEventos();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar aprovação do gestor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminGenerate = async () => {
    if (!selectedEvento || !valorDiaria || !relatorioViagem.trim()) return;
    setIsSubmitting(true);
    try {
      await updateDiariaEvento(selectedEvento.id, {
        valor_diaria: parseFloat(valorDiaria.replace(/[^\d,.-]/g, '').replace(',', '.')),
        relatorio_viagem: relatorioViagem.trim(),
        status: 'concluido'
      });

      if (onGenerateDiaria) {
        onGenerateDiaria({
          requesterName: selectedEvento.pessoas[0]?.name || 'Servidor',
          destination: selectedEvento.destino,
          departureDateTime: selectedEvento.data_saida,
          returnDateTime: selectedEvento.data_retorno,
          reason: `MOTIVO DO MOTORISTA: ${selectedEvento.motivo}\n\nJUSTIFICATIVA DO GESTOR: ${selectedEvento.justificativa_gestor || 'Não informada.'}`,
          requestedValue: valorDiaria,
          relatorioViagem: relatorioViagem.trim(),
          attachments: selectedEvento.comprovantes_gestor || []
        });
      }

      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert("Erro ao finalizar a aprovação e gerar a diária.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir permanentemente este lançamento de viagem?")) {
      setEventos(prev => prev.filter(e => e.id !== id));
      try {
        await deleteDiariaEvento(id);
        await fetchEventos();
      } catch (err) {
        console.error(err);
        alert("Erro ao excluir o lançamento de viagem.");
        await fetchEventos();
      }
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = status || 'aguardando_gestor';
    switch (s) {
      case 'aguardando_gestor':
        return { label: 'Aguardando Gestor', style: 'border-amber-200 bg-amber-50 text-amber-700' };
      case 'aguardando_administrador':
        return { label: 'Aguardando Admin', style: 'border-blue-200 bg-blue-50 text-blue-700' };
      case 'concluido':
        return { label: 'Concluído', style: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
      default:
        return { label: 'Registrado', style: 'border-slate-200 bg-slate-50 text-slate-700' };
    }
  };

  return (
    <div className="flex-1 h-full w-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 desktop:p-8 overflow-hidden animate-fade-in">
      <div className="w-full max-w-7xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-full">
        
        <div className="p-4 border-b border-slate-100 shrink-0 bg-white transition-all">
          <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="contents">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest group text-[10px] p-2 hover:bg-slate-50 rounded-lg -ml-2"
                  title="Voltar"
                >
                  <ArrowLeft className="transition-transform w-3 h-3" />
                </button>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="truncate uppercase">Histórico: EVENTOS DE VIAGEM</span>
                </h2>
              </div>
            </div>

            <div className="flex-1 max-w-lg flex items-center gap-2">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por destino, motivo, pessoa..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all pl-9 pr-3 py-2 text-xs"
                />
                <Search className="absolute top-1/2 -translate-y-1/2 text-slate-400 left-3 w-3.5 h-3.5" />
              </div>
              <button
                onClick={fetchEventos}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all font-bold text-[10px] uppercase tracking-widest whitespace-nowrap active:scale-95 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-400 font-medium text-sm animate-pulse">Carregando lançamentos...</p>
            </div>
          ) : filteredEventos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 h-full">
              <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-12 text-center flex flex-col items-center justify-center w-full max-w-2xl mx-auto shadow-sm">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">
                  {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum evento registrado'}
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {searchTerm 
                    ? 'Tente ajustar os termos da sua pesquisa.' 
                    : 'Ainda não há eventos cadastrados.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-full">
              <div className="border-b border-slate-100 bg-slate-50 hidden desktop:grid desktop:grid-cols-12 gap-4 px-8 py-4 sticky top-0 z-10">
                <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                  <Calendar className="w-3 h-3" /> Data Solicitação
                </div>
                <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                  <HashIcon className="w-3 h-3" /> ID
                </div>
                <div className="md:col-span-3 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                  <MapPin className="w-3 h-3" /> Destino / Servidor
                </div>
                <div className="md:col-span-3 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                  <FileText className="w-3 h-3" /> Motivo da Viagem
                </div>
                <div className="md:col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                  Status
                </div>
                <div className="md:col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap">
                  Ações
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredEventos.map(evento => {
                  const createdDate = new Date(evento.created_at || new Date());
                  const monthName = createdDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                  const yearLabel = createdDate.toLocaleDateString('pt-BR', { year: '2-digit' });
                  const badge = getStatusBadge(evento.status);
                  
                  const pessoaId = evento.pessoas[0]?.id || '';
                  const gestorId = gestoresMap[pessoaId] || '';
                  const isConfiguredGestor = currentUser?.id === gestorId;

                  const isTransferredGestor = evento.gestor_transferido_cargo
                    ? (currentUser?.jobTitle?.trim().toLowerCase() === evento.gestor_transferido_cargo.trim().toLowerCase() || currentUser?.role === 'admin')
                    : false;

                  const isCurrentUserGestor = evento.gestor_transferido_cargo ? isTransferredGestor : (isConfiguredGestor || currentUser?.role === 'admin');

                  const gestorCanAct = (evento.status === 'aguardando_gestor' || !evento.status) && isCurrentUserGestor;
                  const adminCanAct = evento.status === 'aguardando_administrador' && currentUser?.role === 'admin';

                  const canAct = gestorCanAct || adminCanAct;

                  return (
                    <div key={evento.id} className="grid grid-cols-1 desktop:grid-cols-12 gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors items-center">
                      <div className="md:col-span-2 flex justify-center gap-2 items-center">
                        <div className="w-11 h-11 bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center shadow-sm shrink-0">
                          <span className="text-[7px] font-black text-slate-400 uppercase">
                            {monthName}/{yearLabel}
                          </span>
                          <span className="text-base font-black text-emerald-600 leading-none">
                            {createdDate.getDate()}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono hidden desktop:inline">
                          {createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="md:col-span-1 flex justify-center">
                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/50">
                          EVT-{evento.id.slice(0,4).toUpperCase()}
                        </span>
                      </div>

                      <div className="md:col-span-3">
                        <h3 className="text-sm font-bold text-slate-800 leading-tight truncate" title={evento.destino}>
                          {evento.destino}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {evento.pessoas[0]?.name || 'Servidor não informado'}
                        </p>
                      </div>

                      <div className="md:col-span-3">
                        <p className="text-xs text-slate-600 font-medium line-clamp-2" title={evento.motivo}>
                          {evento.motivo}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium mt-1">
                           Lançado por {evento.user_name}
                        </p>
                      </div>

                      <div className="md:col-span-2 flex justify-center">
                         <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm ${badge.style}`}>
                            {badge.label}
                         </div>
                      </div>

                      <div className="md:col-span-1 flex items-center justify-center gap-2">
                        {canAct && evento.status !== 'concluido' ? (
                          <button 
                            onClick={() => handleOpenReview(evento)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-600/10"
                          >
                            Revisar
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleOpenReview(evento)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Ver Detalhes"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        
                        {(currentUser?.role === 'admin' || 
                          evento.user_id === currentUser?.id || 
                          currentUser?.permissions?.includes('parent_diarias_lancamentos') || 
                          currentUser?.permissions?.includes('parent_diarias')) && (
                          <button 
                            onClick={() => handleDelete(evento.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir Viagem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {modalType === 'gestor' && selectedEvento && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 lg:p-8 animate-fade-in" onClick={handleCloseModal}>
          <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200/80 animate-slide-up" onClick={e => e.stopPropagation()}>
            
            <div className="px-8 py-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black tracking-tight">Aprovação do Gestor de Setor</h3>
                    <span className="font-mono text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                      EVT-{selectedEvento.id.slice(0,4).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Revise os dados da solicitação de viagem e informe a justificativa pública.</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="p-2.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="px-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-t border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto hide-scroll shrink-0">
              <button
                type="button"
                onClick={() => handleSelectModalTab('resumo')}
                className={`flex items-center gap-2.5 px-6 py-3.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  modalActiveTab === 'resumo'
                    ? 'border-indigo-400 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-400" />
                Resumo do Evento de Viagem
              </button>

              <button
                type="button"
                onClick={() => handleSelectModalTab('justificativa')}
                className={`flex items-center gap-2.5 px-6 py-3.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  modalActiveTab === 'justificativa'
                    ? 'border-indigo-400 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Justificativa do Gestor
              </button>

              <button
                type="button"
                onClick={() => handleSelectModalTab('comprovantes')}
                className={`flex items-center gap-2.5 px-6 py-3.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  modalActiveTab === 'comprovantes'
                    ? 'border-indigo-400 text-white bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Paperclip className="w-4 h-4 text-amber-400" />
                Comprovantes de Despesas
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              
              {modalActiveTab === 'resumo' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" /> Resumo Geral do Evento
                    </span>
                    <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusBadge(selectedEvento.status).style}`}>
                      {getStatusBadge(selectedEvento.status).label}
                    </span>
                  </div>

                  {(() => {
                    const vehicleText = selectedEvento.veiculo === 'OUTRO' 
                      ? (selectedEvento.veiculo_outro || 'OUTRO (Personalizado)')
                      : (selectedEvento.veiculo || 'Não informado');

                    const distanceText = selectedEvento.distancia !== undefined && selectedEvento.distancia !== null && selectedEvento.distancia !== 0
                      ? `${selectedEvento.distancia} KM`
                      : (selectedEvento.distancia === 0 ? '0 KM' : 'Não informada');

                    const hospedagemText = selectedEvento.hospedagem 
                      ? `Sim (${selectedEvento.hospedagem_dias || 1} dia(s))` 
                      : 'Não';

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Servidor</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {selectedEvento.pessoas[0]?.name || '---'}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Destino</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {selectedEvento.destino}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                            <Car className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Veículo Usado</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {vehicleText}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0 mt-0.5">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Distância (KM)</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {distanceText}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Data/Hora Saída</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {formatDate(selectedEvento.data_saida)}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Data/Hora Retorno</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {formatDate(selectedEvento.data_retorno)}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-50/90 border border-slate-200/70 p-3 rounded-xl flex items-start gap-2.5 shadow-sm sm:col-span-2 md:col-span-1 lg:col-span-2">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                            <Hotel className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">Hospedagem Solicitada</span>
                            <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                              {hospedagemText}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Motivo Informado pelo Motorista / Servidor</span>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700 font-medium leading-relaxed break-words break-all whitespace-pre-wrap overflow-hidden">
                      {selectedEvento.motivo}
                    </div>
                  </div>
                </div>
              )}

              {modalActiveTab === 'justificativa' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Justificativa Pública do Gestor de Setor
                    </span>
                    {selectedEvento.gestor_transferido_cargo && (
                      <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        Viagem Transferida para: {selectedEvento.gestor_transferido_cargo}
                      </span>
                    )}
                  </div>

                  {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Transferir Viagem a outro Gestor
                        </label>
                        {transferGestorCargo && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Transferência Ativa
                          </span>
                        )}
                      </div>
                      <select
                        value={transferGestorCargo}
                        onChange={(e) => setTransferGestorCargo(e.target.value)}
                        disabled={selectedEvento.status === 'aguardando_administrador' || selectedEvento.status === 'concluido'}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      >
                        <option value="">-- Não transferir (Manter com o gestor atual) --</option>
                        {GESTORES_CARGOS.map((cargo) => (
                          <option key={cargo} value={cargo}>
                            {cargo}
                          </option>
                        ))}
                      </select>
                      {transferGestorCargo && (
                        <p className="text-[10px] text-amber-800 font-semibold mt-1">
                          Ao transferir, a responsabilidade de avaliar e aprovar esta viagem passará para o gestor com o cargo de: <strong>{transferGestorCargo}</strong>.
                        </p>
                      )}
                    </div>
                  )}

                  <textarea
                    value={justificativaGestor}
                    onChange={(e) => setJustificativaGestor(e.target.value)}
                    placeholder="Justifique a necessidade e o interesse público da viagem detalhadamente..."
                    disabled={selectedEvento.status === 'aguardando_administrador' || selectedEvento.status === 'concluido'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all min-h-[200px] resize-none leading-relaxed break-words break-all whitespace-pre-wrap"
                  />
                  {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                    <div className="flex justify-between items-center text-[10px] font-bold mt-1 px-1">
                      <span className={justificativaGestor.trim().length >= 300 ? "text-emerald-600 font-black" : "text-amber-600 font-black"}>
                        {justificativaGestor.trim().length >= 300 ? "✓ Tamanho mínimo atingido!" : `⚠️ Mínimo de 300 caracteres necessário (faltam ${300 - justificativaGestor.trim().length} caracteres)`}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {justificativaGestor.trim().length} / 300
                      </span>
                    </div>
                  )}
                </div>
              )}

              {modalActiveTab === 'comprovantes' && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-amber-600" /> Comprovantes de Despesas Anexados
                    </span>
                  </div>

                  {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                    <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Tipo de Despesa</label>
                          <select
                            value={newExpenseType}
                            onChange={(e) => setNewExpenseType(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                          >
                            <option value="Hospedagem">Hospedagem</option>
                            <option value="Combustível">Combustível</option>
                            <option value="Alimentação">Alimentação</option>
                            <option value="Estacionamento">Estacionamento</option>
                            <option value="Outros">Outros</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Valor da Despesa</label>
                          <input
                            type="text"
                            value={newExpenseValue}
                            onChange={(e) => setNewExpenseValue(e.target.value)}
                            placeholder="R$ 0,00"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      
                      <div className="relative pt-1">
                        <input 
                          type="file" 
                          id="comprovante-file"
                          onChange={handleComprovanteUpload}
                          disabled={isUploading || !newExpenseValue}
                          className="hidden"
                        />
                        <label 
                          htmlFor="comprovante-file"
                          className={`flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl py-3.5 cursor-pointer text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white hover:bg-indigo-50/20 transition-all active:scale-[0.99] ${!newExpenseValue ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          {isUploading ? 'Enviando arquivo...' : 'Selecionar Comprovante'}
                        </label>
                        {!newExpenseValue && (
                          <p className="text-[9px] text-amber-600 font-bold mt-1 text-center">Preencha o valor da despesa antes de carregar o arquivo.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {comprovantes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {comprovantes.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl hover:border-indigo-200 transition-all">
                          <a 
                            href={c.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-3 text-xs font-semibold text-indigo-600 hover:underline truncate max-w-[85%]"
                          >
                            <Paperclip className="w-4 h-4 text-indigo-500 shrink-0" />
                            <div className="flex flex-col truncate">
                              <span className="truncate">{c.name}</span>
                              {c.expenseType && (
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">
                                  {c.expenseType} • R$ {c.expenseValue}
                                </span>
                              )}
                            </div>
                          </a>
                          {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                            <button 
                              type="button"
                              onClick={() => removeComprovante(c.id)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs font-semibold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Nenhum comprovante anexado até o momento.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-8 py-5 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
              <button 
                onClick={handleCloseModal}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-2xl transition-colors"
              >
                Fechar
              </button>
              {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                <button 
                  onClick={handleGestorApprove}
                  disabled={justificativaGestor.trim().length < 300 || isSubmitting || isUploading}
                  className="px-7 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {transferGestorCargo ? `Transferir para ${transferGestorCargo}` : 'Enviar para Administrador'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalType === 'admin' && selectedEvento && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 lg:p-8 animate-fade-in" onClick={handleCloseModal}>
          <div className="w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200/80 animate-slide-up" onClick={e => e.stopPropagation()}>
            
            <div className="px-8 py-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black tracking-tight">Aprovação do Administrador</h3>
                    <span className="font-mono text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                      EVT-{selectedEvento.id.slice(0,4).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Revise todos os parâmetros da viagem e conclua a geração oficial da diária.</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="p-2.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {adminStep === 'review' && (
              <div className="px-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-t border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto hide-scroll shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectModalTab('resumo')}
                  className={`flex items-center gap-2.5 px-6 py-3.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    modalActiveTab === 'resumo'
                      ? 'border-indigo-400 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Resumo do Evento de Viagem
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectModalTab('justificativa')}
                  className={`flex items-center gap-2.5 px-6 py-3.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    modalActiveTab === 'justificativa'
                      ? 'border-indigo-400 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Justificativa do Gestor
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectModalTab('comprovantes')}
                  className={`flex items-center gap-2.5 px-6 py-3.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    modalActiveTab === 'comprovantes'
                      ? 'border-indigo-400 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Paperclip className="w-4 h-4 text-amber-400" />
                  Comprovantes de Despesas
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectModalTab('relatorio')}
                  className={`flex items-center gap-2.5 px-6 py-3.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    modalActiveTab === 'relatorio'
                      ? 'border-indigo-400 text-white bg-indigo-500/10'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  Relatório
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              {adminStep === 'review' ? (
                <div className="space-y-6">
                  
                  {modalActiveTab === 'resumo' && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-indigo-600" /> Resumo Geral do Evento
                        </span>
                        <span className={`px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusBadge(selectedEvento.status).style}`}>
                          {getStatusBadge(selectedEvento.status).label}
                        </span>
                      </div>

                      {(() => {
                        const vehicleText = selectedEvento.veiculo === 'OUTRO' 
                          ? (selectedEvento.veiculo_outro || 'OUTRO (Personalizado)')
                          : (selectedEvento.veiculo || 'Não informado');

                        const distanceText = selectedEvento.distancia !== undefined && selectedEvento.distancia !== null && selectedEvento.distancia !== 0
                          ? `${selectedEvento.distancia} KM`
                          : (selectedEvento.distancia === 0 ? '0 KM' : 'Não informada');

                        const hospedagemText = selectedEvento.hospedagem 
                          ? `Sim (${selectedEvento.hospedagem_dias || 1} dia(s))` 
                          : 'Não';

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Servidor</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate" title={selectedEvento.pessoas[0]?.name}>
                                  {selectedEvento.pessoas[0]?.name || '---'}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                <MapPin className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Destino</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate" title={selectedEvento.destino}>
                                  {selectedEvento.destino}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                <Car className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Veículo Usado</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate" title={vehicleText}>
                                  {vehicleText}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                                <Navigation className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Distância (KM)</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {distanceText}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <Calendar className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Data/Hora Saída</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {formatDate(selectedEvento.data_saida)}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                              <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                                <Calendar className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Data/Hora Retorno</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {formatDate(selectedEvento.data_retorno)}
                                </p>
                              </div>
                            </div>

                            <div className="bg-slate-50/80 border border-slate-200/60 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm sm:col-span-2 md:col-span-1 lg:col-span-2">
                              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                                <Hotel className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Hospedagem Solicitada</span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {hospedagemText}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="pt-4 border-t border-slate-100 space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Motivo Informado pelo Motorista / Servidor</span>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-700 font-medium leading-relaxed break-words break-all whitespace-pre-wrap overflow-hidden">
                          {selectedEvento.motivo}
                        </div>
                      </div>
                    </div>
                  )}

                  {modalActiveTab === 'justificativa' && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Justificativa Pública do Gestor
                        </span>
                      </div>
                      <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100/60 text-xs text-slate-800 font-medium leading-relaxed break-words break-all whitespace-pre-wrap overflow-hidden">
                        {selectedEvento.justificativa_gestor || 'Ainda não informada pelo gestor.'}
                      </div>
                    </div>
                  )}

                  {modalActiveTab === 'comprovantes' && (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Paperclip className="w-3.5 h-3.5 text-amber-600" /> Comprovantes de Despesas Anexados
                        </span>
                      </div>

                      {selectedEvento.comprovantes_gestor && selectedEvento.comprovantes_gestor.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedEvento.comprovantes_gestor.map((c: Attachment) => (
                            <div key={c.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                              <a 
                                href={c.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-2.5 text-xs font-semibold text-indigo-600 hover:underline truncate max-w-[95%]"
                              >
                                <Paperclip className="w-4 h-4 text-indigo-500 shrink-0" />
                                <div className="flex flex-col truncate">
                                  <span className="truncate">{c.name}</span>
                                  {c.expenseType && (
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">
                                      {c.expenseType} • R$ {c.expenseValue}
                                    </span>
                                  )}
                                </div>
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-slate-400 text-xs font-semibold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          Nenhum comprovante anexado.
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA 4: RELATÓRIO DA VIAGEM (EXCLUSIVO DO ADMINISTRADOR) */}
                  {modalActiveTab === 'relatorio' && (
                    <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Relatório Narrativo da Viagem Oficial</h4>
                            <p className="text-[11px] text-slate-500 font-medium">Resumo formal consolidado para fins de prestação de contas e geração de diária.</p>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                          EVT-{selectedEvento.id.slice(0,4).toUpperCase()}
                        </span>
                      </div>

                      {(() => {
                        const servidorNome = selectedEvento.pessoas[0]?.name || 'Servidor não informado';
                        const pessoaObj = selectedEvento.pessoas[0];

                        // Busca o cargo do servidor da mesma forma que na tela de Novo Evento
                        const getCargoServidor = () => {
                          if (!pessoaObj) return 'Cargo não informado';

                          const normalizeName = (n: string) => n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                          const targetName = pessoaObj.name ? normalizeName(pessoaObj.name) : '';

                          // 1. Busca a pessoa cadastrada na tabela `persons`
                          const matchedPerson = persons.find(p => p.id === pessoaObj.id || (p.name && normalizeName(p.name) === targetName));
                          if (matchedPerson && matchedPerson.jobId) {
                            const jobObj = jobs.find(j => j.id === matchedPerson.jobId);
                            if (jobObj && jobObj.name) return jobObj.name;
                          }

                          // 2. Busca na tabela de perfis de usuários
                          const profile = profiles.find(p => p.id === pessoaObj.id || (p.name && normalizeName(p.name) === targetName));
                          if (profile && (profile.job_title || profile.jobTitle || profile.job)) {
                            return profile.job_title || profile.jobTitle || profile.job;
                          }

                          // 3. Fallback se a pessoa possuir jobId/role no objeto
                          if ((pessoaObj as any).jobId) {
                            const jobObj = jobs.find(j => j.id === (pessoaObj as any).jobId);
                            if (jobObj && jobObj.name) return jobObj.name;
                          }
                          if ((pessoaObj as any).role) return (pessoaObj as any).role;

                          return 'Cargo não informado';
                        };

                        const cargoServidorStr = getCargoServidor();
                        const setorNome = sectors.find(s => s.id === selectedEvento.setor_id)?.name || selectedEvento.user_name || 'Setor Solicitante';
                        const dataSaidaStr = formatDate(selectedEvento.data_saida);
                        const dataRetornoStr = formatDate(selectedEvento.data_retorno);
                        const destinoStr = selectedEvento.destino;
                        const distanciaKmStr = selectedEvento.distancia ? `${selectedEvento.distancia} KM` : 'Não informada';
                        const motivoJustificativaStr = selectedEvento.justificativa_gestor || selectedEvento.motivo || 'Sem justificativa informada';
                        
                        // Busca o nome do servidor que autorizou (lotado no cargo/gestão)
                        const getAutorizadorNome = () => {
                          if (selectedEvento.gestor_transferido_cargo) {
                            const cargoTarget = selectedEvento.gestor_transferido_cargo.trim().toLowerCase();
                            const matchedProfile = profiles.find(p => {
                              const pJob = (p.job_title || p.jobTitle || p.role || p.sector || p.job || '').toString().toLowerCase();
                              return pJob.includes(cargoTarget) || cargoTarget.includes(pJob);
                            });
                            if (matchedProfile && matchedProfile.name) {
                              return `${matchedProfile.name} (${selectedEvento.gestor_transferido_cargo})`;
                            }
                            return selectedEvento.gestor_transferido_cargo;
                          }

                          const pessoaId = selectedEvento.pessoas[0]?.id || '';
                          const gestorId = gestoresMap[pessoaId];
                          if (gestorId) {
                            const gestorProfile = profiles.find(p => p.id === gestorId);
                            if (gestorProfile && gestorProfile.name) {
                              return gestorProfile.name;
                            }
                          }

                          const setor = sectors.find(s => s.id === selectedEvento.setor_id);
                          return setor?.name || selectedEvento.user_name || 'Gestor do Setor Responsável';
                        };

                        const autorizadoPorStr = getAutorizadorNome();
                        const hospedagemStatusStr = selectedEvento.hospedagem ? 'Sim' : 'Não';
                        const hospedagemNoitesStr = selectedEvento.hospedagem ? ` (${selectedEvento.hospedagem_dias || 1} noite(s))` : '';
                        const veiculoStr = selectedEvento.veiculo === 'OUTRO'
                          ? (selectedEvento.veiculo_outro || 'Veículo Personalizado')
                          : (selectedEvento.veiculo || 'Não informado');

                        return (
                          <div className="space-y-6">
                            <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50 to-white p-6 rounded-2xl border border-indigo-100/70 shadow-inner space-y-3">
                              <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2">
                                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block">Resumo Executivo Narrativo</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const narrativeText = `O servidor ${servidorNome}, ocupante do cargo de ${cargoServidorStr}, atendendo no âmbito do ${setorNome}, realizou viagem oficial com destino a ${destinoStr}. O deslocamento teve saída realizada em ${dataSaidaStr} e retorno ocorrido em ${dataRetornoStr}, percorrendo uma distância total de aproximadamente ${distanciaKmStr}.\n\nA viagem foi devidamente autorizada por ${autorizadoPorStr}, tendo como fundamentação de interesse público: "${motivoJustificativaStr}".\n\nPara a realização do trajeto, foi utilizado o veículo ${veiculoStr}. Quanto à hospedagem, o registro constou como ${hospedagemStatusStr}${hospedagemNoitesStr}.`;
                                    navigator.clipboard.writeText(narrativeText);
                                    setIsCopiedNarrative(true);
                                    setTimeout(() => setIsCopiedNarrative(false), 2000);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all shadow-sm active:scale-95"
                                  title="Copiar texto do Resumo Executivo Narrativo"
                                >
                                  {isCopiedNarrative ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                                      <span>Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copiar Texto</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-xs font-medium text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                                O servidor <strong>{servidorNome}</strong>, ocupante do cargo de <strong>{cargoServidorStr}</strong>, atendendo no âmbito do <strong>{setorNome}</strong>, realizou viagem oficial com destino a <strong>{destinoStr}</strong>. O deslocamento teve saída realizada em <strong>{dataSaidaStr}</strong> e retorno ocorrido em <strong>{dataRetornoStr}</strong>, percorrendo uma distância total de aproximadamente <strong>{distanciaKmStr}</strong>.
                              </p>
                              <p className="text-xs font-medium text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                                A viagem foi devidamente autorizada por <strong>{autorizadoPorStr}</strong>, tendo como fundamentação de interesse público: <em>“{motivoJustificativaStr}”</em>.
                              </p>
                              <p className="text-xs font-medium text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                                Para a realização do trajeto, foi utilizado o veículo <strong>{veiculoStr}</strong>. Quanto à hospedagem, o registro constou como <strong>{hospedagemStatusStr}</strong>{hospedagemNoitesStr}.
                              </p>
                            </div>

                            <div className="space-y-3 pt-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Respostas Consolidadas dos Campos</span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">1. Nome do Servidor?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{servidorNome}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">2. Cargo do Servidor?</span>
                                  <p className="text-xs font-extrabold text-indigo-700 mt-0.5 break-words">{cargoServidorStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">3. Setor em que está atendendo?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{setorNome}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">4. Qual a data e hora de saída?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{dataSaidaStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">5. Qual a data e hora de retorno?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{dataRetornoStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">6. Qual o destino?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{destinoStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">7. Quantos km de distância?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{distanciaKmStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 md:col-span-2">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">8. Motivo da viagem (Justificativa do Gestor)?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words whitespace-pre-wrap">{motivoJustificativaStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">9. Quem autorizou a viagem?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{autorizadoPorStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">10. Teve Hospedagem?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{hospedagemStatusStr}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">11. Quantas noites de hotel?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{selectedEvento.hospedagem ? `${selectedEvento.hospedagem_dias || 1} noite(s)` : '0'}</p>
                                </div>
                                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">12. Veículo?</span>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5 break-words">{veiculoStr}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>
              ) : (
                <div className="space-y-6">
                  {/* Formulário de Diária Oficial */}
                  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-8 rounded-3xl border border-indigo-100 space-y-6 shadow-sm">
                    <div>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Parâmetros de Geração da Diária Oficial</span>
                      <p className="text-xs text-slate-500 font-medium mt-1">Preencha o valor e o relatório final para aprovar a diária.</p>
                    </div>
                    
                    {/* Valor Diária */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Valor Solicitado *</label>
                      <input 
                        type="text" 
                        value={valorDiaria}
                        onChange={(e) => setValorDiaria(e.target.value)}
                        placeholder="R$ 0,00"
                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
                      />
                    </div>

                    {/* Relatório Viagem */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Relatório da Viagem *</label>
                      <textarea
                        value={relatorioViagem}
                        onChange={(e) => setRelatorioViagem(e.target.value)}
                        placeholder="Descreva as atividades e os compromissos cumpridos no evento de viagem..."
                        className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all min-h-[160px] resize-none leading-relaxed shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="px-8 py-5 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
              {adminStep === 'review' ? (
                <>
                  <button 
                    onClick={handleCloseModal}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-2xl transition-colors"
                  >
                    Fechar
                  </button>
                  {selectedEvento.status === 'aguardando_administrador' && (
                    <button 
                      onClick={() => setAdminStep('approve')}
                      className="px-7 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                    >
                      Aprovar Viagem
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setAdminStep('review')}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-2xl transition-colors"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleAdminGenerate}
                    disabled={!valorDiaria || !relatorioViagem.trim() || isSubmitting}
                    className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Gerar Viagem
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
