import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, X, Send, Maximize2, AlertTriangle, CheckCircle2, 
  RotateCcw, Clock, CheckSquare, Calendar, Car, Compass, Loader2, ArrowRight
} from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdminUser } from '../../services/permissionService';
import { sendAIMessage, AIMessage } from '../../services/systemAIAssistantService';
import { FlowQuickReply, FlowState } from '../../services/systemAIFlowEngine';
import { getScreenMetadata } from '../../services/systemScreenKnowledge';
import { FormattedMessageContent } from './FormattedMessageContent';

export const ChatWindow: React.FC = () => {
  const { isOpen, setIsOpen } = useChat();
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
  const windowRef = useRef<HTMLDivElement>(null);

  const isSuper = isSuperAdminUser(user);

  // Monitora alterações na URL para atualizar o contexto de tela em tempo real
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

  // Inicializa a saudação contextual da IA com dados da tela atual
  useEffect(() => {
    if (!user) return;

    const screenLabel = currentScreenMeta 
      ? `Você está em **${currentScreenMeta.title}** (${currentScreenMeta.module}).`
      : 'Estou conectada ao sistema municipal.';

    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        content: `Olá, **${user.name || user.username}**! Sou a **IA Assistente Operacional** do sistema.
${screenLabel}

Diga o que você deseja realizar ou peça orientações sobre esta tela!`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        cardType: 'info'
      }
    ]);
  }, [user]);

  // Fecha clicando fora se não clicar no botão toggle
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (windowRef.current && !windowRef.current.contains(event.target as Node)) {
        const isToggleBtn = (event.target as Element).closest('.chat-toggle-btn');
        if (!isToggleBtn) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isProcessing, isOpen]);

  if (!isOpen) return null;

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
    setProcessingStatus('Analisando intenção e contexto...');

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
          content: `Falha ao processar: ${err.message || 'Erro de conexão com o serviço de IA.'}`,
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
      // 1. Navega para a tela requerida preservando o contexto
      window.history.pushState({}, '', chip.payload.targetRoute);
      window.dispatchEvent(new PopStateEvent('popstate'));
      setCurrentPath(chip.payload.targetRoute);

      // 2. Notifica a IA que a navegação foi executada e continua a tarefa
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
    setProcessingStatus(`Executando ${pending.description}...`);

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
      alert(`Erro ao executar: ${err.message}`);
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
        content: 'Operação cancelada. Nenhuma alteração foi realizada no sistema.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setActiveFlowState(null);
  };

  const handleExpandFullScreen = () => {
    setIsOpen(false);
    window.history.pushState({}, '', '/AssistenteIA');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleResetChat = () => {
    if (!user) return;
    setActiveFlowState(null);
    setMessages([
      {
        id: `reset-${Date.now()}`,
        sender: 'assistant',
        content: `Histórico reiniciado. O que você deseja realizar agora, **${user.name || user.username}**?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        cardType: 'info'
      }
    ]);
  };

  return (
    <div
      ref={windowRef}
      className="fixed bottom-15 md:bottom-17 right-3 md:right-5 z-50 flex h-[560px] max-h-[calc(100vh-85px)] w-[390px] max-w-[calc(100vw-24px)] overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl animate-slide-up flex-col font-sans"
    >
      {/* Cabeçalho do Chat com IA Contextual */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs tracking-tight">IA Operacional</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-[10px] text-white/90 font-medium truncate max-w-[180px]">
              {user?.name || user?.username} {isSuper ? '• GAF' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleResetChat}
            className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
            title="Limpar conversa"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleExpandFullScreen}
            className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
            title="Expandir para Tela Cheia (/AssistenteIA)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra de Consciência de Tela em Tempo Real */}
      <div className="px-3.5 py-1.5 bg-orange-50/70 border-b border-orange-100 flex items-center justify-between text-[10px] font-bold text-orange-900 shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <Compass className="w-3 h-3 text-orange-600 shrink-0" />
          <span className="text-orange-500 font-medium">Tela atual:</span>
          <span className="text-orange-950 font-extrabold truncate">
            {currentScreenMeta?.title || currentPath}
          </span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white text-orange-800 border border-orange-200/80 shadow-2xs shrink-0">
          {currentScreenMeta?.module || 'Geral'}
        </span>
      </div>

      {/* Feed de Mensagens entre Usuário e IA */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-[#fdfcfb] custom-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[90%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Stepper / Progresso do Fluxo */}
                {msg.flowProgress && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-orange-50 border border-orange-200/80 text-[10px] font-bold text-orange-950 shadow-2xs">
                    <span>{msg.flowProgress.workflowName} • Etapa {msg.flowProgress.currentStep} de {msg.flowProgress.totalSteps}</span>
                    <span className="px-1.5 py-0.5 rounded bg-orange-200/80 text-orange-900 font-extrabold">
                      {msg.flowProgress.currentFieldLabel}
                    </span>
                  </div>
                )}

                {/* Balão de Diálogo Autêntico (Speech Bubble) */}
                <div
                  className={`relative p-3.5 text-xs leading-relaxed transition-all shadow-sm ${
                    isUser
                      ? 'bg-slate-900 text-white rounded-2xl rounded-tr-xs shadow-slate-900/10 ml-auto'
                      : 'bg-gradient-to-br from-orange-50 via-amber-50/90 to-orange-100/75 text-slate-800 rounded-2xl rounded-tl-xs shadow-xs border border-orange-200/90 mr-auto'
                  }`}
                >
                  <FormattedMessageContent content={msg.content} isUser={isUser} />

                  <div className={`text-[9px] mt-2 font-medium flex items-center gap-1 ${
                    isUser ? 'text-slate-400 justify-end' : 'text-orange-600/80 justify-start'
                  }`}>
                    <Clock className="w-2.5 h-2.5 opacity-80" />
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {/* Resumo Estruturado de Dados Coletados */}
                {msg.summaryCard && (
                  <div className="p-3 rounded-2xl bg-white border border-orange-200 shadow-xs space-y-2 text-xs">
                    <span className="font-extrabold text-orange-950 text-[11px] flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5 text-orange-600" />
                      Resumo: {msg.summaryCard.title}
                    </span>
                    <div className="grid grid-cols-1 gap-1 pt-1.5 border-t border-orange-100">
                      {msg.summaryCard.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 text-[11px]">
                          <span className="text-slate-500 font-medium">{item.label}:</span>
                          <span className="text-slate-900 font-bold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chips de Opções Clicáveis (Quick Replies) */}
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.quickReplies.map((chip, idx) => {
                      const isNav = chip.actionType === 'navigate';
                      const isConfirm = chip.actionType === 'confirm';

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickReplyClick(chip)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs flex items-center gap-1 border ${
                            isNav
                              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border-transparent hover:brightness-110'
                              : isConfirm
                              ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                              : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-50 hover:border-orange-300'
                          }`}
                        >
                          {chip.label}
                          {isNav && <ArrowRight className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Confirmação Pendente */}
                {msg.pendingConfirmation && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs animate-slide-down">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span className="font-bold text-amber-950">
                        {msg.pendingConfirmation.description}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCancelAction(msg.id)}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmAction(msg.id, msg.pendingConfirmation!)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}

                {/* Cards Operacionais de Dados (Tarefas / Veículos / Calendário) */}
                {msg.cardType === 'tarefas' && Array.isArray(msg.cardData) && msg.cardData.length > 0 && (
                  <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                      <CheckSquare className="w-3 h-3 text-orange-600" />
                      Tarefas Localizadas ({msg.cardData.length})
                    </span>
                    {msg.cardData.slice(0, 3).map((t: any) => (
                      <div key={t.id} className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="truncate pr-1 text-slate-900 font-medium">{t.title}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                          {t.status || 'Pendente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Card de Calendário */}
                {msg.cardType === 'calendario' && Array.isArray(msg.cardData) && msg.cardData.length > 0 && (
                  <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3 h-3 text-orange-600" />
                      Eventos do Calendário ({msg.cardData.length})
                    </span>
                    {msg.cardData.slice(0, 3).map((e: any) => (
                      <div key={e.id} className="p-1.5 rounded-lg bg-orange-50/50 border border-orange-100 flex items-center justify-between text-[11px]">
                        <span className="truncate pr-1 text-slate-900 font-medium">{e.title}</span>
                        <span className="text-[9px] font-mono font-bold text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded">
                          {e.start_date}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Indicador de Processamento */}
        {isProcessing && (
          <div className="flex items-center gap-2 animate-pulse text-xs text-orange-950 font-bold p-2.5 bg-orange-50 rounded-2xl border border-orange-200 shadow-xs">
            <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
            <span>{processingStatus || 'Processando com inteligência operacional...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Atalhos Rápidos Contextuais da Tela */}
      <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => handleSendMessage('Como faço essa operação?')}
          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
        >
          💡 Como funciona esta tela?
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('Quais são os campos obrigatórios?')}
          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200/60 transition-colors whitespace-nowrap cursor-pointer shrink-0"
        >
          📋 Campos obrigatórios
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage('Minhas tarefas pendentes')}
          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-orange-50 hover:text-orange-800 transition-colors whitespace-nowrap cursor-pointer shrink-0"
        >
          Tarefas
        </button>
      </div>

      {/* Caixa de Entrada e Envio */}
      <div className="p-3 bg-white border-t border-slate-200/80 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Diga o que deseja fazer ou pergunte..."
            disabled={isProcessing}
            className="flex-1 px-3.5 py-2.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 placeholder-slate-400 rounded-xl border border-transparent focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center transition-all duration-200 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-orange-500/25 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
