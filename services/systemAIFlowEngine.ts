import { User } from '../types';
import { canUserAccessRoute, isSuperAdminUser } from './permissionService';
import { getScreenMetadata, ScreenField, ScreenMetadata } from './systemScreenKnowledge';

export interface FlowStepProgress {
  currentStep: number;
  totalSteps: number;
  currentFieldLabel: string;
  workflowName: string;
}

export interface FlowQuickReply {
  label: string;
  value: string;
  actionType?: 'reply' | 'navigate' | 'confirm' | 'cancel';
  payload?: any;
}

export interface FlowState {
  workflowKey: string;
  targetRoute: string;
  targetModule: string;
  collectedData: Record<string, any>;
  pendingField?: ScreenField;
  isComplete: boolean;
  confirmed?: boolean;
}

export interface FlowEngineResult {
  handled: boolean;
  messageText: string;
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
  pendingAction?: {
    actionName: string;
    description: string;
    params: any;
    targetModule: string;
  };
  nextState?: FlowState | null;
}

// Definição dos fluxos guiados suportados com ordem lógica de campos
interface WorkflowDef {
  key: string;
  name: string;
  module: string;
  route: string;
  permissionKey: string;
  triggerKeywords: string[];
  fields: {
    name: string;
    label: string;
    type: 'text' | 'select' | 'date' | 'time' | 'number';
    options?: string[];
    suggestedChips?: string[];
    question: (dataSoFar: Record<string, any>) => string;
    extract: (text: string) => any;
  }[];
}

const WORKFLOW_DEFS: WorkflowDef[] = [
  // 1. Agendamento de Consultas
  {
    key: 'agendamento_consulta',
    name: 'Agendamento de Consulta',
    module: 'Consultas',
    route: '/Consultas/NovoAgendamento',
    permissionKey: 'sub_consultas_novo',
    triggerKeywords: ['consulta', 'agendamento', 'agendar consulta', 'marcar consulta', 'médico', 'especialidade'],
    fields: [
      {
        name: 'paciente',
        label: 'Nome do Paciente',
        type: 'text',
        suggestedChips: ['Para mim', 'João Silva', 'Maria Oliveira'],
        question: () => 'Qual é o nome completo do paciente para a consulta?',
        extract: (t) => {
          const match = t.match(/(?:para\s+(?:o\s+|a\s+)?|paciente\s+)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i);
          return match ? match[1].trim() : null;
        }
      },
      {
        name: 'procedimento',
        label: 'Especialidade',
        type: 'select',
        options: ['Cardiologia', 'Ortopedia', 'Clínico Geral', 'Pediatria', 'Ginecologia', 'Oftalmologia', 'Odontologia'],
        suggestedChips: ['Cardiologia', 'Ortopedia', 'Clínico Geral', 'Pediatria', 'Odontologia'],
        question: (data) => `Qual especialidade ou procedimento deseja agendar para **${data.paciente || 'o paciente'}**?`,
        extract: (t) => {
          const procs = ['Cardiologia', 'Ortopedia', 'Clínico Geral', 'Pediatria', 'Ginecologia', 'Oftalmologia', 'Odontologia'];
          const found = procs.find(p => new RegExp(p, 'i').test(t));
          return found || null;
        }
      },
      {
        name: 'data',
        label: 'Data',
        type: 'date',
        suggestedChips: ['Hoje', 'Amanhã', 'Próxima Segunda', 'Próxima Quarta'],
        question: () => 'Para qual data deseja agendar a consulta?',
        extract: (t) => {
          if (/hoje/i.test(t)) return 'Hoje';
          if (/amanh[aã]/i.test(t)) return 'Amanhã';
          const dateMatch = t.match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/);
          return dateMatch ? dateMatch[0] : null;
        }
      },
      {
        name: 'horario',
        label: 'Horário',
        type: 'time',
        options: ['08:00', '09:00', '10:00', '13:00', '14:00', '15:00', '16:00'],
        suggestedChips: ['08:00', '10:00', '14:00', '16:00'],
        question: () => 'Qual é o melhor horário?',
        extract: (t) => {
          const match = t.match(/\b([01]?\d|2[0-3])(?:[:hH]([0-5]\d)?)?\b/);
          if (match) {
            const h = match[1].padStart(2, '0');
            const m = match[2] ? match[2].padStart(2, '0') : '00';
            return `${h}:${m}`;
          }
          return null;
        }
      }
    ]
  },

  // 2. Solicitação de Diárias
  {
    key: 'solicitacao_diaria',
    name: 'Solicitação de Diária',
    module: 'Diárias',
    route: '/Diarias/Viajar',
    permissionKey: 'sub_diarias_viajar',
    triggerKeywords: ['diária', 'diaria', 'diárias', 'viagem', 'viajar', 'solicitar diária'],
    fields: [
      {
        name: 'beneficiario',
        label: 'Servidor Beneficiário',
        type: 'text',
        suggestedChips: ['Para meu usuário', 'João Servidor', 'Maria Coordenadora'],
        question: () => 'Para qual servidor municipal será a solicitação de diária?',
        extract: (t) => {
          const match = t.match(/(?:para\s+(?:o\s+|a\s+)?|servidor\s+)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i);
          return match ? match[1].trim() : null;
        }
      },
      {
        name: 'destino',
        label: 'Cidade de Destino',
        type: 'text',
        suggestedChips: ['Belo Horizonte - MG', 'Ipatinga - MG', 'Governador Valadares - MG', 'Brasília - DF'],
        question: (data) => `Qual é o destino da viagem de **${data.beneficiario || 'servidor'}**?`,
        extract: (t) => {
          const match = t.match(/(?:para|em|destino)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*(?:\s*-\s*[A-Z]{2})?)/i);
          return match ? match[1].trim() : null;
        }
      },
      {
        name: 'motivo',
        label: 'Motivo da Viagem',
        type: 'text',
        suggestedChips: ['Reunião na Secretaria de Estado', 'Capacitação / Curso', 'Transporte oficial de demandas', 'Audiência'],
        question: () => 'Qual é a finalidade ou motivo institucional da viagem?',
        extract: () => null
      },
      {
        name: 'dataPartida',
        label: 'Data de Ida',
        type: 'date',
        suggestedChips: ['Amanhã', 'Segunda-feira', 'Em 3 dias'],
        question: () => 'Qual é a data prevista de partida?',
        extract: (t) => {
          if (/hoje/i.test(t)) return 'Hoje';
          if (/amanh[aã]/i.test(t)) return 'Amanhã';
          const m = t.match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/);
          return m ? m[0] : null;
        }
      },
      {
        name: 'valor',
        label: 'Valor Estimado (R$)',
        type: 'number',
        suggestedChips: ['R$ 150,00', 'R$ 250,00', 'R$ 350,00', 'Conforme tabela padrão'],
        question: () => 'Qual é o valor solicitado para a diária (em R$)?',
        extract: (t) => {
          const m = t.match(/R?\$?\s*(\d+(?:[.,]\d{2})?)/i);
          return m ? m[1].replace(',', '.') : null;
        }
      }
    ]
  },

  // 3. Agendamento de Veículos
  {
    key: 'agendamento_veiculo',
    name: 'Agendamento de Veículo',
    module: 'Agendamento de Veículos',
    route: '/AgendamentoVeiculos/Novo',
    permissionKey: 'sub_veiculos_novo',
    triggerKeywords: ['veículo', 'veiculo', 'carro', 'van', 'ambulância', 'frota', 'spin', 'gol', 'agendar veículo'],
    fields: [
      {
        name: 'veiculo',
        label: 'Veículo da Frota',
        type: 'select',
        options: ['Chevrolet Spin (Placa ABC-1234)', 'VW Gol (Placa XYZ-9876)', 'Ambulância UTI Móvel', 'Fiat Ducato Escolar', 'Van Saúde'],
        suggestedChips: ['Spin (ABC-1234)', 'Gol (XYZ-9876)', 'Ambulância UTI', 'Van Saúde'],
        question: () => 'Qual veículo da frota municipal você deseja agendar?',
        extract: (t) => {
          if (/spin/i.test(t)) return 'Chevrolet Spin (Placa ABC-1234)';
          if (/gol/i.test(t)) return 'VW Gol (Placa XYZ-9876)';
          if (/ambul[aâ]ncia/i.test(t)) return 'Ambulância UTI Móvel';
          if (/van/i.test(t)) return 'Van Saúde';
          return null;
        }
      },
      {
        name: 'destino',
        label: 'Destino da Saída',
        type: 'text',
        suggestedChips: ['Belo Horizonte', 'Ipatinga', 'Itabira', 'Atividades Locais'],
        question: () => 'Qual é o destino da viagem?',
        extract: (t) => {
          const match = t.match(/(?:para|em|destino)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i);
          return match ? match[1].trim() : null;
        }
      },
      {
        name: 'dataSaida',
        label: 'Data e Hora de Saída',
        type: 'text',
        suggestedChips: ['Amanhã às 07:00', 'Amanhã às 13:00', 'Sexta-feira às 06:00'],
        question: () => 'Qual é a data e hora prevista para a saída do veículo?',
        extract: () => null
      }
    ]
  },

  // 4. Nova Tarefa
  {
    key: 'nova_tarefa',
    name: 'Criação de Tarefa',
    module: 'Tarefas',
    route: '/Tarefas/NovaTarefa',
    permissionKey: 'sub_tarefas_novo',
    triggerKeywords: ['tarefa', 'nova tarefa', 'criar tarefa', 'demanda', 'lembrete', 'atribuir tarefa'],
    fields: [
      {
        name: 'titulo',
        label: 'Título da Tarefa',
        type: 'text',
        suggestedChips: ['Revisar prestação de contas', 'Preparar documentação de licitação', 'Vistoria em obras municipais'],
        question: () => 'Qual é o título ou objetivo principal da tarefa?',
        extract: (t) => {
          const clean = t.replace(/^(?:criar|nova|cadastrar|adicionar)\s+tarefa\s*(?:para|sobre|de)?\s*/i, '').trim();
          return clean.length > 3 ? clean : null;
        }
      },
      {
        name: 'prioridade',
        label: 'Prioridade',
        type: 'select',
        options: ['Alta', 'Média', 'Baixa', 'Urgente'],
        suggestedChips: ['Alta', 'Média', 'Baixa', 'Urgente'],
        question: () => 'Qual o nível de prioridade da tarefa?',
        extract: (t) => {
          if (/urgente/i.test(t)) return 'Urgente';
          if (/alta/i.test(t)) return 'Alta';
          if (/baixa/i.test(t)) return 'Baixa';
          if (/m[eé]dia/i.test(t)) return 'Média';
          return null;
        }
      },
      {
        name: 'prazo',
        label: 'Prazo Limite',
        type: 'date',
        suggestedChips: ['Hoje até 17h', 'Amanhã', 'Próxima Sexta', 'Fim do Mês'],
        question: () => 'Qual é o prazo de conclusão?',
        extract: () => null
      }
    ]
  },

  // 5. Novo Evento no Calendário Oficial
  {
    key: 'novo_evento',
    name: 'Novo Evento no Calendário',
    module: 'Calendário',
    route: '/Calendario',
    permissionKey: 'parent_calendario',
    triggerKeywords: ['evento', 'novo evento', 'criar evento', 'compromisso', 'reunião', 'calendário', 'agendar evento'],
    fields: [
      {
        name: 'titulo',
        label: 'Título do Evento',
        type: 'text',
        suggestedChips: ['Reunião de Secretariado', 'Audiência Pública', 'Inauguração Oficial', 'Capacitação'],
        question: () => 'Qual é o título ou tema do evento oficial?',
        extract: (t) => {
          const clean = t.replace(/^(?:criar|novo|agendar|marcar)\s+(?:um\s+)?(?:evento|compromisso|reuni[aã]o)\s*(?:chamado|sobre|de|para)?\s*/i, '').trim();
          return clean.length > 3 ? clean : null;
        }
      },
      {
        name: 'dataInicio',
        label: 'Data do Evento',
        type: 'date',
        suggestedChips: ['Hoje', 'Amanhã', 'Próxima Segunda', 'Sexta-feira'],
        question: (data) => `Para qual data está previsto o evento **${data.titulo || ''}**?`,
        extract: (t) => {
          if (/hoje/i.test(t)) return 'Hoje';
          if (/amanh[aã]/i.test(t)) return 'Amanhã';
          const m = t.match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/);
          return m ? m[0] : null;
        }
      },
      {
        name: 'horaInicio',
        label: 'Horário de Início',
        type: 'time',
        options: ['08:00', '09:00', '10:00', '14:00', '15:00', 'Dia Inteiro'],
        suggestedChips: ['08:00', '09:00', '14:00', 'Dia Inteiro'],
        question: () => 'Qual é o horário de início (ou selecione se for dia inteiro)?',
        extract: (t) => {
          if (/dia\s+inteiro/i.test(t)) return 'Dia Inteiro';
          const match = t.match(/\b([01]?\d|2[0-3])(?:[:hH]([0-5]\d)?)?\b/);
          if (match) {
            const h = match[1].padStart(2, '0');
            const m = match[2] ? match[2].padStart(2, '0') : '00';
            return `${h}:${m}`;
          }
          return null;
        }
      },
      {
        name: 'tipoEvento',
        label: 'Tipo de Evento',
        type: 'select',
        options: ['Reunião', 'Ação Municipal', 'Inauguração', 'Audiência Pública', 'Capacitação', 'Outro'],
        suggestedChips: ['Reunião', 'Ação Municipal', 'Inauguração', 'Audiência Pública'],
        question: () => 'Qual é a categoria deste evento?',
        extract: (t) => {
          if (/reuni[aã]o/i.test(t)) return 'Reunião';
          if (/inaugura[cç][aã]o/i.test(t)) return 'Inauguração';
          if (/audi[eê]ncia/i.test(t)) return 'Audiência Pública';
          if (/capacita[cç][aã]o/i.test(t)) return 'Capacitação';
          if (/a[cç][aã]o/i.test(t)) return 'Ação Municipal';
          return null;
        }
      }
    ]
  }
];

export class SystemAIFlowEngine {
  /**
   * Processa a mensagem do usuário no contexto atual da tela
   */
  static processUserInput({
    userInput,
    currentPath,
    user,
    activeFlowState
  }: {
    userInput: string;
    currentPath: string;
    user: User;
    activeFlowState?: FlowState | null;
  }): FlowEngineResult {
    const text = (userInput || '').trim();
    const currentMeta = getScreenMetadata(currentPath);

    // 1. Respostas a perguntas de orientação sobre a tela atual ("Como faço?", "O que tem aqui?")
    if (this.isHowToQuestion(text)) {
      return this.handleHowToQuery(currentMeta);
    }

    // 2. Se já existe um fluxo ativo em andamento (continuação do preenchimento passo a passo)
    if (activeFlowState && !activeFlowState.isComplete) {
      return this.continueActiveFlow(activeFlowState, text, user, currentPath);
    }

    // 3. Verifica se a mensagem inicia um novo fluxo
    const matchingWorkflow = this.detectWorkflowIntent(text);
    if (!matchingWorkflow) {
      return { handled: false, messageText: '' };
    }

    // 4. Detecção de Mudança de Módulo (Cross-Module Detection)
    const isCurrentModule = currentMeta && (
      currentMeta.module.toLowerCase() === matchingWorkflow.module.toLowerCase() ||
      currentPath.toLowerCase().startsWith(matchingWorkflow.route.toLowerCase())
    );

    // Se o usuário está em outro módulo, avisa e solicita autorização prévia para navegar
    if (!isCurrentModule && currentMeta && currentMeta.module !== 'Início' && currentPath !== '/') {
      return this.buildContextSwitchOffer(matchingWorkflow, currentMeta, text, user);
    }

    // 5. Inicia o fluxo na tela atual (ou já aprovada)
    return this.startWorkflow(matchingWorkflow, text, user);
  }

  /**
   * Verifica se a pergunta do usuário é sobre o funcionamento da tela atual
   */
  private static isHowToQuestion(text: string): boolean {
    const patterns = [
      /como\s+(?:faço|fazer|funciona|preencho|uso|usar|proceder)/i,
      /o\s+que\s+(?:é|tem|posso\s+fazer)\s+aqui/i,
      /quais\s+(?:são\s+os\s+)?campos/i,
      /me\s+ajude\s+com\s+esta\s+tela/i,
      /expli(?:que|ca)\s+essa\s+tela/i
    ];
    return patterns.some(p => p.test(text));
  }

  /**
   * Responde dúvidas contextuais com base na tela atual
   */
  private static handleHowToQuery(meta: ScreenMetadata | null): FlowEngineResult {
    if (!meta) {
      return {
        handled: true,
        messageText: 'Você está no sistema integrado municipal. Pode me pedir consultas, tarefas, criação de diárias ou navegações a qualquer momento.'
      };
    }

    let guideText = `Você está na tela **${meta.title}** (Módulo ${meta.module}${meta.submodule ? ` / ${meta.submodule}` : ''}).\n\n`;
    guideText += `**Objetivo**: ${meta.description}\n\n`;
    guideText += `**Como realizar esta operação**: ${meta.howToGuide}\n\n`;

    if (meta.fields.length > 0) {
      guideText += `**Campos desta tela**:\n`;
      meta.fields.forEach(f => {
        guideText += `- **${f.label}** ${f.required ? '*(Obrigatório)*' : '*(Opcional)*'}\n`;
      });
    }

    const quickChips: FlowQuickReply[] = meta.availableActions.map(act => ({
      label: act,
      value: `Quero ${act.toLowerCase()}`
    }));

    return {
      handled: true,
      messageText: guideText,
      quickReplies: quickChips
    };
  }

  /**
   * Identifica se a intenção do usuário casa com um dos fluxos do sistema
   */
  private static detectWorkflowIntent(text: string): WorkflowDef | null {
    const normalized = text.toLowerCase();
    for (const wf of WORKFLOW_DEFS) {
      if (wf.triggerKeywords.some(kw => normalized.includes(kw))) {
        return wf;
      }
    }
    return null;
  }

  /**
   * Constrói proposta de troca de contexto quando a tarefa solicitada não pertence à tela atual
   */
  private static buildContextSwitchOffer(
    workflow: WorkflowDef,
    currentMeta: ScreenMetadata,
    rawText: string,
    user: User
  ): FlowEngineResult {
    // Valida permissão na tela de destino
    const check = canUserAccessRoute(workflow.route, user);
    if (!check.allowed && !isSuperAdminUser(user)) {
      return {
        handled: true,
        messageText: `Essa tarefa pertence ao módulo de **${workflow.module}**, mas você não possui permissão para acessar essa funcionalidade (${check.reason || 'Restrição de perfil'}).`,
        quickReplies: [
          { label: 'Voltar à tela atual', value: 'Continuar onde estou' }
        ]
      };
    }

    const initialData = this.extractInitialData(workflow, rawText);

    const promptText = `Essa tarefa pertence ao módulo de **${workflow.module}**, e você está atualmente em **${currentMeta.module}${currentMeta.submodule ? ` • ${currentMeta.submodule}` : ''}**.\n\nDeseja que eu acesse o fluxo de **${workflow.name}** para realizar essa tarefa?`;

    return {
      handled: true,
      messageText: promptText,
      navigationTarget: {
        route: workflow.route,
        module: workflow.module,
        description: workflow.name
      },
      quickReplies: [
        {
          label: `Sim, ir para ${workflow.module}`,
          value: 'CONFIRMAR_NAVEGACAO',
          actionType: 'navigate',
          payload: {
            targetRoute: workflow.route,
            workflowKey: workflow.key,
            collectedData: initialData
          }
        },
        {
          label: 'Permanecer aqui',
          value: 'CANCELAR_NAVEGACAO',
          actionType: 'cancel'
        }
      ],
      nextState: {
        workflowKey: workflow.key,
        targetRoute: workflow.route,
        targetModule: workflow.module,
        collectedData: initialData,
        isComplete: false
      }
    };
  }

  /**
   * Extrai dados que o usuário já informou na primeira frase (ex: paciente Maria, carro Spin)
   */
  private static extractInitialData(workflow: WorkflowDef, text: string): Record<string, any> {
    const data: Record<string, any> = {};
    for (const f of workflow.fields) {
      const val = f.extract(text);
      if (val) {
        data[f.name] = val;
      }
    }
    return data;
  }

  /**
   * Inicia um fluxo com perguntas passo a passo
   */
  private static startWorkflow(workflow: WorkflowDef, rawText: string, user: User): FlowEngineResult {
    // 1. Checa permissão do usuário
    const check = canUserAccessRoute(workflow.route, user);
    if (!check.allowed && !isSuperAdminUser(user)) {
      return {
        handled: true,
        messageText: `Não posso realizar essa ação porque seu usuário não possui permissão para o fluxo de **${workflow.name}** no módulo de **${workflow.module}**.`
      };
    }

    // 2. Extrai dados já existentes na mensagem inicial
    const collectedData = this.extractInitialData(workflow, rawText);

    // 3. Descobre o primeiro campo pendente
    const pendingField = workflow.fields.find(f => !collectedData[f.name]);

    if (!pendingField) {
      // Todos os campos já vieram na primeira mensagem!
      return this.buildConfirmationStep(workflow, collectedData);
    }

    const currentIdx = workflow.fields.indexOf(pendingField);
    const questionText = pendingField.question(collectedData);

    const quickChips: FlowQuickReply[] = (pendingField.suggestedChips || []).map(chip => ({
      label: chip,
      value: chip,
      actionType: 'reply'
    }));

    return {
      handled: true,
      messageText: questionText,
      flowProgress: {
        currentStep: currentIdx + 1,
        totalSteps: workflow.fields.length,
        currentFieldLabel: pendingField.label,
        workflowName: workflow.name
      },
      quickReplies: quickChips,
      nextState: {
        workflowKey: workflow.key,
        targetRoute: workflow.route,
        targetModule: workflow.module,
        collectedData,
        pendingField: pendingField as any,
        isComplete: false
      }
    };
  }

  /**
   * Continua um fluxo ativo (adiciona a resposta do usuário e pergunta o próximo campo)
   */
  private static continueActiveFlow(
    flowState: FlowState,
    userInput: string,
    user: User,
    currentPath: string
  ): FlowEngineResult {
    const workflow = WORKFLOW_DEFS.find(w => w.key === flowState.workflowKey);
    if (!workflow) {
      return { handled: false, messageText: '' };
    }

    // Se o usuário digitou cancelamento
    if (/cancelar|parar|esquece|desistir/i.test(userInput)) {
      return {
        handled: true,
        messageText: 'Operação cancelada. Nenhuma alteração foi efetuada no sistema.',
        nextState: null
      };
    }

    // Se o usuário clicou para navegar ou confirmou
    if (userInput === 'CONFIRMAR_NAVEGACAO' || /sim|pode\s+ir|vamos|confirmo/i.test(userInput)) {
      // Continua após a navegação
    } else if (flowState.pendingField) {
      // Salva o valor do campo anterior
      flowState.collectedData[flowState.pendingField.name] = userInput;
    }

    // Encontra o próximo campo obrigatório não preenchido
    const nextField = workflow.fields.find(f => !flowState.collectedData[f.name]);

    if (!nextField) {
      // Todos os campos preenchidos! Gera resumo e pede confirmação
      return this.buildConfirmationStep(workflow, flowState.collectedData);
    }

    const currentIdx = workflow.fields.indexOf(nextField);
    const questionText = nextField.question(flowState.collectedData);

    const quickChips: FlowQuickReply[] = (nextField.suggestedChips || []).map(chip => ({
      label: chip,
      value: chip,
      actionType: 'reply'
    }));

    return {
      handled: true,
      messageText: questionText,
      flowProgress: {
        currentStep: currentIdx + 1,
        totalSteps: workflow.fields.length,
        currentFieldLabel: nextField.label,
        workflowName: workflow.name
      },
      quickReplies: quickChips,
      nextState: {
        ...flowState,
        pendingField: nextField as any,
        isComplete: false
      }
    };
  }

  /**
   * Gera o resumo estruturado e botões de confirmação ao final da coleta
   */
  private static buildConfirmationStep(workflow: WorkflowDef, data: Record<string, any>): FlowEngineResult {
    const summaryItems = workflow.fields.map(f => ({
      label: f.label,
      value: String(data[f.name] || 'Não informado')
    }));

    const desc = `${workflow.name} (${summaryItems.map(s => `${s.label}: ${s.value}`).join(' • ')})`;

    const toolMap: Record<string, string> = {
      novo_evento: 'criar_evento_calendario',
      nova_tarefa: 'criar_nova_tarefa',
      agendamento_veiculo: 'agendar_veiculo',
      solicitacao_diaria: 'solicitar_diaria_viagem',
      agendamento_consulta: 'agendar_nova_consulta'
    };
    const realToolName = toolMap[workflow.key] || `exec_${workflow.key}`;

    return {
      handled: true,
      messageText: `Perfeito! Tenho todas as informações necessárias para **${workflow.name}**. Confira os dados antes de confirmar a execução:`,
      summaryCard: {
        title: workflow.name,
        items: summaryItems
      },
      pendingAction: {
        actionName: realToolName,
        description: desc,
        params: data,
        targetModule: workflow.module
      },
      quickReplies: [
        { label: '✓ Confirmar e Executar', value: 'CONFIRMAR_ACAO', actionType: 'confirm' },
        { label: '✕ Cancelar Operação', value: 'CANCELAR_ACAO', actionType: 'cancel' }
      ],
      nextState: {
        workflowKey: workflow.key,
        targetRoute: workflow.route,
        targetModule: workflow.module,
        collectedData: data,
        isComplete: true,
        confirmed: false
      }
    };
  }
}
