import { User, UserRole, AppPermission } from '../types';

export interface ModuleItemDefinition {
  key: string;
  legacyKeys?: string[];
  label: string;
  description: string;
  routes: string[];
  iconName?: string;
  submodules?: ModuleItemDefinition[];
}

/**
 * ÁRVORE CANÔNICA DE CONTROLE DE ACESSO
 * Estrutura oficial com os 14 módulos solicitados, seus submódulos e rotas correspondentes.
 */
export const MODULE_ACCESS_TREE: ModuleItemDefinition[] = [
  {
    key: 'parent_compras',
    legacyKeys: ['compras'],
    label: 'Compras',
    description: 'Gerenciamento de solicitações de compras, cotações e catálogo de itens',
    routes: ['/Compras'],
    iconName: 'ShoppingCart',
    submodules: [
      {
        key: 'sub_compras_novo',
        legacyKeys: ['parent_compras_pedidos'],
        label: 'Novo Pedido',
        description: 'Criação de novos pedidos de compras',
        routes: ['/Editor/Compras']
      },
      {
        key: 'sub_compras_historico',
        legacyKeys: ['parent_compras_pedidos'],
        label: 'Histórico',
        description: 'Histórico e acompanhamento de compras',
        routes: ['/Historico/Compras']
      },
      {
        key: 'sub_compras_visualizar',
        legacyKeys: ['parent_compras_visualizar'],
        label: 'Visualizar Detalhes',
        description: 'Visualização completa e impressão de detalhes da compra',
        routes: ['/Historico/Compras/Visualizar']
      },
      {
        key: 'sub_compras_itens',
        legacyKeys: ['parent_compras_itens'],
        label: 'Itens & Catálogo',
        description: 'Gestão do catálogo de itens e estoque de compras',
        routes: ['/Compras/Itens']
      }
    ]
  },
  {
    key: 'parent_diarias',
    legacyKeys: ['diarias'],
    label: 'Diárias & Custeio',
    description: 'Gestão de viagens a serviço, diárias e adiantamentos',
    routes: ['/Diarias'],
    iconName: 'Briefcase',
    submodules: [
      {
        key: 'sub_diarias_editor',
        legacyKeys: ['parent_diarias_editor'],
        label: 'Nova Solicitação',
        description: 'Criar nova solicitação de diária',
        routes: ['/Editor/Diarias']
      },
      {
        key: 'sub_diarias_historico',
        legacyKeys: ['parent_diarias_historico'],
        label: 'Histórico',
        description: 'Histórico geral de diárias e prestações de contas',
        routes: ['/Historico/Diarias']
      },
      {
        key: 'sub_diarias_novo_evento',
        legacyKeys: ['parent_diarias_novo_evento'],
        label: 'Novo Evento',
        description: 'Cadastro de eventos para viagens em grupo',
        routes: ['/Diarias/NovoEvento']
      },
      {
        key: 'sub_diarias_lancamentos',
        legacyKeys: ['parent_diarias_lancamentos'],
        label: 'Lançamentos',
        description: 'Controle contábil e lançamentos de diárias',
        routes: ['/Diarias/Lancamentos']
      },
      {
        key: 'sub_diarias_gestores',
        legacyKeys: ['parent_diarias_gestores'],
        label: 'Gestores',
        description: 'Gestão e autorização de viagens por gestor',
        routes: ['/Diarias/Gestores']
      },
      {
        key: 'sub_diarias_viajar',
        legacyKeys: ['parent_diarias_viajar'],
        label: 'Viajar',
        description: 'Início e acompanhamento de viagem em tempo real',
        routes: ['/Diarias/Viajar']
      },
      {
        key: 'sub_diarias_adiantamento',
        legacyKeys: ['parent_diarias_adiantamento'],
        label: 'Solicitar Adiantamento',
        description: 'Solicitação e aprovação de adiantamentos de custeio',
        routes: [
          '/Diarias/Adiantamento',
          '/Diarias/Adiantamento/Servidor',
          '/Diarias/Adiantamento/Viagem',
          '/Diarias/Adiantamento/Valores',
          '/Diarias/Adiantamento/Bancario',
          '/Diarias/Adiantamento/Justificativa'
        ]
      }
    ]
  },
  {
    key: 'parent_licitacao',
    legacyKeys: ['licitacao'],
    label: 'Licitação',
    description: 'Gestão completa de processos licitatórios, triagem e kanban',
    routes: ['/Licitacao'],
    iconName: 'Gavel',
    submodules: [
      {
        key: 'sub_licitacao_novo',
        legacyKeys: ['parent_licitacao_novo'],
        label: 'Novo Pedido',
        description: 'Abertura de novo processo de licitação',
        routes: ['/Licitacao/NovoPedido']
      },
      {
        key: 'sub_licitacao_processos',
        legacyKeys: ['parent_licitacao_processos'],
        label: 'Meus Processos',
        description: 'Acompanhamento e triagem de processos',
        routes: ['/Licitacao/MeusProcessos']
      },
      {
        key: 'sub_licitacao_kanban',
        legacyKeys: ['parent_licitacao_kanban'],
        label: 'Kanban',
        description: 'Quadro visual do fluxo de etapas licitatórias',
        routes: ['/Licitacao/Kanban']
      },
      {
        key: 'sub_licitacao_kanban_view',
        legacyKeys: ['parent_licitacao_kanban_view'],
        label: 'Kanban View (TV)',
        description: 'Visualização expandida em tela cheia para painéis públicos',
        routes: ['/Licitacao/Kanban/view']
      }
    ]
  },
  {
    key: 'parent_calendario',
    legacyKeys: ['calendario'],
    label: 'Calendário',
    description: 'Agenda integrada de eventos municipais, prazos e compromissos',
    routes: ['/Calendario'],
    iconName: 'Calendar',
    submodules: [
      {
        key: 'sub_calendario_novo',
        legacyKeys: ['parent_calendario_novo'],
        label: 'Novo Evento',
        description: 'Agendar novo compromisso ou evento oficial',
        routes: [
          '/Calendario/Novo',
          '/Calendario/Novo/Identificacao',
          '/Calendario/Novo/Setor',
          '/Calendario/Novo/Programacao',
          '/Calendario/Novo/Jornal'
        ]
      },
      {
        key: 'sub_calendario_editar',
        legacyKeys: ['parent_calendario_editar'],
        label: 'Editar Evento',
        description: 'Edição e cancelamento de eventos no calendário',
        routes: ['/Calendario/Editar']
      }
    ]
  },
  {
    key: 'parent_rh',
    legacyKeys: ['rh'],
    label: 'Recursos Humanos',
    description: 'Gestão de servidores, horas extras e histórico funcional',
    routes: ['/RH'],
    iconName: 'Users',
    submodules: [
      {
        key: 'sub_rh_horas_extras',
        legacyKeys: ['parent_rh_horas_extras'],
        label: 'Horas Extras',
        description: 'Lançamento e aprovação de banco de horas/horas extras',
        routes: ['/RH/HorasExtras']
      },
      {
        key: 'sub_rh_historico',
        legacyKeys: ['parent_rh_historico'],
        label: 'Histórico',
        description: 'Consulta do histórico funcional de servidores',
        routes: ['/RH/Historico']
      }
    ]
  },
  {
    key: 'parent_consultas',
    legacyKeys: ['consultas'],
    label: 'Regulação & Consultas',
    description: 'Agendamento de consultas médicas especializadas, exames e regulação',
    routes: ['/Consultas'],
    iconName: 'HeartPulse',
    submodules: [
      {
        key: 'sub_consultas_novo_agendamento',
        legacyKeys: ['parent_consultas_novo_agendamento'],
        label: 'Novo Agendamento',
        description: 'Marcar nova consulta médica ou procedimento',
        routes: [
          '/Consultas/NovoAgendamento',
          '/Consultas/NovoAgendamento/Paciente',
          '/Consultas/NovoAgendamento/Procedimento',
          '/Consultas/NovoAgendamento/Revisao',
          '/Consultas/NovoAgendamento/DefinirAgenda'
        ]
      },
      {
        key: 'sub_consultas_liberar_vagas',
        legacyKeys: ['parent_consultas_liberar_vagas'],
        label: 'Liberar Vagas',
        description: 'Disponibilização de novas cotas e vagas para marcação',
        routes: ['/Consultas/LiberarVagas']
      },
      {
        key: 'sub_consultas_acompanhar',
        legacyKeys: ['parent_consultas_acompanhar'],
        label: 'Acompanhar',
        description: 'Fila de espera e acompanhamento de agendamentos',
        routes: ['/Consultas/Acompanhar', '/Consultas/VagasReservadas']
      },
      {
        key: 'sub_consultas_definir_agenda',
        legacyKeys: ['parent_consultas_definir_agenda'],
        label: 'Definir Agenda',
        description: 'Parametrização de agendas e prestadores credenciados',
        routes: ['/Consultas/DefinirAgenda']
      },
      {
        key: 'sub_consultas_pacientes',
        legacyKeys: ['parent_consultas_pacientes'],
        label: 'Pacientes',
        description: 'Cadastro e consulta de prontuário de pacientes',
        routes: ['/Consultas/Pacientes']
      },
      {
        key: 'sub_consultas_dados',
        legacyKeys: ['parent_consultas_dados'],
        label: 'Dados & Métricas',
        description: 'Indicadores, dashboards e inteligência de regulação em saúde',
        routes: [
          '/Consultas/DADOS',
          '/Consultas/DADOS/Dashboard',
          '/Consultas/DADOS/Dashboard/VisaoGeral',
          '/Consultas/DADOS/Dashboard/Prazos',
          '/Consultas/DADOS/Dashboard/Filas',
          '/Consultas/DADOS/Dashboard/IA',
          '/Consultas/DADOS/Dashboard/Eficiencia',
          '/Consultas/DADOS/Pacientes',
          '/Consultas/DADOS/Exames',
          '/Consultas/DADOS/Historico',
          '/Consultas/DADOS/Gestor',
          '/Consultas/DADOS/AgentesSaude'
        ]
      },
      {
        key: 'sub_consultas_gestor',
        legacyKeys: ['parent_consultas_gestor'],
        label: 'Gestor',
        description: 'Gestão de permissões operacionais do módulo de regulação',
        routes: ['/Consultas/Gestor']
      }
    ]
  },
  {
    key: 'parent_farmacia',
    legacyKeys: ['farmacia'],
    label: 'Farmácia Popular',
    description: 'Dispensação municipal de medicamentos, estoque e controle de lotes',
    routes: ['/FarmaciaPopular'],
    iconName: 'Pill',
    submodules: [
      {
        key: 'sub_farmacia_consultar',
        legacyKeys: ['parent_farmacia_consultar'],
        label: 'Consultar',
        description: 'Busca rápida de disponibilidade de medicamentos',
        routes: ['/FarmaciaPopular/Consultar']
      },
      {
        key: 'sub_farmacia_retirar',
        legacyKeys: ['parent_farmacia_retirar'],
        label: 'Retirar / Dispensação',
        description: 'Registro de entrega e baixa de medicamentos a pacientes',
        routes: ['/FarmaciaPopular/Retirar']
      },
      {
        key: 'sub_farmacia_estoque',
        legacyKeys: ['parent_farmacia_estoque'],
        label: 'Estoque',
        description: 'Gestão do estoque central, lotes e validades',
        routes: ['/FarmaciaPopular/Estoque']
      },
      {
        key: 'sub_farmacia_dashboard',
        legacyKeys: ['parent_farmacia_dashboard'],
        label: 'Dashboard',
        description: 'Métricas de consumo, estoque mínimo e relatórios',
        routes: [
          '/FarmaciaPopular/Dashboard',
          '/FarmaciaPopular/Dashboard/VisaoGeral',
          '/FarmaciaPopular/Dashboard/Medicamentos',
          '/FarmaciaPopular/Dashboard/Pacientes',
          '/FarmaciaPopular/Dashboard/Operacoes',
          '/FarmaciaPopular/Dashboard/Relatorios',
          '/FarmaciaPopular/Dashboard/Rename',
          '/FarmaciaPopular/Dashboard/AltoCusto',
          '/FarmaciaPopular/Dashboard/Configuracao',
          '/FarmaciaPopular/Dados',
          '/FarmaciaPopular/Historico'
        ]
      },
      {
        key: 'sub_farmacia_pacientes',
        legacyKeys: ['parent_farmacia_pacientes'],
        label: 'Pacientes',
        description: 'Histórico de retiradas por cidadão / paciente',
        routes: ['/FarmaciaPopular/Pacientes']
      },
      {
        key: 'sub_farmacia_gestor',
        legacyKeys: ['parent_farmacia_gestor'],
        label: 'Gestor',
        description: 'Administração de parâmetros da Farmácia Popular',
        routes: ['/FarmaciaPopular/Gestor']
      }
    ]
  },
  {
    key: 'parent_noticias',
    legacyKeys: ['noticias'],
    label: 'Notícias',
    description: 'Comunicação institucional, boletins informativos e avisos municipais',
    routes: [
      '/Noticias',
      '/Noticias/Tour',
      '/Noticias/BoletimSemanal',
      '/Noticias/BoletimMensal'
    ],
    iconName: 'Newspaper',
    submodules: []
  },
  {
    key: 'parent_agendamento_veiculo',
    legacyKeys: ['agendamento'],
    label: 'Agendamento de Veículos',
    description: 'Solicitação, triagem e controle de saídas da frota municipal',
    routes: ['/AgendamentoVeiculos'],
    iconName: 'Car',
    submodules: [
      {
        key: 'sub_agendamento_agendar',
        legacyKeys: ['parent_agendamento_veiculo_agendar'],
        label: 'Agendar Veículo',
        description: 'Nova solicitação de veículo para deslocamento',
        routes: ['/AgendamentoVeiculos/Agendar']
      },
      {
        key: 'sub_agendamento_dia',
        legacyKeys: ['parent_agendamento_veiculo_dia'],
        label: 'Agendar por Dia',
        description: 'Visualização da escala diária de motoristas e veículos',
        routes: ['/AgendamentoVeiculos/Agendar/Dia']
      },
      {
        key: 'sub_agendamento_historico',
        legacyKeys: ['parent_agendamento_veiculo_meus'],
        label: 'Histórico',
        description: 'Meus agendamentos e viagens concluídas',
        routes: ['/AgendamentoVeiculos/Historico']
      },
      {
        key: 'sub_agendamento_aprovacoes',
        legacyKeys: ['parent_agendamento_veiculo_aprovacoes'],
        label: 'Aprovações',
        description: 'Análise e despacho de pedidos de veículos pelos gestores',
        routes: ['/AgendamentoVeiculos/Aprovacoes']
      },
      {
        key: 'sub_agendamento_dashboard',
        legacyKeys: ['parent_agendamento_veiculo_dashboard'],
        label: 'Dashboard Analítico',
        description: 'Métricas de utilização e custos de quilometragem',
        routes: ['/AgendamentoVeiculos/Dashboard']
      }
    ]
  },
  {
    key: 'parent_abastecimento',
    legacyKeys: ['abastecimento'],
    label: 'Abastecimento',
    description: 'Controle de combustível, requisições de abastecimento e frotas',
    routes: ['/Abastecimento'],
    iconName: 'Fuel',
    submodules: [
      {
        key: 'sub_abastecimento_novo',
        legacyKeys: ['parent_abastecimento_novo'],
        label: 'Novo Abastecimento',
        description: 'Lançar requisição de abastecimento de veículo/máquina',
        routes: ['/Abastecimento/NovoAbastecimento']
      },
      {
        key: 'sub_abastecimento_gestao',
        legacyKeys: ['parent_abastecimento_gestao'],
        label: 'Gestão / Histórico',
        description: 'Auditoria de tickets e autorizações de combustível',
        routes: ['/Abastecimento/GestaoAbastecimento']
      },
      {
        key: 'sub_abastecimento_dashboard',
        legacyKeys: ['parent_abastecimento_dashboard'],
        label: 'Dashboard',
        description: 'Métricas de litros consumidos, gastos por posto e veículo',
        routes: [
          '/Abastecimento/DashboardAbastecimento',
          '/Abastecimento/DashboardAbastecimento/Motoristas'
        ]
      }
    ]
  },
  {
    key: 'parent_frotas',
    legacyKeys: ['frotas'],
    label: 'Frotas',
    description: 'Gestão cadastral de veículos municipais, manutenções e seguros',
    routes: ['/Frota'],
    iconName: 'Truck',
    submodules: [
      {
        key: 'sub_frotas_dashboard',
        legacyKeys: ['parent_frotas_dashboard'],
        label: 'Dashboard de Frota',
        description: 'Visão consolidada de manutenção e disponibilidade',
        routes: ['/Frota/Dashboard']
      },
      {
        key: 'sub_frotas_leve',
        legacyKeys: ['parent_frotas_leve'],
        label: 'Frota Leve',
        description: 'Automóveis de passeio, utilitários e vans',
        routes: ['/Frota/Leve']
      },
      {
        key: 'sub_frotas_pesado',
        legacyKeys: ['parent_frotas_pesado'],
        label: 'Frota Pesada & Máquinas',
        description: 'Caminhões, tratores, motoniveladoras e retroescavadeiras',
        routes: ['/Frota/Pesada']
      },
      {
        key: 'sub_frotas_acessorio',
        legacyKeys: ['parent_frotas_acessorio'],
        label: 'Acessórios & Equipamentos',
        description: 'Implementos agrícolas, carretas e ferramentas',
        routes: ['/Frota/Acessorios']
      }
    ]
  },
  {
    key: 'parent_criar_oficio',
    legacyKeys: ['oficio', 'parent_oficios'],
    label: 'Ofícios',
    description: 'Emissão, tramitação e protocolo eletrônico de ofícios municipais',
    routes: ['/Oficios'],
    iconName: 'FileText',
    submodules: [
      {
        key: 'sub_oficios_editor',
        legacyKeys: ['parent_oficios_editor'],
        label: 'Novo Ofício',
        description: 'Redação de novo ofício com assinatura digital',
        routes: ['/Editor/Oficio']
      },
      {
        key: 'sub_oficios_historico',
        legacyKeys: ['parent_oficios_historico'],
        label: 'Histórico',
        description: 'Consulta de ofícios emitidos, despachados e arquivados',
        routes: ['/Historico/Oficio']
      }
    ]
  },
  {
    key: 'parent_tarefas',
    legacyKeys: ['tarefas'],
    label: 'Tarefas',
    description: 'Quadro de gestão de tarefas internas, prazos e delegações',
    routes: ['/Tarefas'],
    iconName: 'CheckSquare',
    submodules: [
      {
        key: 'sub_tarefas_nova',
        legacyKeys: ['parent_tarefas_nova'],
        label: 'Nova Tarefa',
        description: 'Criar e delegar tarefa para servidores ou setores',
        routes: ['/Tarefas/NovaTarefa']
      },
      {
        key: 'sub_tarefas_minhas',
        legacyKeys: ['parent_tarefas_minhas'],
        label: 'Minhas Tarefas',
        description: 'Quadro de tarefas atribuídas e em andamento',
        routes: ['/Tarefas/MinhasTarefas']
      }
    ]
  },
  {
    key: 'parent_admin',
    legacyKeys: ['admin'],
    label: 'Administração do Sistema',
    description: 'Gestão institucional, configurações gerais, segurança e auditoria',
    routes: ['/Admin', '/Admin/Dashboard'],
    iconName: 'ShieldAlert',
    submodules: [
      {
        key: 'sub_admin_dashboard',
        legacyKeys: ['parent_admin_dashboard'],
        label: 'Dashboard',
        description: 'Painel executivo de status dos módulos municipais',
        routes: ['/Admin/Dashboard']
      },
      {
        key: 'sub_admin_usuarios',
        legacyKeys: ['parent_admin_usuarios'],
        label: 'Usuários & Permissões',
        description: 'Cadastro de servidores, perfis e credenciais',
        routes: ['/Admin/Usuarios']
      },
      {
        key: 'sub_admin_entidades',
        legacyKeys: ['parent_admin_entidades'],
        label: 'Entidades',
        description: 'Gestão de secretarias, departamentos e órgãos vinculados',
        routes: ['/Admin/Entidades']
      },
      {
        key: 'sub_admin_assinaturas',
        legacyKeys: ['parent_admin_assinaturas'],
        label: 'Assinaturas Eletrônicas',
        description: 'Gerenciamento de certificados e assinaturas digitais',
        routes: ['/Admin/Assinaturas']
      },
      {
        key: 'sub_admin_autenticador',
        legacyKeys: ['parent_admin_autenticador'],
        label: 'Autenticação 2FA',
        description: 'Configuração de segundo fator de autenticação para segurança',
        routes: ['/Admin/autenticador']
      },
      {
        key: 'sub_admin_interface',
        legacyKeys: ['parent_admin_interface'],
        label: 'Interface & Logos',
        description: 'Personalização visual, brasão e identidade do município',
        routes: ['/Admin/Interface']
      },
      {
        key: 'sub_admin_design',
        legacyKeys: ['parent_admin_design'],
        label: 'Design & Temas',
        description: 'Configuração de temas e estilos do sistema',
        routes: ['/Admin/Design']
      },
      {
        key: 'sub_admin_controle_acesso',
        legacyKeys: ['parent_admin_controle_acesso'],
        label: 'Controle de Acesso',
        description: 'Gestão global de disponibilidade de módulos e submódulos',
        routes: ['/Admin/ControleAcesso']
      },
      {
        key: 'sub_admin_logs',
        legacyKeys: ['parent_admin_logs'],
        label: 'Logs de Auditoria',
        description: 'Histórico de ações, acessos e auditoria de segurança',
        routes: ['/Admin/logs']
      },
      {
        key: 'sub_admin_acesso_remoto',
        legacyKeys: ['parent_admin_acesso_remoto'],
        label: 'Acesso Remoto',
        description: 'Suporte técnico e acompanhamento de sessões remotas',
        routes: ['/Admin/AcessoRemoto']
      }
    ]
  },
  {
    key: 'parent_upload',
    legacyKeys: ['upload'],
    label: 'Upload Rápido',
    description: 'Hub para envio rápido de documentos e anexos via QR Code ou arquivo',
    routes: ['/Upload'],
    iconName: 'Upload',
    submodules: []
  },
  {
    key: 'parent_assistente_ia',
    legacyKeys: ['assistente_ia', 'chat'],
    label: 'Assistente IA Operacional',
    description: 'Assistente inteligente nativo integrado para consultas, execuções e fluxos operacionais',
    routes: ['/AssistenteIA', '/Chat'],
    iconName: 'Bot',
    submodules: []
  }
];

/**
 * Mapeamento reverso automático: rota normalizada -> { parentKey, subKey }
 */
export interface RoutePermissionBinding {
  parentKey: string;
  subKey?: string;
  moduleLabel: string;
  itemLabel: string;
}

const ROUTE_BINDINGS_MAP: Map<string, RoutePermissionBinding> = new Map();

// Constrói o mapa indexado de rotas
(function buildRouteBindingsMap() {
  MODULE_ACCESS_TREE.forEach(parent => {
    parent.routes.forEach(r => {
      ROUTE_BINDINGS_MAP.set(r.toLowerCase(), {
        parentKey: parent.key,
        moduleLabel: parent.label,
        itemLabel: parent.label
      });
    });

    if (parent.submodules) {
      parent.submodules.forEach(sub => {
        sub.routes.forEach(r => {
          ROUTE_BINDINGS_MAP.set(r.toLowerCase(), {
            parentKey: parent.key,
            subKey: sub.key,
            moduleLabel: parent.label,
            itemLabel: sub.label
          });
        });
      });
    }
  });
})();

/**
 * Identifica a vinculação de permissão para uma rota qualquer
 */
export function getRouteBinding(path: string): RoutePermissionBinding | null {
  if (!path) return null;
  const normalized = path.split('?')[0].replace(/\/$/, '').toLowerCase();

  // 1. Busca exata
  if (ROUTE_BINDINGS_MAP.has(normalized)) {
    return ROUTE_BINDINGS_MAP.get(normalized)!;
  }

  // 2. Busca por prefixo para subrotas dinâmicas
  for (const [routePattern, binding] of ROUTE_BINDINGS_MAP.entries()) {
    if (normalized.startsWith(routePattern + '/')) {
      return binding;
    }
  }

  return null;
}

/**
 * Valida se um usuário possui uma permissão específica no array individual.
 * Dá suporte retroativo a chaves antigas e novas.
 */
export function userHasPermissionKey(userPermissions: string[] | undefined, key: string, legacyKeys?: string[]): boolean {
  if (!userPermissions || !Array.isArray(userPermissions)) return false;
  if (userPermissions.includes(key)) return true;

  if (legacyKeys && legacyKeys.length > 0) {
    return legacyKeys.some(lk => userPermissions.includes(lk));
  }

  return false;
}

/**
 * Valida se um módulo pai está ativo no escopo global
 */
export function isModuleActiveGlobally(parentKey: string, globalSettings?: Record<string, boolean>): boolean {
  if (!globalSettings) return true;
  // Checagem direta
  if (globalSettings[parentKey] === false) return false;

  // Checagem de chaves legadas correspondentes
  const parentDef = MODULE_ACCESS_TREE.find(m => m.key === parentKey);
  if (parentDef?.legacyKeys) {
    for (const lk of parentDef.legacyKeys) {
      if (globalSettings[lk] === false) return false;
    }
  }
  return true;
}

/**
 * Valida se um submódulo está ativo no escopo global
 */
export function isSubmoduleActiveGlobally(
  parentKey: string, 
  subKey: string, 
  globalSettings?: Record<string, boolean>
): boolean {
  if (!globalSettings) return true;
  // Regra de dependência estrita: se o pai estiver inativo, o submódulo está automaticamente inativo
  if (!isModuleActiveGlobally(parentKey, globalSettings)) return false;
  if (globalSettings[subKey] === false) return false;

  const parentDef = MODULE_ACCESS_TREE.find(m => m.key === parentKey);
  const subDef = parentDef?.submodules?.find(s => s.key === subKey);
  if (subDef?.legacyKeys) {
    for (const lk of subDef.legacyKeys) {
      if (globalSettings[lk] === false) return false;
    }
  }
  return true;
}

/**
 * Utilitário centralizado para atualizar o array de permissões do usuário
 * eliminando resíduos legados ao desativar e aplicando herança estrita (Pai x Filho).
 */
export function cleanPermissionsArray(
  currentPerms: string[] | undefined,
  targetKey: string,
  enabled: boolean
): string[] {
  const perms = new Set<string>(currentPerms || []);

  // 1. Verifica se targetKey é um módulo Pai
  const parentDef = MODULE_ACCESS_TREE.find(m => m.key === targetKey || m.legacyKeys?.includes(targetKey));
  if (parentDef && (parentDef.key === targetKey || parentDef.legacyKeys?.includes(targetKey))) {
    if (enabled) {
      // Ativa o pai e garante que submódulos sejam ativados
      perms.add(parentDef.key);
      if (parentDef.submodules) {
        parentDef.submodules.forEach(sub => perms.add(sub.key));
      }
    } else {
      // DESATIVAÇÃO DO PAI:
      // Remove o pai, todas as suas chaves legadas e TODOS os seus submódulos filhos
      perms.delete(parentDef.key);
      parentDef.legacyKeys?.forEach(lk => perms.delete(lk));
      if (parentDef.submodules) {
        parentDef.submodules.forEach(sub => {
          perms.delete(sub.key);
          sub.legacyKeys?.forEach(lk => perms.delete(lk));
        });
      }
    }
    return Array.from(perms);
  }

  // 2. Verifica se targetKey é um Submódulo
  for (const p of MODULE_ACCESS_TREE) {
    const subDef = p.submodules?.find(s => s.key === targetKey || s.legacyKeys?.includes(targetKey));
    if (subDef) {
      if (enabled) {
        // Ativa o submódulo e garante o pai ativo
        perms.add(subDef.key);
        perms.add(p.key);
      } else {
        // DESATIVAÇÃO DO SUBMÓDULO:
        // Remove a chave canônica e TODAS as suas chaves legadas
        perms.delete(subDef.key);
        subDef.legacyKeys?.forEach(lk => perms.delete(lk));
      }
      return Array.from(perms);
    }
  }

  // Fallback para chaves ad-hoc
  if (enabled) perms.add(targetKey);
  else perms.delete(targetKey);
  return Array.from(perms);
}

/**
 * Determina se o usuário é o Administrador Geral do Sistema ("GAF" ou role admin não simulada).
 * Diretriz do sistema:
 * O usuário "GAF" deve ter acesso a todo o sistema, não deve ser impedido de acessar nenhuma rota URL,
 * é o administrador do sistema e possui acesso completo e irrestrito.
 */
export function isSuperAdminUser(user: User | null): boolean {
  if (!user) return false;

  const username = (user.username || '').toLowerCase().trim();
  const email = (user.email || '').toLowerCase().trim();
  const id = (user.id || '').toLowerCase().trim();
  const name = (user.name || '').toLowerCase().trim();

  // 1. Identificação direta do usuário "GAF" (Guilherme Araújo Ferreira dos Santos)
  if (
    username === 'gaf' ||
    email === 'gaf' ||
    email.startsWith('gaf@') ||
    id === 'user_guilherme' ||
    name.includes('guilherme araújo ferreira')
  ) {
    return true;
  }

  // 2. Administrador com papel ativo de admin (caso não esteja testando conscientemente um perfil inferior via testRole)
  const isRealAdmin = user.role === 'admin' || (user as any).realRole === 'admin';
  const activeTestRole = user.testRole;
  if (isRealAdmin && (!activeTestRole || activeTestRole === 'admin')) {
    return true;
  }

  return false;
}

/**
 * Retorna todas as chaves de permissões canônicas e legadas cadastradas na árvore.
 */
export function getAllPermissionKeys(): string[] {
  const keys = new Set<string>();
  for (const mod of MODULE_ACCESS_TREE) {
    keys.add(mod.key);
    mod.legacyKeys?.forEach(lk => keys.add(lk));
    if (mod.submodules) {
      for (const sub of mod.submodules) {
        keys.add(sub.key);
        sub.legacyKeys?.forEach(lk => keys.add(lk));
      }
    }
  }
  return Array.from(keys);
}

/**
 * Valida se o usuário tem permissão para o módulo pai
 */
export function userCanAccessModuleParent(
  user: User | null, 
  parentDef: ModuleItemDefinition, 
  globalSettings?: Record<string, boolean>
): boolean {
  if (!user) return false;

  // SUPER ADMIN / GAF: Acesso completo e irrestrito a qualquer módulo
  if (isSuperAdminUser(user)) {
    return true;
  }

  // 1. Dependência global: se desativado no global, usuários regulares não acessam (regra: Global prevalece)
  if (!isModuleActiveGlobally(parentDef.key, globalSettings)) {
    return false;
  }

  // 2. Permissão do usuário
  const userRole = (user.testRole !== undefined && user.testRole !== null) ? user.testRole : user.role;
  
  // Salvaguarda: Administrador tem acesso ao módulo Admin para não ser bloqueado acidentalmente
  if (parentDef.key === 'parent_admin' && userRole === 'admin') {
    return true;
  }

  // Verifica permissão explícita do módulo
  return userHasPermissionKey(user.permissions, parentDef.key, parentDef.legacyKeys);
}

/**
 * Valida se o usuário tem permissão para um submódulo específico
 */
export function userCanAccessSubmodule(
  user: User | null,
  parentKey: string,
  subKey: string,
  globalSettings?: Record<string, boolean>
): boolean {
  if (!user) return false;

  // SUPER ADMIN / GAF: Acesso completo e irrestrito a qualquer submódulo
  if (isSuperAdminUser(user)) {
    return true;
  }

  const parentDef = MODULE_ACCESS_TREE.find(m => m.key === parentKey);
  if (!parentDef) return true;

  // 1. Dependência global do pai: Se o pai estiver inativo no global, submódulo inativo
  if (!isModuleActiveGlobally(parentKey, globalSettings)) {
    return false;
  }

  // 2. Submódulo no global
  if (!isSubmoduleActiveGlobally(parentKey, subKey, globalSettings)) {
    return false;
  }

  // 3. Dependência do pai no usuário: Se o usuário não tem o pai, NÃO acessa o filho de jeito nenhum!
  if (!userCanAccessModuleParent(user, parentDef, globalSettings)) {
    return false;
  }

  const subDef = parentDef.submodules?.find(s => s.key === subKey);
  if (!subDef) return true;

  const userRole = (user.testRole !== undefined && user.testRole !== null) ? user.testRole : user.role;

  // Salvaguarda administrativa para o módulo de administração
  if (parentKey === 'parent_admin' && userRole === 'admin') {
    return true;
  }

  // 4. Checa a permissão individual do submódulo
  return userHasPermissionKey(user.permissions, subDef.key, subDef.legacyKeys);
}

/**
 * ROUTE GUARD CENTRALIZADO
 * Valida se o usuário logado pode acessar a rota informada.
 * Retorna { allowed: boolean, reason?: string, redirectPath?: string }
 */
export function canUserAccessRoute(
  path: string,
  user: User | null,
  globalSettings?: Record<string, boolean>
): { allowed: boolean; reason?: string; redirectPath?: string } {
  if (!path) return { allowed: true };

  const normalized = path.split('?')[0].replace(/\/$/, '').toLowerCase();

  // 1. Rotas públicas ou de autenticação
  const publicRoutes = ['/login', '/politica-privacidade', '/politica-privacidade-app', '/licitacao/kanban/view'];
  if (publicRoutes.some(pr => normalized === pr || normalized.startsWith(pr + '/'))) {
    return { allowed: true };
  }

  // 2. Sem usuário autenticado -> Redireciona para login
  if (!user) {
    return { allowed: false, reason: 'Usuário não autenticado', redirectPath: '/Login' };
  }

  // Rota Home (/PaginaInicial ou /) sempre permitida para usuário logado
  if (normalized === '' || normalized === '/paginainicial' || normalized === '/home') {
    return { allowed: true };
  }

  // SUPER ADMIN / USUÁRIO "GAF": Acesso completo e irrestrito a todas as rotas e módulos do sistema
  if (isSuperAdminUser(user)) {
    return { allowed: true };
  }

  // 3. Localiza a vinculação na árvore canônica
  const binding = getRouteBinding(normalized);
  if (!binding) {
    // Se a rota não faz parte do mapa canônico de controle (ex: sub-rotas de perfil), permite
    return { allowed: true };
  }

  const parentDef = MODULE_ACCESS_TREE.find(m => m.key === binding.parentKey);
  if (!parentDef) {
    return { allowed: true };
  }

  const userRole = (user.testRole !== undefined && user.testRole !== null) ? user.testRole : user.role;

  // Salvaguarda administrativa: Administrador nunca é bloqueado no módulo de Administração
  if (binding.parentKey === 'parent_admin' && userRole === 'admin') {
    return { allowed: true };
  }

  // 4. Validação do Módulo Pai no Global
  if (!isModuleActiveGlobally(binding.parentKey, globalSettings)) {
    return {
      allowed: false,
      reason: `O módulo "${binding.moduleLabel}" está temporariamente desativado no sistema.`,
      redirectPath: '/PaginaInicial'
    };
  }

  // 5. Validação do Módulo Pai no Usuário
  if (!userCanAccessModuleParent(user, parentDef, globalSettings)) {
    return {
      allowed: false,
      reason: `Seu usuário não possui permissão de acesso ao módulo "${binding.moduleLabel}".`,
      redirectPath: '/PaginaInicial'
    };
  }

  // 6. Se a rota possui submódulo específico, valida o submódulo
  if (binding.subKey) {
    const subDef = parentDef.submodules?.find(s => s.key === binding.subKey);
    const itemTitle = subDef?.label || binding.itemLabel;

    // Submódulo no Global
    if (!isSubmoduleActiveGlobally(binding.parentKey, binding.subKey, globalSettings)) {
      return {
        allowed: false,
        reason: `A funcionalidade "${itemTitle}" do módulo "${binding.moduleLabel}" está temporariamente desativada no sistema.`,
        redirectPath: '/PaginaInicial'
      };
    }

    // Submódulo no Usuário
    if (!userCanAccessSubmodule(user, binding.parentKey, binding.subKey, globalSettings)) {
      return {
        allowed: false,
        reason: `Seu usuário não possui permissão para acessar "${itemTitle}" em "${binding.moduleLabel}".`,
        redirectPath: '/PaginaInicial'
      };
    }
  }

  return { allowed: true };
}
