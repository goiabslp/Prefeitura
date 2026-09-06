import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Sparkles, User as UserIcon, CheckCircle2, 
  AlertTriangle, Clock, Calendar, CheckSquare, Car, Pill, 
  RotateCcw, ShieldCheck, ChevronRight, ExternalLink, Loader2,
  Compass, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdminUser } from '../../services/permissionService';
import { sendAIMessage, AIMessage } from '../../services/systemAIAssistantService';
import { FlowQuickReply, FlowState } from '../../services/systemAIFlowEngine';
import { getScreenMetadata } from '../../services/systemScreenKnowledge';
import { FormattedMessageContent } from '../chat/FormattedMessageContent';

interface SystemAIAssistantScreenProps {
  onNavigate?: (route: string) => void;
}

export const SystemAIAssistantScreen: React.FC<SystemAIAssistantScreenProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [activeFlowState, setActiveFlowState] = useState<FlowState | null>(null);
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSuper = isSuperAdminUser(user);

  useEffect(() => {
    const updatePath = () => {
      if (typeof window !== 'undefined') {
        setCurrentPath(window.location.pathname);
      }
    };
    updatePath();
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);

  const currentScreenMeta = getScreenMetadata(currentPath);

  // Inicialização com contexto
  useEffect(() => {
    if (!user) return;

    const initialGreeting: AIMessage = {
      id: 'welcome',
      sender: 'assistant',
      content: `Olá, **${user.name || user.username}**! Sou a **IA Assistente Operacional** integrada a todos os módulos e telas da Prefeitura.

Você está atualmente em: **${currentScreenMeta?.title || currentPath}** (${currentScreenMeta?.module || 'Geral'}).

Como posso acelerar sua rotina de trabalho agora?`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      cardType: 'info'
    };

    setMessages([initialGreeting]);
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || !user || isProcessing) return;

    setInputValue('');
    const userMsg: AIMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    setProcessingStatus('Analisando contexto operacional...');

    try {
      const result = await sendAIMessage({
        userMessage: text,
        user,
        conversationHistory: [...messages, userMsg],
        currentPath,
        activeFlowState
      });

      setMessages(prev => [...prev, result.message]);
      setActiveFlowState(result.nextFlowState || null);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          content: `Ocorreu um erro ao processar: ${err.message || 'Falha de comunicação.'}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'error'
        }
      ]);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleQuickReplyClick = async (chip: FlowQuickReply) => {
    if (chip.actionType === 'navigate' && chip.payload?.targetRoute) {
      if (onNavigate) {
        onNavigate(chip.payload.targetRoute);
      } else {
        window.history.pushState({}, '', chip.payload.targetRoute);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      setCurrentPath(chip.payload.targetRoute);
      await handleSendMessage('CONFIRMAR_NAVEGACAO');
    } else if (chip.actionType === 'confirm') {
      await handleSendMessage('Confirmado');
    } else if (chip.actionType === 'cancel') {
      await handleSendMessage('Cancelar');
    } else {
      await handleSendMessage(chip.value);
    }
  };

  const handleConfirmAction = async (msgId: string, pending: NonNullable<AIMessage['pendingConfirmation']>) => {
    if (!user || isProcessing) return;

    setIsProcessing(true);
    setProcessingStatus(`Executando e auditando "${pending.description}" no sistema...`);

    try {
      const result = await sendAIMessage({
        userMessage: 'Confirmado pelo usuário.',
        user,
        conversationHistory: messages,
        currentPath,
        confirmedTool: {
          actionName: pending.actionName,
          params: pending.params
        }
      });

      setMessages(prev => [
        ...prev.map(m => m.id === msgId ? { ...m, pendingConfirmation: undefined } : m),
        result.message
      ]);
      setActiveFlowState(null);
    } catch (err: any) {
      alert(`Falha ao executar ação: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages(prev => [
      ...prev.map(m => m.id === msgId ? { ...m, pendingConfirmation: undefined } : m),
      {
        id: `cancel-${Date.now()}`,
        sender: 'assistant',
        content: 'Operação cancelada conforme sua solicitação. Nenhuma alteração foi realizada no sistema.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setActiveFlowState(null);
  };

  const handleReset = () => {
    if (!user) return;
    setActiveFlowState(null);
    setMessages([
      {
        id: `reset-${Date.now()}`,
        sender: 'assistant',
        content: `Histórico reiniciado. O que você deseja executar agora, **${user.name || user.username}**?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        cardType: 'info'
      }
    ]);
  };

  const quickChips = [
    { label: '💡 Como usar esta tela?', query: 'Como faço para usar esta tela?' },
    { label: '📋 Campos obrigatórios', query: 'Quais são os campos obrigatórios desta tela?' },
    { label: 'Minhas tarefas pendentes', query: 'Quais são as minhas tarefas pendentes?' },
    { label: 'Eventos oficiais agendados', query: 'Mostre os eventos agendados no calendário oficial' },
    { label: 'Agendamentos de veículos', query: 'Quais viagens e agendamentos de veículos estão registrados?' },
    { label: 'Meus módulos permitidos', query: 'Quais módulos meu perfil tem permissão de acesso?' }
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] overflow-hidden font-sans">
      {/* Header Superior da Página */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                /AssistenteIA
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Operacional Ativo
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
              Assistente de IA Integrada
            </h1>
          </div>
        </div>

        {/* Badge do Usuário Conectado com Escopo e Nível Hierárquico */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Limpar Conversa"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              {user?.name || user?.username}
              {isSuper && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                  GAF / Super Admin
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium text-slate-500">
              {user?.role || 'Servidor'} • Permissões Validadas
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
        </div>
      </header>

      {/* Barra de Consciência de Tela */}
      <div className="px-6 py-2 bg-indigo-50/60 border-b border-indigo-100/80 flex items-center justify-between text-xs font-bold text-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-slate-500">Contexto ativo:</span>
          <span className="text-indigo-950 font-black">{currentScreenMeta?.title || currentPath}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200 shadow-2xs font-extrabold">
          Módulo: {currentScreenMeta?.module || 'Geral'}
        </span>
      </div>

      {/* Área Central de Conversa */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] md:max-w-[75%] space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Stepper de Progresso de Preenchimento */}
                  {msg.flowProgress && (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-900 shadow-2xs">
                      <span>{msg.flowProgress.workflowName} • Etapa {msg.flowProgress.currentStep} de {msg.flowProgress.totalSteps}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-200/80 text-indigo-900 font-extrabold">
                        {msg.flowProgress.currentFieldLabel}
                      </span>
                    </div>
                  )}

                  {/* Bolha da Mensagem de Texto (Speech Bubble Laranja Claro) */}
                  <div
                    className={`relative p-4 rounded-2xl text-xs md:text-sm leading-relaxed transition-all shadow-sm ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-tr-xs shadow-slate-900/10 ml-auto'
                        : 'bg-gradient-to-br from-orange-50 via-amber-50/90 to-orange-100/75 text-slate-800 rounded-tl-xs shadow-xs border border-orange-200/90 mr-auto'
                    }`}
                  >
                    <FormattedMessageContent content={msg.content} isUser={isUser} />

                    <div className={`text-[9px] mt-2.5 font-medium flex items-center gap-1 ${
                      isUser ? 'text-slate-400 justify-end' : 'text-orange-600/80 justify-start'
                    }`}>
                      <Clock className="w-2.5 h-2.5 opacity-80" />
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>

                  {/* Resumo Estruturado antes de Confirmar */}
                  {msg.summaryCard && (
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
                      <span className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                        Resumo: {msg.summaryCard.title}
                      </span>
                      <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-100">
                        {msg.summaryCard.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1 text-xs">
                            <span className="text-slate-500 font-medium">{item.label}:</span>
                            <span className="text-slate-900 font-bold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chips de Opções Rápidas (Quick Replies) */}
                  {msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.quickReplies.map((chip, idx) => {
                        const isNav = chip.actionType === 'navigate';
                        const isConfirm = chip.actionType === 'confirm';

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleQuickReplyClick(chip)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs flex items-center gap-1.5 border ${
                              isNav
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent hover:brightness-110'
                                : isConfirm
                                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'
                            }`}
                          >
                            {chip.label}
                            {isNav && <ArrowRight className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Card Interativo de Confirmação Pendente */}
                  {msg.pendingConfirmation && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 shadow-sm space-y-3 animate-slide-down">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                            Confirmação de Ação Requerida
                          </h4>
                          <p className="text-xs text-amber-900 mt-0.5 font-medium">
                            {msg.pendingConfirmation.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCancelAction(msg.id)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmAction(msg.id, msg.pendingConfirmation!)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Confirmar Execução
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Card Visual de Tarefas Retornadas */}
                  {msg.cardType === 'tarefas' && Array.isArray(msg.cardData) && msg.cardData.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                          Tarefas do Sistema ({msg.cardData.length})
                        </span>
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate('/Tarefas/MinhasTarefas')}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                          >
                            Ver Módulo <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {msg.cardData.map((t: any) => (
                          <div key={t.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-slate-900 block truncate">{t.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{t.protocol || t.id.slice(0, 8)}</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              t.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'in_progress'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {t.status === 'completed' ? 'Concluída' : t.status === 'in_progress' ? 'Em Andamento' : 'Pendente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card Visual de Eventos de Calendário */}
                  {msg.cardType === 'calendario' && Array.isArray(msg.cardData) && msg.cardData.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          Compromissos e Eventos ({msg.cardData.length})
                        </span>
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate('/Calendario')}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                          >
                            Abrir Calendário <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {msg.cardData.map((e: any) => (
                          <div key={e.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-slate-900 block truncate">{e.title}</span>
                              <span className="text-[10px] text-slate-500">{e.type} • {e.sector || 'Administração'}</span>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              {e.start_date} {e.start_time ? `às ${e.start_time}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card Visual de Veículos */}
                  {msg.cardType === 'veiculos' && Array.isArray(msg.cardData) && msg.cardData.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <Car className="w-3.5 h-3.5 text-indigo-600" />
                          Agendamentos de Veículos ({msg.cardData.length})
                        </span>
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate('/AgendamentoVeiculos')}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                          >
                            Acessar Frotas <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {msg.cardData.map((v: any) => (
                          <div key={v.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-slate-900 block truncate">Destino: {v.destination || 'Não especificado'}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{v.protocol || v.id.slice(0, 8)}</span>
                            </div>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {v.status || 'Ativo'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 text-xs font-black mt-0.5 shadow-sm">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'EU'}
                  </div>
                )}
              </div>
            );
          })}

          {/* Indicador de Processamento */}
          {isProcessing && (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2 shadow-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>{processingStatus || 'Processando sua solicitação com inteligência contextual...'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Rodapé com Sugestões e Input */}
      <footer className="shrink-0 bg-white border-t border-slate-200 p-4 md:p-5 z-20 space-y-3">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Chips de Ações Rápidas */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isProcessing}
                onClick={() => handleSendMessage(chip.query)}
                className="shrink-0 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Caixa de Entrada de Texto */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all shadow-2xs"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              disabled={isProcessing}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite o que deseja fazer ou pergunte sobre esta tela..."
              className="flex-1 bg-transparent px-3 py-2 text-xs md:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-500" />
              Operações auditadas e validadas conforme a matriz de permissões.
            </span>
            <span>Versão IA Nativa Contextual v3.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
