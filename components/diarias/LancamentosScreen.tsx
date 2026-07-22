import React, { useEffect, useState, useMemo } from 'react';
import { 
  ArrowLeft, Loader2, Calendar, MapPin, Users, RefreshCw, 
  FileText, Search, Hash as HashIcon, CheckCircle2, 
  X, AlertTriangle, Upload, Paperclip, Check, Trash2
} from 'lucide-react';
import { DiariaEvento, User, Attachment } from '../../types';
import { 
  getDiariaEventosBySector, 
  getAllDiariaEventos, 
  updateDiariaEvento,
  getDiariasGestores,
  deleteDiariaEvento
} from '../../services/diariasEventosService';
import { uploadFile } from '../../services/storageService';

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

  // Estados para o Modal do Administrador (Aprovação Final)
  const [adminStep, setAdminStep] = useState<'review' | 'approve'>('review');
  const [valorDiaria, setValorDiaria] = useState('');
  const [relatorioViagem, setRelatorioViagem] = useState('');

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

  // Abertura do Modal de Revisão
  const handleOpenReview = (evento: DiariaEvento) => {
    setSelectedEvento(evento);
    const pessoaId = evento.pessoas[0]?.id || '';
    const gestorId = gestoresMap[pessoaId] || '';

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

  // Fechamento de Modais
  const handleCloseModal = () => {
    setSelectedEvento(null);
    setModalType(null);
    setJustificativaGestor('');
    setComprovantes([]);
    setAdminStep('review');
  };

  // Upload de Comprovante pelo Gestor
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
          setNewExpenseValue(''); // limpa valor anterior
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

  // Finalização do Gestor
  const handleGestorApprove = async () => {
    if (!selectedEvento || justificativaGestor.trim().length < 300) return;
    setIsSubmitting(true);
    try {
      await updateDiariaEvento(selectedEvento.id, {
        justificativa_gestor: justificativaGestor.trim(),
        comprovantes_gestor: comprovantes,
        status: 'aguardando_administrador'
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

  // Ação de Geração de Diária pelo Administrador
  const handleAdminGenerate = async () => {
    if (!selectedEvento || !valorDiaria || !relatorioViagem.trim()) return;
    setIsSubmitting(true);
    try {
      // 1. Atualiza o status do evento para 'concluido'
      await updateDiariaEvento(selectedEvento.id, {
        valor_diaria: parseFloat(valorDiaria.replace(/[^\d,.-]/g, '').replace(',', '.')),
        relatorio_viagem: relatorioViagem.trim(),
        status: 'concluido'
      });

      // 2. Aciona o callback para carregar os dados no editor e gerar a diária oficial
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
        
        {/* Header */}
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

        {/* Content */}
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
              {/* Table Header */}
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

              {/* Table Body */}
              <div className="divide-y divide-slate-100">
                {filteredEventos.map(evento => {
                  const createdDate = new Date(evento.created_at || new Date());
                  const monthName = createdDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                  const yearLabel = createdDate.toLocaleDateString('pt-BR', { year: '2-digit' });
                  const badge = getStatusBadge(evento.status);
                  
                  const pessoaId = evento.pessoas[0]?.id || '';
                  const gestorId = gestoresMap[pessoaId] || '';
                  const isCurrentUserGestor = currentUser?.id === gestorId;

                  // Gestor pode revisar se for o gestor configurado e o status for aguardando_gestor
                  const gestorCanAct = (evento.status === 'aguardando_gestor' || !evento.status) && isCurrentUserGestor;
                  // Admin pode revisar se for admin e o status for aguardando_administrador
                  const adminCanAct = evento.status === 'aguardando_administrador' && currentUser?.role === 'admin';

                  const canAct = gestorCanAct || adminCanAct;

                  return (
                    <div key={evento.id} className="grid grid-cols-1 desktop:grid-cols-12 gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors items-center">
                      
                      {/* Data */}
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

                      {/* ID Pill */}
                      <div className="md:col-span-1 flex justify-center">
                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100/50">
                          EVT-{evento.id.slice(0,4).toUpperCase()}
                        </span>
                      </div>

                      {/* Destino e Servidor */}
                      <div className="md:col-span-3">
                        <h3 className="text-sm font-bold text-slate-800 leading-tight truncate" title={evento.destino}>
                          {evento.destino}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {evento.pessoas[0]?.name || 'Servidor não informado'}
                        </p>
                      </div>

                      {/* Motivo */}
                      <div className="md:col-span-3">
                        <p className="text-xs text-slate-600 font-medium line-clamp-2" title={evento.motivo}>
                          {evento.motivo}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium mt-1">
                           Lançado por {evento.user_name}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="md:col-span-2 flex justify-center">
                         <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest shadow-sm ${badge.style}`}>
                            {badge.label}
                         </div>
                      </div>

                      {/* Ações */}
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

      {/* MODAL DO GESTOR (Aprovação e Justificativa) */}
      {modalType === 'gestor' && selectedEvento && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={handleCloseModal}>
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
              <div>
                <h3 className="font-extrabold text-slate-950">Aprovação do Gestor de Setor</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Lançamento EVT-{selectedEvento.id.slice(0,4).toUpperCase()}</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Resumo da Viagem */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Detalhes da Viagem</span>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Servidor</span>
                    {selectedEvento.pessoas[0]?.name || '---'}
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Destino</span>
                    {selectedEvento.destino}
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Data/Hora Saída</span>
                    {formatDate(selectedEvento.data_saida)}
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Data/Hora Retorno</span>
                    {formatDate(selectedEvento.data_retorno)}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Motivo do Motorista</span>
                  <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{selectedEvento.motivo}</p>
                </div>
              </div>

              {/* Justificativa */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Justificativa do Gestor *</label>
                <textarea
                  value={justificativaGestor}
                  onChange={(e) => setJustificativaGestor(e.target.value)}
                  placeholder="Justifique a necessidade e o interesse público da viagem detalhadamente..."
                  disabled={selectedEvento.status === 'aguardando_administrador' || selectedEvento.status === 'concluido'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all min-h-[120px] resize-none leading-relaxed"
                />
                {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                  <div className="flex justify-between items-center text-[10px] font-bold mt-1 px-1">
                    <span className={justificativaGestor.trim().length >= 300 ? "text-emerald-600" : "text-amber-600"}>
                      {justificativaGestor.trim().length >= 300 ? "Tamanho mínimo atingido!" : `Mínimo de 300 caracteres necessário (faltam ${300 - justificativaGestor.trim().length} caracteres)`}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {justificativaGestor.trim().length} / 300
                    </span>
                  </div>
                )}
              </div>

              {/* Anexar Comprovantes */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Comprovantes de Despesas</label>
                
                {/* Upload Button */}
                {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">Tipo de Despesa</label>
                        <select
                          value={newExpenseType}
                          onChange={(e) => setNewExpenseType(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
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
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
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
                        className={`flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl py-3 cursor-pointer text-xs font-bold text-slate-500 hover:text-indigo-600 bg-slate-50/50 hover:bg-indigo-50/10 transition-all active:scale-[0.99] ${!newExpenseValue ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {isUploading ? 'Enviando arquivo...' : 'Selecionar Comprovante'}
                      </label>
                      {!newExpenseValue && (
                        <p className="text-[8px] text-amber-600 font-bold mt-1 text-center">Preencha o valor da despesa antes de carregar o arquivo.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Comprovantes Lista */}
                {comprovantes.length > 0 && (
                  <div className="space-y-1.5">
                    {comprovantes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <a 
                          href={c.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:underline truncate max-w-[80%]"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
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
                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={handleCloseModal}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-colors"
              >
                Fechar
              </button>
              {(selectedEvento.status === 'aguardando_gestor' || !selectedEvento.status) && (
                <button 
                  onClick={handleGestorApprove}
                  disabled={justificativaGestor.trim().length < 300 || isSubmitting || isUploading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Enviar para Administrador
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO ADMINISTRADOR (Aprovação final e Geração de Diária) */}
      {modalType === 'admin' && selectedEvento && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={handleCloseModal}>
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
              <div>
                <h3 className="font-extrabold text-slate-950">Aprovação do Administrador</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Lançamento EVT-{selectedEvento.id.slice(0,4).toUpperCase()}</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {adminStep === 'review' ? (
                <div className="space-y-6">
                  {/* Resumo da Viagem */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Resumo Geral do Evento</span>
                      <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {getStatusBadge(selectedEvento.status).label}
                      </span>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Servidor Selecionado</span>
                          {selectedEvento.pessoas[0]?.name || '---'}
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Destino</span>
                          {selectedEvento.destino}
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Data/Hora Saída</span>
                          {formatDate(selectedEvento.data_saida)}
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Data/Hora Retorno</span>
                          {formatDate(selectedEvento.data_retorno)}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Motivo do Motorista</span>
                        <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">{selectedEvento.motivo}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase font-sans">Justificativa do Gestor</span>
                        <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed bg-indigo-50/10 p-2.5 rounded-xl border border-indigo-100/30">{selectedEvento.justificativa_gestor || 'Ainda não informada.'}</p>
                      </div>

                      {/* Comprovantes anexados */}
                      {selectedEvento.comprovantes_gestor && selectedEvento.comprovantes_gestor.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 space-y-1.5">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Comprovantes de Despesas</span>
                          {selectedEvento.comprovantes_gestor.map((c: Attachment) => (
                            <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
                              <a 
                                href={c.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline truncate max-w-[90%]"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
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
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Formulário de Diária Oficial */}
                  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-6 rounded-2xl border border-indigo-100 space-y-4">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Parâmetros de Geração da Diária</span>
                    
                    {/* Valor Diária */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Valor Solicitado *</label>
                      <input 
                        type="text" 
                        value={valorDiaria}
                        onChange={(e) => setValorDiaria(e.target.value)}
                        placeholder="R$ 0,00"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      />
                    </div>

                    {/* Relatório Viagem */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Relatório da Viagem *</label>
                      <textarea
                        value={relatorioViagem}
                        onChange={(e) => setRelatorioViagem(e.target.value)}
                        placeholder="Descreva as atividades e os compromissos cumpridos no evento de viagem..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all min-h-[140px] resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              {adminStep === 'review' ? (
                <>
                  <button 
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Fechar
                  </button>
                  {selectedEvento.status === 'aguardando_administrador' && (
                    <button 
                      onClick={() => setAdminStep('approve')}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Aprovar Viagem
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setAdminStep('review')}
                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleAdminGenerate}
                    disabled={!valorDiaria || !relatorioViagem.trim() || isSubmitting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
