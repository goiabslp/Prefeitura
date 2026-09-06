import { User } from '../types';
import { executeAITool, SYSTEM_AI_TOOLS, ToolExecutionResult } from './systemAITools';
import { isSuperAdminUser } from './permissionService';
import { getScreenMetadata, ScreenMetadata } from './systemScreenKnowledge';
import { 
  SystemAIFlowEngine, 
  FlowQuickReply, 
  FlowStepProgress, 
  FlowState 
} from './systemAIFlowEngine';

export interface AIMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status?: 'sending' | 'delivered' | 'error';
  toolCall?: {
    toolName: string;
    params: any;
    result?: ToolExecutionResult;
  };
  cardData?: any;
  cardType?: 'tarefas' | 'calendario' | 'veiculos' | 'consultas' | 'farmacia' | 'perfil' | 'usuarios' | 'info';
  pendingConfirmation?: {
    actionName: string;
    description: string;
    params: any;
    targetModule: string;
  };
  // Novos campos para a experiência dinâmica e generativa
  quickReplies?: FlowQuickReply[];
  flowProgress?: FlowStepProgress;
  summaryCard?: {
    title: string;
    items: { label: string; value: string }[];
  };
  navigationTarget?: {
    route: string;
    module: string;
    description: string;
  };
}

export interface SendAIMessageOptions {
  userMessage: string;
  user: User;
  conversationHistory: AIMessage[];
  currentPath?: string;
  activeFlowState?: FlowState | null;
  confirmedTool?: {
    actionName: string;
    params: any;
  };
}

export interface SendAIMessageResult {
  message: AIMessage;
  nextFlowState?: FlowState | null;
}

/**
 * Constrói as instruções de contexto institucional do sistema para a IA com Consciência de Tela
 */
function buildSystemPrompt(user: User, screenMeta: ScreenMetadata | null): string {
  const isSuper = isSuperAdminUser(user);
  const userPerms = (user.permissions || []) as string[];

  let screenContextText = 'NENHUMA TELA ESPECÍFICA DETECTADA';
  if (screenMeta) {
    screenContextText = `
- Rota Atual: ${screenMeta.route}
- Módulo Atual: ${screenMeta.module}
- Submódulo: ${screenMeta.submodule || 'Geral'}
- Título da Tela: ${screenMeta.title}
- Descrição da Tela: ${screenMeta.description}
- Ações Disponíveis: ${screenMeta.availableActions.join(', ')}
- Campos da Tela: ${screenMeta.fields.map(f => `${f.label} (${f.name}) [${f.required ? 'Obrigatório' : 'Opcional'}]`).join(' | ')}
- Instruções de Uso desta Tela: ${screenMeta.howToGuide}
`;
  }

  return `
Você é a IA Operacional Nativa da Prefeitura Municipal de São José do Goiabal - MG ("Assistente Integrada").
Sua missão é atuar como uma assistente executiva inteligente, contextual, dinâmica e generativa, profundamente integrada às regras, telas e fluxos do município.

CONTEXTO DO USUÁRIO CONECTADO:
- ID: ${user.id}
- Nome: ${user.name || user.username}
- Cargo / Perfil: ${user.role || 'Servidor Municipal'}
- Super Administrador: ${isSuper ? 'SIM (Acesso Completo e Irrestrito)' : 'NÃO (Sujeito a permissões estritas)'}
- Permissões Ativas: ${isSuper ? 'TODAS (Super Admin GAF)' : (userPerms.length > 0 ? userPerms.join(', ') : 'Nenhuma permissão específica')}
- Data/Hora Atual: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}

CONTEXTO DA TELA EM QUE O USUÁRIO ESTÁ AGORA:
${screenContextText}

DIRETRIZES DE COMPORTAMENTO CONTEXTUAL:
1. TERMOS DÊITICOS: Quando o usuário disser "esse cadastro", "essa tela", "faça esse agendamento", "como faço aqui?", compreenda que ele se refere IMEDIATAMENTE à tela atual detalhada acima.
2. NUNCA RESPONDA GENERICAMENTE quando tiver informações sobre a tela atual. Explique os campos, regras e botões da página em que o servidor está trabalhando.
3. FORA DO CONTEXTO: Se o usuário pedir algo de outro módulo (ex: está em Consultas e pede Diárias), NÃO execute imediatamente de forma desgovernada. Alerte sobre a mudança de módulo e confirme a navegação.
4. PERMISSÕES INVIOLÁVEIS: Verifique sempre as permissões do usuário. Se não tiver acesso, responda com respeito e recusa categórica: "Não posso realizar essa ação porque seu usuário não possui permissão para..."
5. LINGUAGEM: Responda em Português do Brasil com postura proativa, profissional e institucional.

FERRAMENTAS OPERACIONAIS DISPONÍVEIS:
${Object.values(SYSTEM_AI_TOOLS).map(t => `- ${t.name}: ${t.description} (Módulo: ${t.module})`).join('\n')}

Quando o usuário solicitar uma consulta ou ação que corresponda a uma ferramenta, utilize o formato estruturado:
TOOL_CALL: {"toolName": "nome_da_ferramenta", "params": { ... }}
`;
}

/**
 * Envia uma mensagem para o Assistente IA Operacional com processamento contextual e generativo
 */
export async function sendAIMessage({
  userMessage,
  user,
  conversationHistory,
  currentPath = typeof window !== 'undefined' ? window.location.pathname : '/',
  activeFlowState,
  confirmedTool
}: SendAIMessageOptions): Promise<SendAIMessageResult> {
  // 1. Execução explícita de ferramenta confirmada pelo usuário
  if (confirmedTool) {
    const execResult = await executeAITool(confirmedTool.actionName, confirmedTool.params, user, true);
    return {
      message: {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        content: execResult.message,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        toolCall: {
          toolName: confirmedTool.actionName,
          params: confirmedTool.params,
          result: execResult
        },
        cardData: execResult.data,
        cardType: execResult.cardType
      },
      nextFlowState: null
    };
  }

  // 2. Passa pelo Motor de Fluxo Contextual e Preenchimento Inteligente (Slot-Filling)
  const flowResult = SystemAIFlowEngine.processUserInput({
    userInput: userMessage,
    currentPath,
    user,
    activeFlowState
  });

  if (flowResult.handled) {
    return {
      message: {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        content: flowResult.messageText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        quickReplies: flowResult.quickReplies,
        flowProgress: flowResult.flowProgress,
        summaryCard: flowResult.summaryCard,
        navigationTarget: flowResult.navigationTarget,
        pendingConfirmation: flowResult.pendingAction
      },
      nextFlowState: flowResult.nextState
    };
  }

  // 3. Processamento Generativo Inteligente com Gemini e Consciência de Tela
  try {
    const screenMeta = getScreenMetadata(currentPath);
    const systemInstruction = buildSystemPrompt(user, screenMeta);
    
    const messagesPayload = conversationHistory.slice(-8).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      content: m.content
    }));

    messagesPayload.push({
      role: 'user',
      content: userMessage
    });

    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'assistente_operacional',
        dados: {
          promptText: userMessage,
          systemInstruction,
          history: messagesPayload,
          userContext: {
            id: user.id,
            name: user.name || user.username,
            role: user.role,
            isSuperAdmin: isSuperAdminUser(user),
            currentRoute: currentPath,
            currentScreenTitle: screenMeta?.title
          }
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro de comunicação com o servidor (${res.status})`);
    }

    const data = await res.json();
    const rawText = data.text || '';

    // 4. Verifica se a resposta do modelo invocou uma ferramenta do sistema
    const toolCallMatch = rawText.match(/TOOL_CALL:\s*(\{[\s\S]*?\})/);
    if (toolCallMatch) {
      try {
        const parsed = JSON.parse(toolCallMatch[1]);
        const toolName = parsed.toolName;
        const params = parsed.params || {};

        const result = await executeAITool(toolName, params, user, false);

        if (result.requiresConfirmation && result.confirmationDetails) {
          const cleanContent = rawText.replace(toolCallMatch[0], '').trim() ||
            `Identifiquei sua solicitação para ${result.confirmationDetails.description}. Por se tratar de uma operação no sistema, confirme abaixo para prosseguir:`;

          return {
            message: {
              id: `ai-${Date.now()}`,
              sender: 'assistant',
              content: cleanContent,
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              pendingConfirmation: result.confirmationDetails,
              cardType: 'info',
              quickReplies: [
                { label: '✓ Confirmar Operação', value: 'CONFIRMAR_TOOL', actionType: 'confirm' },
                { label: '✕ Cancelar', value: 'CANCELAR_TOOL', actionType: 'cancel' }
              ]
            },
            nextFlowState: null
          };
        }

        const textWithoutTool = rawText.replace(toolCallMatch[0], '').trim();
        const finalContent = textWithoutTool 
          ? `${textWithoutTool}\n\n${result.message}`
          : result.message;

        return {
          message: {
            id: `ai-${Date.now()}`,
            sender: 'assistant',
            content: finalContent,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            toolCall: {
              toolName,
              params,
              result
            },
            cardData: result.data,
            cardType: result.cardType
          },
          nextFlowState: null
        };
      } catch (e) {
        console.error('Falha ao processar tool call da IA:', e);
      }
    }

    // 5. Resposta conversacional generativa adaptada à tela
    return {
      message: {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        content: rawText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      },
      nextFlowState: null
    };
  } catch (error: any) {
    console.error('Erro no Assistente IA:', error);
    return {
      message: {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        content: `Não foi possível processar sua solicitação no momento: ${error.message || 'Falha de comunicação com o serviço de inteligência.'}. Por favor, tente novamente em instantes.`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'error'
      },
      nextFlowState: null
    };
  }
}
