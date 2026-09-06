/**
 * Base de Conhecimento Estruturada de Telas, Rotas, Campos e Regras do Sistema
 * Fornece inteligência contextual em tempo real para a IA Operacional
 */

export interface ScreenField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'time' | 'number' | 'textarea';
  required: boolean;
  options?: string[];
  description?: string;
  placeholder?: string;
}

export interface ScreenMetadata {
  route: string;
  canonicalRoute: string;
  module: string;
  submodule?: string;
  title: string;
  description: string;
  permissionKey?: string;
  fields: ScreenField[];
  availableActions: string[];
  howToGuide: string;
}

export const SYSTEM_SCREENS: Record<string, ScreenMetadata> = {
  // --- CONSULTAS ---
  '/Consultas/NovoAgendamento': {
    route: '/Consultas/NovoAgendamento',
    canonicalRoute: '/Consultas/NovoAgendamento',
    module: 'Consultas',
    submodule: 'Novo Agendamento',
    title: 'Novo Agendamento de Consulta',
    description: 'Tela de agendamento de consultas e procedimentos de saúde para cidadãos municipais.',
    permissionKey: 'sub_consultas_novo',
    fields: [
      { name: 'paciente', label: 'Nome do Paciente', type: 'text', required: true, placeholder: 'Ex: Maria Silva' },
      { 
        name: 'procedimento', 
        label: 'Especialidade / Procedimento', 
        type: 'select', 
        required: true, 
        options: ['Cardiologia', 'Ortopedia', 'Clínico Geral', 'Pediatria', 'Ginecologia', 'Oftalmologia', 'Odontologia', 'Outro'] 
      },
      { name: 'data', label: 'Data da Consulta', type: 'date', required: true },
      { 
        name: 'horario', 
        label: 'Horário Previsto', 
        type: 'time', 
        required: true, 
        options: ['08:00', '09:00', '10:00', '13:00', '14:00', '15:00', '16:00'] 
      },
      { name: 'observacoes', label: 'Observações / Recomendações', type: 'textarea', required: false }
    ],
    availableActions: ['Agendar Consulta', 'Consultar Disponibilidade Médica', 'Limpar Formulário'],
    howToGuide: 'Informe o nome do paciente, a especialidade desejada, a data e o horário. Após preencher, clique em Salvar para registrar no prontuário do SUS municipal.'
  },
  '/Consultas': {
    route: '/Consultas',
    canonicalRoute: '/Consultas',
    module: 'Consultas',
    title: 'Gestão de Consultas e Exames',
    description: 'Painel geral com listagem de consultas agendadas, filtros por médico, paciente e status.',
    permissionKey: 'parent_consultas',
    fields: [
      { name: 'busca', label: 'Buscar por Paciente ou SUS', type: 'text', required: false },
      { name: 'especialidade', label: 'Filtrar por Especialidade', type: 'select', required: false }
    ],
    availableActions: ['Filtrar Agendamentos', 'Visualizar Prontuário', 'Novo Agendamento'],
    howToGuide: 'Use os filtros no topo para localizar um paciente ou clique em "Novo Agendamento" para marcar uma nova consulta.'
  },

  // --- DIÁRIAS ---
  '/Diarias/Viajar': {
    route: '/Diarias/Viajar',
    canonicalRoute: '/Diarias/Viajar',
    module: 'Diárias',
    submodule: 'Nova Solicitação de Diária',
    title: 'Solicitação de Diárias para Viagem',
    description: 'Formulário para servidores solicitarem pagamento ou adiantamento de diárias de viagem oficial a serviço do município.',
    permissionKey: 'sub_diarias_viajar',
    fields: [
      { name: 'beneficiario', label: 'Servidor Beneficiário', type: 'text', required: true, placeholder: 'Nome completo do servidor' },
      { name: 'destino', label: 'Cidade / Local de Destino', type: 'text', required: true, placeholder: 'Ex: Belo Horizonte - MG' },
      { name: 'motivo', label: 'Motivo / Finalidade da Viagem', type: 'text', required: true, placeholder: 'Ex: Reunião na Secretaria de Estado de Saúde' },
      { name: 'dataPartida', label: 'Data de Partida', type: 'date', required: true },
      { name: 'dataRetorno', label: 'Data Prevista de Retorno', type: 'date', required: true },
      { name: 'valor', label: 'Valor Solicitado (R$)', type: 'number', required: true, placeholder: 'Ex: 250.00' }
    ],
    availableActions: ['Enviar Solicitação', 'Calcular Diária por Tabela', 'Anexar Comprovante'],
    howToGuide: 'Preencha o servidor solicitante, o destino, o motivo institucional da viagem, as datas de ida e volta e o valor previsto. A solicitação seguirá para análise de controle interno e autorização do ordenador.'
  },
  '/Diarias': {
    route: '/Diarias',
    canonicalRoute: '/Diarias',
    module: 'Diárias',
    title: 'Histórico e Gestão de Diárias',
    description: 'Acompanhamento do status de autorizações, empenhos e liquidações de diárias do município.',
    permissionKey: 'parent_diarias',
    fields: [],
    availableActions: ['Consultar Diárias', 'Nova Solicitação', 'Exportar Relatório'],
    howToGuide: 'Visualize todas as diárias já emitidas e o status de aprovação de cada servidor.'
  },

  // --- VEÍCULOS ---
  '/AgendamentoVeiculos/Novo': {
    route: '/AgendamentoVeiculos/Novo',
    canonicalRoute: '/AgendamentoVeiculos/Novo',
    module: 'Agendamento de Veículos',
    submodule: 'Novo Agendamento',
    title: 'Novo Agendamento de Veículo Oficial',
    description: 'Reserva de veículos da frota municipal para viagens, transporte de pacientes ou atividades de secretarias.',
    permissionKey: 'sub_veiculos_novo',
    fields: [
      { 
        name: 'veiculo', 
        label: 'Veículo / Placa', 
        type: 'select', 
        required: true, 
        options: ['Chevrolet Spin (Placa ABC-1234)', 'VW Gol (Placa XYZ-9876)', 'Ambulância UTI Móvel', 'Fiat Ducato Escolar', 'Van Saúde'] 
      },
      { name: 'motorista', label: 'Motorista Responsável', type: 'text', required: true, placeholder: 'Nome do condutor' },
      { name: 'destino', label: 'Destino', type: 'text', required: true, placeholder: 'Ex: Ipatinga - MG' },
      { name: 'dataSaida', label: 'Data e Hora de Saída', type: 'text', required: true, placeholder: 'Ex: Amanhã às 07:00' },
      { name: 'dataRetorno', label: 'Previsão de Retorno', type: 'text', required: true }
    ],
    availableActions: ['Verificar Disponibilidade de Frota', 'Reservar Veículo', 'Consultar Calendário de Saídas'],
    howToGuide: 'Selecione o veículo da frota municipal, motorista habilitado, destino e horários de partida e retorno.'
  },
  '/AgendamentoVeiculos': {
    route: '/AgendamentoVeiculos',
    canonicalRoute: '/AgendamentoVeiculos',
    module: 'Agendamento de Veículos',
    title: 'Painel da Frota e Agendamentos',
    description: 'Gestão visual de saídas de veículos, disponibilidade de motoristas e aprovações.',
    permissionKey: 'parent_agendamento_veiculos',
    fields: [],
    availableActions: ['Consultar Veículos Disponíveis', 'Novo Agendamento', 'Ver Calendário'],
    howToGuide: 'Consulte os veículos disponíveis e viagens programadas para os próximos dias.'
  },

  // --- TAREFAS ---
  '/Tarefas/NovaTarefa': {
    route: '/Tarefas/NovaTarefa',
    canonicalRoute: '/Tarefas/NovaTarefa',
    module: 'Tarefas',
    submodule: 'Nova Tarefa',
    title: 'Criação de Nova Tarefa Operacional',
    description: 'Cadastro de demandas, prazos e atribuição de responsabilidades a setores e servidores.',
    permissionKey: 'sub_tarefas_novo',
    fields: [
      { name: 'titulo', label: 'Título da Tarefa', type: 'text', required: true, placeholder: 'Ex: Revisar relatório quadrimestral' },
      { 
        name: 'prioridade', 
        label: 'Nível de Prioridade', 
        type: 'select', 
        required: true, 
        options: ['Alta', 'Média', 'Baixa', 'Urgente'] 
      },
      { name: 'responsavel', label: 'Responsável Atribuído', type: 'text', required: false, placeholder: 'Nome ou setor responsável' },
      { name: 'prazo', label: 'Prazo Limite / Vencimento', type: 'date', required: false, placeholder: 'Ex: 15/10/2026' },
      { name: 'descricao', label: 'Detalhamento da Tarefa', type: 'textarea', required: false }
    ],
    availableActions: ['Salvar Tarefa', 'Atribuir a Servidor', 'Definir Lembrete'],
    howToGuide: 'Defina o título da atividade, selecione a prioridade e o prazo de conclusão. A tarefa será vinculada ao painel de acompanhamento do setor.'
  },
  '/Tarefas': {
    route: '/Tarefas',
    canonicalRoute: '/Tarefas',
    module: 'Tarefas',
    title: 'Gestão de Tarefas e Demandas',
    description: 'Quadro de tarefas pendentes, em andamento e concluídas dos setores da prefeitura.',
    permissionKey: 'parent_tarefas',
    fields: [],
    availableActions: ['Filtrar por Status', 'Criar Nova Tarefa', 'Concluir Tarefa'],
    howToGuide: 'Acompanhe as tarefas sob sua responsabilidade ou do seu departamento.'
  },

  // --- OFÍCIOS ---
  '/Editor/Oficio': {
    route: '/Editor/Oficio',
    canonicalRoute: '/Editor/Oficio',
    module: 'Ofícios',
    submodule: 'Novo Ofício',
    title: 'Redação de Novo Ofício Oficial',
    description: 'Editor com numeração sequencial automática e modelos padrão para correspondências oficiais.',
    permissionKey: 'sub_oficio_novo',
    fields: [
      { name: 'destinatario', label: 'Órgão / Destinatário', type: 'text', required: true, placeholder: 'Ex: Câmara Municipal de Vereadores' },
      { name: 'assunto', label: 'Assunto do Ofício', type: 'text', required: true, placeholder: 'Ex: Encaminhamento do balancete mensal' },
      { name: 'corpo', label: 'Texto do Ofício', type: 'textarea', required: true, placeholder: 'Redija o texto institucional...' }
    ],
    availableActions: ['Gerar Numeração Oficial', 'Visualizar PDF', 'Assinar Digitalmente', 'Salvar Rascunho'],
    howToGuide: 'Preencha o destinatário e o assunto. O sistema gera automaticamente o número e ano sequencial com o brasão da prefeitura.'
  },

  // --- COMPRAS & LICITAÇÃO ---
  '/Editor/Compras': {
    route: '/Editor/Compras',
    canonicalRoute: '/Editor/Compras',
    module: 'Compras',
    submodule: 'Novo Pedido de Compras',
    title: 'Novo Pedido de Compras / Requisição',
    description: 'Abertura de pedido de compras de materiais, insumos ou contratação de serviços.',
    permissionKey: 'sub_compras_novo',
    fields: [
      { name: 'secretaria', label: 'Secretaria Solicitante', type: 'text', required: true },
      { name: 'justificativa', label: 'Justificativa da Necessidade', type: 'textarea', required: true },
      { name: 'itens', label: 'Lista de Itens / Especificações', type: 'text', required: true }
    ],
    availableActions: ['Adicionar Itens', 'Calcular Estimativa de Valor', 'Enviar para Cotação'],
    howToGuide: 'Especifique os itens demandados e a justificativa pública da compra antes do envio para o setor de licitação.'
  },

  // --- ABASTECIMENTO ---
  '/Abastecimento/NovoAbastecimento': {
    route: '/Abastecimento/NovoAbastecimento',
    canonicalRoute: '/Abastecimento/NovoAbastecimento',
    module: 'Abastecimento',
    submodule: 'Novo Registro de Abastecimento',
    title: 'Registro de Abastecimento de Combustível',
    description: 'Lançamento de requisição de combustível para veículos e máquinas da frota pública.',
    permissionKey: 'sub_abast_novo',
    fields: [
      { name: 'veiculo', label: 'Veículo / Máquina', type: 'text', required: true },
      { name: 'combustivel', label: 'Tipo de Combustível', type: 'select', required: true, options: ['Gasolina Comum', 'Etanol', 'Diesel S-10', 'Diesel S-500'] },
      { name: 'litros', label: 'Quantidade de Litros', type: 'number', required: true },
      { name: 'kmAtual', label: 'Quilometragem / Horímetro Atual', type: 'number', required: true }
    ],
    availableActions: ['Emitir Autorização de Abastecimento', 'Validar Quilometragem'],
    howToGuide: 'Informe o veículo, quilometragem atual do odômetro, tipo e quantidade de combustível autorizada.'
  },

  // --- ADMINISTRAÇÃO ---
  '/Admin/Usuarios': {
    route: '/Admin/Usuarios',
    canonicalRoute: '/Admin/Usuarios',
    module: 'Administração',
    submodule: 'Gestão de Usuários',
    title: 'Gestão e Cadastro de Servidores no Sistema',
    description: 'Painel administrativo de contas, senhas, cargos e controle de acesso.',
    permissionKey: 'sub_admin_usuarios',
    fields: [
      { name: 'nome', label: 'Nome Completo', type: 'text', required: true },
      { name: 'username', label: 'Nome de Usuário (Login)', type: 'text', required: true },
      { name: 'cargo', label: 'Cargo / Função', type: 'text', required: true },
      { name: 'setor', label: 'Secretaria / Setor', type: 'text', required: true }
    ],
    availableActions: ['Cadastrar Novo Servidor', 'Alterar Permissões', 'Resetar Senha', 'Configurar 2FA'],
    howToGuide: 'Gerencie os usuários do sistema, ative ou desative acessos e controle permissões por módulo.'
  }
};

/**
 * Localiza os metadados contextuais da tela correspondente à rota atual
 */
export function getScreenMetadata(currentPath: string): ScreenMetadata | null {
  if (!currentPath) return null;
  const normalized = currentPath.split('?')[0].split('#')[0].trim();

  // Match exato
  if (SYSTEM_SCREENS[normalized]) {
    return SYSTEM_SCREENS[normalized];
  }

  // Match por prefixo (rotas aninhadas)
  const matchingKey = Object.keys(SYSTEM_SCREENS).find(route => 
    normalized.toLowerCase() === route.toLowerCase() ||
    (route !== '/' && normalized.toLowerCase().startsWith(route.toLowerCase()))
  );

  if (matchingKey) {
    return SYSTEM_SCREENS[matchingKey];
  }

  // Fallback genérico deduzido pela URL
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return {
      route: '/',
      canonicalRoute: '/',
      module: 'Início',
      title: 'Painel Principal da Prefeitura',
      description: 'Página inicial do sistema integrado municipal com atalhos para todos os módulos.',
      fields: [],
      availableActions: ['Navegar para Módulos', 'Consultar Avisos', 'Acessar Assistente IA'],
      howToGuide: 'Você está no painel inicial. Escolha qualquer módulo no menu ou peça para a IA executar uma tarefa.'
    };
  }

  const guessedModule = decodeURIComponent(segments[0]);
  const guessedSub = segments[1] ? decodeURIComponent(segments[1]) : undefined;

  return {
    route: normalized,
    canonicalRoute: normalized,
    module: guessedModule.charAt(0).toUpperCase() + guessedModule.slice(1),
    submodule: guessedSub ? guessedSub.charAt(0).toUpperCase() + guessedSub.slice(1) : undefined,
    title: `${guessedModule} ${guessedSub ? `- ${guessedSub}` : ''}`,
    description: `Tela operacional do módulo ${guessedModule}.`,
    fields: [],
    availableActions: ['Consultar Registros', 'Executar Ações do Módulo'],
    howToGuide: `Você está na área de ${guessedModule}. Pode consultar ou realizar ações utilizando linguagem natural através da IA.`
  };
}
