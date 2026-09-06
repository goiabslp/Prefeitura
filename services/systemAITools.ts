import { User } from '../types';
import { canUserAccessRoute, isSuperAdminUser } from './permissionService';
import { auditLogService } from './auditLogService';
import * as taskService from './taskService';
import { calendarService } from './calendarService';
import * as vehicleService from './vehicleSchedulingService';
import * as consultasService from './consultasService';
import * as farmaciaService from './farmaciaService';
import { supabase } from './supabaseClient';

function checkRouteAccess(user: User, route: string): boolean {
  if (isSuperAdminUser(user)) return true;
  return canUserAccessRoute(route, user).allowed;
}

export interface ToolParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  module: string;
  requiredRoute?: string;
  requiredPermission?: string;
  requiresConfirmation?: boolean;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
  execute: (params: any, user: User) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: any;
  cardType?: 'tarefas' | 'calendario' | 'veiculos' | 'consultas' | 'farmacia' | 'perfil' | 'usuarios' | 'info';
  requiresConfirmation?: boolean;
  confirmationDetails?: {
    actionName: string;
    description: string;
    params: any;
    targetModule: string;
  };
}

/**
 * Catálogo de Ferramentas Nativas Operacionais da IA.
 * Nenhuma ferramenta acessa o banco diretamente sem passar por canUserAccessRoute ou verificação hierárquica.
 */
export const SYSTEM_AI_TOOLS: Record<string, ToolDefinition> = {
  // 1. Perfil e Permissões do Usuário Autenticado
  consultar_meu_perfil_e_permissoes: {
    name: 'consultar_meu_perfil_e_permissoes',
    description: 'Consulta os dados, cargo, permissões ativas e restrições do usuário atualmente logado.',
    module: 'Sistema',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async (_params, user) => {
      const isSuper = isSuperAdminUser(user);
      return {
        success: true,
        message: `Perfil de ${user.name || user.username} identificado.`,
        data: {
          id: user.id,
          nome: user.name,
          username: user.username,
          cargo: user.role,
          email: user.email,
          superAdmin: isSuper,
          totalPermissoes: user.permissions?.length || 0,
          permissoes: user.permissions || []
        },
        cardType: 'perfil'
      };
    }
  },

  // 2. Módulos Disponíveis para o Usuário
  consultar_modulos_disponiveis: {
    name: 'consultar_modulos_disponiveis',
    description: 'Lista todos os módulos e funcionalidades que o usuário atual possui autorização para utilizar.',
    module: 'Sistema',
    parameters: {
      type: 'object',
      properties: {}
    },
    execute: async (_params, user) => {
      const modulos = [
        { nome: 'Tarefas', rota: '/Tarefas/MinhasTarefas', permitido: checkRouteAccess(user, '/Tarefas') },
        { nome: 'Calendário Oficial', rota: '/Calendario', permitido: checkRouteAccess(user, '/Calendario') },
        { nome: 'Agendamento de Veículos', rota: '/AgendamentoVeiculos', permitido: checkRouteAccess(user, '/AgendamentoVeiculos') },
        { nome: 'Consultas e Saúde', rota: '/Consultas', permitido: checkRouteAccess(user, '/Consultas') },
        { nome: 'Farmácia Popular', rota: '/FarmaciaPopular', permitido: checkRouteAccess(user, '/FarmaciaPopular') },
        { nome: 'Diárias de Viagem', rota: '/Diarias', permitido: checkRouteAccess(user, '/Diarias') },
        { nome: 'Compras e Licitações', rota: '/Compras', permitido: checkRouteAccess(user, '/Compras') },
        { nome: 'Administração Geral', rota: '/Admin', permitido: checkRouteAccess(user, '/Admin') }
      ];

      return {
        success: true,
        message: `Módulos consultados com base nas permissões de ${user.name || user.username}.`,
        data: modulos.filter(m => m.permitido || isSuperAdminUser(user)),
        cardType: 'info'
      };
    }
  },

  // 3. Consultar Tarefas
  consultar_minhas_tarefas: {
    name: 'consultar_minhas_tarefas',
    description: 'Consulta as tarefas atribuídas ao usuário ou tarefas ativas no sistema.',
    module: 'Tarefas',
    requiredRoute: '/Tarefas',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtrar por status da tarefa',
          enum: ['todos', 'pending', 'in_progress', 'completed']
        }
      }
    },
    execute: async (params, user) => {
      if (!checkRouteAccess(user, '/Tarefas')) {
        return {
          success: false,
          message: 'Seu usuário não possui autorização para consultar o módulo de Tarefas.'
        };
      }

      try {
        const tasks = await taskService.getTasks();
        const filtered = tasks.filter(t => {
          const matchUser = t.assigned_user_id === user.id || t.userId === user.id || isSuperAdminUser(user);
          if (!matchUser) return false;
          if (params.status && params.status !== 'todos') {
            return t.status === params.status;
          }
          return true;
        }).slice(0, 15);

        return {
          success: true,
          message: `Encontradas ${filtered.length} tarefas relevantes.`,
          data: filtered,
          cardType: 'tarefas'
        };
      } catch (err: any) {
        return { success: false, message: `Erro ao consultar tarefas: ${err.message}` };
      }
    }
  },

  // 4. Criar Nova Tarefa
  criar_nova_tarefa: {
    name: 'criar_nova_tarefa',
    description: 'Cria uma nova tarefa no sistema com título, descrição e prazo.',
    module: 'Tarefas',
    requiredRoute: '/Tarefas/NovaTarefa',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título da tarefa' },
        descricao: { type: 'string', description: 'Detalhamento do que deve ser feito' },
        publica: { type: 'boolean', description: 'Se a tarefa é visível para o setor' }
      },
      required: ['titulo']
    },
    execute: async (params, user) => {
      if (!checkRouteAccess(user, '/Tarefas/NovaTarefa')) {
        return {
          success: false,
          message: 'Acesso negado: Seu usuário não possui autorização para criar novas tarefas.'
        };
      }

      try {
        const newTask = await taskService.createTask({
          title: params.titulo,
          description: params.descricao || '',
          status: 'pending',
          is_public: params.publica ?? true,
          userId: user.id,
          userName: user.name || user.username,
          assigned_user_id: user.id
        });

        if (!newTask) {
          return { success: false, message: 'Não foi possível salvar a tarefa no banco de dados.' };
        }

        await auditLogService.logAction({
          action_type: 'AI_ASSISTANT_ACTION',
          module: 'Tarefas',
          description: `IA criou nova tarefa: "${params.titulo}"`,
          details: { taskId: newTask.id, protocol: newTask.protocol }
        });

        return {
          success: true,
          message: `Tarefa criada com sucesso! Protocolo: ${newTask.protocol}`,
          data: newTask,
          cardType: 'tarefas'
        };
      } catch (err: any) {
        return { success: false, message: `Falha ao criar tarefa: ${err.message}` };
      }
    }
  },

  // 5. Atualizar Status de Tarefa
  atualizar_status_tarefa: {
    name: 'atualizar_status_tarefa',
    description: 'Atualiza o status de uma tarefa para pending, in_progress ou completed.',
    module: 'Tarefas',
    requiredRoute: '/Tarefas',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        tarefaId: { type: 'string', description: 'ID da tarefa a ser atualizada' },
        novoStatus: {
          type: 'string',
          description: 'Novo status da tarefa',
          enum: ['pending', 'in_progress', 'completed']
        }
      },
      required: ['tarefaId', 'novoStatus']
    },
    execute: async (params, user) => {
      if (!checkRouteAccess(user, '/Tarefas')) {
        return { success: false, message: 'Seu usuário não possui autorização para gerenciar tarefas.' };
      }

      try {
        const ok = await taskService.updateTaskStatus(params.tarefaId, params.novoStatus);
        if (!ok) return { success: false, message: 'Não foi possível atualizar o status da tarefa.' };

        await auditLogService.logAction({
          action_type: 'AI_ASSISTANT_ACTION',
          module: 'Tarefas',
          description: `IA alterou status da tarefa ${params.tarefaId} para ${params.novoStatus}`,
          details: { taskId: params.tarefaId, novoStatus: params.novoStatus }
        });

        return {
          success: true,
          message: `Status da tarefa atualizado para "${params.novoStatus}" com sucesso.`,
          data: { id: params.tarefaId, status: params.novoStatus },
          cardType: 'tarefas'
        };
      } catch (err: any) {
        return { success: false, message: `Erro ao atualizar status: ${err.message}` };
      }
    }
  },

  // 6. Consultar Eventos do Calendário
  consultar_eventos_calendario: {
    name: 'consultar_eventos_calendario',
    description: 'Consulta eventos oficiais, audiências, compromissos e solenidades municipais no calendário.',
    module: 'Calendário',
    requiredRoute: '/Calendario',
    parameters: {
      type: 'object',
      properties: {
        periodo: { type: 'string', description: 'Período de busca (ex: hoje, semana, mes)' }
      }
    },
    execute: async (_params, user) => {
      if (!checkRouteAccess(user, '/Calendario')) {
        return { success: false, message: 'Seu usuário não possui acesso ao módulo de Calendário Oficial.' };
      }

      try {
        const now = new Date();
        const startStr = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        const endStr = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        const events = await calendarService.fetchEvents(startStr, endStr);
        const recentEvents = events.filter(e => {
          if (!e.start_date) return false;
          const evDate = new Date(e.start_date);
          const diffDays = (evDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
          return diffDays >= -7 && diffDays <= 45;
        }).slice(0, 10);

        return {
          success: true,
          message: `Encontrados ${recentEvents.length} eventos no calendário institucional.`,
          data: recentEvents,
          cardType: 'calendario'
        };
      } catch (err: any) {
        return { success: false, message: `Erro ao consultar calendário: ${err.message}` };
      }
    }
  },

  // 7. Criar Evento no Calendário
  criar_evento_calendario: {
    name: 'criar_evento_calendario',
    description: 'Agenda um novo compromisso ou evento oficial no calendário da prefeitura.',
    module: 'Calendário',
    requiredRoute: '/Calendario',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título do evento' },
        tipo: { type: 'string', description: 'Tipo do evento (ex: Reunião, Audiência, Solenidade, Inauguração)' },
        dataInicio: { type: 'string', description: 'Data de início no formato YYYY-MM-DD' },
        horaInicio: { type: 'string', description: 'Horário de início (ex: 14:00)' },
        descricao: { type: 'string', description: 'Descrição ou pauta do compromisso' },
        setor: { type: 'string', description: 'Setor organizador' }
      },
      required: ['titulo', 'dataInicio']
    },
    execute: async (params, user) => {
      if (!checkRouteAccess(user, '/Calendario') && !checkRouteAccess(user, '/Calendario/Novo')) {
        return { success: false, message: 'Acesso negado: Seu usuário não tem permissão para cadastrar eventos no calendário.' };
      }

      try {
        const res = await calendarService.createEventWithInvites({
          title: params.titulo,
          type: params.tipo || 'Reunião',
          start_date: params.dataInicio,
          end_date: params.dataInicio,
          start_time: params.horaInicio || '09:00',
          description: params.descricao || '',
          sector: params.setor || 'Administração',
          created_by: user.id
        }, []);

        if (!res.success) {
          return { success: false, message: `Não foi possível agendar o evento: ${res.error || 'Erro interno'}` };
        }

        await auditLogService.logAction({
          action_type: 'AI_ASSISTANT_ACTION',
          module: 'Calendário',
          description: `IA agendou evento: "${params.titulo}" em ${params.dataInicio}`,
          details: { eventId: res.id, params }
        });

        return {
          success: true,
          message: `Evento "${params.titulo}" agendado com sucesso para ${params.dataInicio}!`,
          data: { id: res.id, ...params },
          cardType: 'calendario'
        };
      } catch (err: any) {
        return { success: false, message: `Erro ao agendar evento: ${err.message}` };
      }
    }
  },

  // 8. Consultar Agendamentos de Veículos
  consultar_agendamentos_veiculos: {
    name: 'consultar_agendamentos_veiculos',
    description: 'Consulta viagens e agendamentos de veículos da frota municipal.',
    module: 'Veículos',
    requiredRoute: '/AgendamentoVeiculos',
    parameters: {
      type: 'object',
      properties: {
        destino: { type: 'string', description: 'Filtrar por cidade de destino' }
      }
    },
    execute: async (params, user) => {
      if (!checkRouteAccess(user, '/AgendamentoVeiculos')) {
        return { success: false, message: 'Seu perfil não possui autorização para consultar agendamento de veículos.' };
      }

      try {
        const schedules = await vehicleService.getSchedules();
        const filtered = schedules.filter(s => {
          if (params.destino && !s.destination?.toLowerCase().includes(params.destino.toLowerCase())) {
            return false;
          }
          return true;
        }).slice(0, 10);

        return {
          success: true,
          message: `Localizados ${filtered.length} agendamentos de veículos.`,
          data: filtered,
          cardType: 'veiculos'
        };
      } catch (err: any) {
        return { success: false, message: `Erro ao buscar agendamentos de veículos: ${err.message}` };
      }
    }
  },

  // 9. Consultar Pacientes da Saúde
  consultar_pacientes_consultas: {
    name: 'consultar_pacientes_consultas',
    description: 'Consulta o cadastro de pacientes da saúde municipal por nome ou CPF.',
    module: 'Consultas',
    requiredRoute: '/Consultas/Pacientes',
    parameters: {
      type: 'object',
      properties: {
        termoBusca: { type: 'string', description: 'Nome completo, parcial ou CPF do paciente' }
      },
      required: ['termoBusca']
    },
    execute: async (params, user) => {
      if (!checkRouteAccess(user, '/Consultas')) {
        return { success: false, message: 'Acesso negado: Seu usuário não possui autorização para acessar o módulo de Consultas e Saúde.' };
      }

      try {
        const pacientes = await consultasService.getPacientes();
        const q = (params.termoBusca || '').toLowerCase().trim();
        const matched = pacientes.filter(p => 
          p.name?.toLowerCase().includes(q) || 
          p.cpf?.includes(q.replace(/\D/g, '')) ||
          (p.sus_number && p.sus_number.includes(q))
        ).slice(0, 8);

        return {
          success: true,
          message: matched.length > 0
            ? `Encontrado(s) ${matched.length} paciente(s) compatíveis.`
            : `Nenhum paciente localizado com o termo "${params.termoBusca}".`,
          data: matched,
          cardType: 'consultas'
        };
      } catch (err: any) {
        return { success: false, message: `Erro ao consultar pacientes: ${err.message}` };
      }
    }
  },

  // 10. Consultar Medicamentos na Farmácia Popular
  consultar_medicamentos_farmacia: {
    name: 'consultar_medicamentos_farmacia',
    description: 'Consulta estoque e disponibilidade de medicamentos da Farmácia Municipal.',
    module: 'Farmácia',
    requiredRoute: '/FarmaciaPopular',
    parameters: {
      type: 'object',
      properties: {
        nomeMedicamento: { type: 'string', description: 'Nome ou princípio ativo do medicamento' }
      },
      required: ['nomeMedicamento']
    },
    execute: async (params, user) => {
      if (!checkRouteAccess(user, '/FarmaciaPopular')) {
        return { success: false, message: 'Seu usuário não possui permissão para consultar o estoque da Farmácia Popular.' };
      }

      try {
        const meds = await farmaciaService.getMedicamentos();
        const q = (params.nomeMedicamento || '').toLowerCase().trim();
        const matched = meds.filter(m => 
          m.nome?.toLowerCase().includes(q) || 
          m.principio_ativo?.toLowerCase().includes(q)
        ).slice(0, 8);

        return {
          success: true,
          message: matched.length > 0 
            ? `Localizados ${matched.length} medicamentos no estoque municipal.`
            : `Medicamento "${params.nomeMedicamento}" não localizado no estoque.`,
          data: matched,
          cardType: 'farmacia'
        };
      } catch (err: any) {
        return { success: false, message: `Erro ao consultar medicamentos: ${err.message}` };
      }
    }
  },

  // 11. Consultar Usuários do Sistema (Apenas Administradores)
  consultar_usuarios_sistema: {
    name: 'consultar_usuarios_sistema',
    description: 'Consulta os usuários cadastrados e seus respectivos setores (Requer autorização administrativa).',
    module: 'Administração',
    requiredRoute: '/Admin/Usuarios',
    parameters: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Nome ou email para filtrar' }
      }
    },
    execute: async (params, user) => {
      if (!checkRouteAccess(user, '/Admin/Usuarios') && !isSuperAdminUser(user)) {
        return {
          success: false,
          message: 'Acesso restrito: Apenas administradores com permissão em /Admin/Usuarios podem consultar a lista de usuários do sistema.'
        };
      }

      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, name, email, role, status, created_at')
          .order('name', { ascending: true })
          .limit(30);

        if (error) throw error;

        let filtered = profiles || [];
        if (params.busca) {
          const b = params.busca.toLowerCase();
          filtered = filtered.filter(p => p.name?.toLowerCase().includes(b) || p.email?.toLowerCase().includes(b));
        }

        return {
          success: true,
          message: `Lista de ${filtered.length} usuários retornada com sucesso.`,
          data: filtered,
          cardType: 'usuarios'
        };
      } catch (err: any) {
        return { success: false, message: `Erro ao listar usuários: ${err.message}` };
      }
    }
  }
};

/**
 * Valida permissões e executa uma ferramenta do catálogo
 */
export async function executeAITool(
  toolName: string,
  params: any,
  user: User,
  isConfirmed: boolean = false
): Promise<ToolExecutionResult> {
  const tool = SYSTEM_AI_TOOLS[toolName];
  if (!tool) {
    return {
      success: false,
      message: `Ferramenta operacional "${toolName}" não reconhecida pelo sistema.`
    };
  }

  // 1. Verificação de Usuário
  if (!user || user.status === 'blocked') {
    return {
      success: false,
      message: 'Operação bloqueada: Usuário não autenticado ou cadastro inativo.'
    };
  }

  // 2. Verificação de Rota / Permissão Inviolável
  if (tool.requiredRoute && !checkRouteAccess(user, tool.requiredRoute)) {
    return {
      success: false,
      message: `Acesso negado: Seu usuário não possui autorização para executar ações no módulo "${tool.module}" (Rota necessária: ${tool.requiredRoute}).`
    };
  }

  // 3. Verificação de Confirmação para Ações Sensíveis
  if (tool.requiresConfirmation && !isConfirmed) {
    return {
      success: true,
      requiresConfirmation: true,
      message: `Ação no módulo ${tool.module} requer sua confirmação prévia para ser executada com segurança.`,
      confirmationDetails: {
        actionName: tool.name,
        description: `Executar ${tool.description}`,
        params,
        targetModule: tool.module
      }
    };
  }

  // 4. Execução Controlada
  return await tool.execute(params, user);
}
