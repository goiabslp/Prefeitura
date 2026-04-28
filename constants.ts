
import { AppState, FontFamily, User, Order, Signature, Sector, Job, Person } from './types';

export const INITIAL_STATE: AppState = {
  branding: {
    logoUrl: null,
    primaryColor: '#4f46e5',
    secondaryColor: '#0f172a',
    fontFamily: FontFamily.SANS,
    logoWidth: 76,
    logoAlignment: 'left',
    watermark: {
      enabled: false,
      imageUrl: null,
      opacity: 20,
      size: 55,
      grayscale: true
    }
  },
  document: {
    headerText: 'São José do Goiabal - MG',
    footerText: 'ENDEREÇO: Praça Cônego João Pio, 30 - Centro – 35.986-000\nSão José do Goiabal-MG. CNPJ: 18.402.552/0001-91',
    city: 'São José do Goiabal - MG',
    showDate: true,
    showPageNumbers: true,
    showSignature: false,
    showLeftBlock: true,
    showRightBlock: true,
    titleStyle: {
      size: 12,
      color: '#131216',
      alignment: 'left'
    },
    leftBlockStyle: {
      size: 10,
      color: '#191822'
    },
    rightBlockStyle: {
      size: 10,
      color: '#191822'
    }
  },
  content: {
    title: 'Adicione um Titulo ao seu Documento',
    body: `Cumprimentando-o cordialmente, vimos por meio deste solicitar a Vossa Senhoria o que segue:\n\nEscreva aqui o detalhamento da sua solicitação, pedido ou comunicado de forma clara e objetiva. O texto agora utiliza quebras de linha nativas (Enter).\n\nCertos de contarmos com vossa costumeira atenção, antecipamos nossos sinceros agradecimentos e renovamos nossos votos de estima e consideração.\n\nAtenciosamente,`,
    signatureName: '',
    signatureRole: '',
    signatureSector: '',
    leftBlockText: 'Carregando...\nAssunto: Solicitação de Material',
    rightBlockText: 'Ao Excelentíssimo Senhor\nPrefeito Municipal de São José do Goiabal\nNesta Cidade',
    purchaseItems: [],
    priority: 'Normal',
    priorityJustification: '',
    signatures: [],
    useDigitalSignature: false,
    subType: undefined,
    showDiariaSignatures: false,
    showExtraField: false,
    extraFieldText: '',
    processType: '',
    completionForecast: '',
    evidenceItems: [],
    requesterName: '',
    requesterRole: '',
    requesterSector: '',
    destination: '',
    departureDateTime: '',
    returnDateTime: '',
    lodgingCount: 0,
    authorizedBy: '',
    distanceKm: 0,
    requestedValue: '',
    descriptionReason: '',
    paymentForecast: '',
    protocol: '',
    digitalSignature: undefined,
    selectedAccount: '',
    licitacaoStages: [],
    licitacaoActiveDraft: undefined,
    currentStageIndex: 0,
    viewingStageIndex: 0
  },
  ui: {
    loginLogoUrl: null,
    loginLogoHeight: 80,
    headerLogoUrl: null,
    headerLogoHeight: 40,
    homeLogoPosition: 'left'
  }
};

export const FONT_OPTIONS = [
  { label: 'Moderna (Inter)', value: FontFamily.SANS },
  { label: 'Clássica (Merriweather)', value: FontFamily.SERIF },
  { label: 'Técnica (Roboto Mono)', value: FontFamily.MONO },
];

export const MOCK_SIGNATURES: Signature[] = [
  { id: 'sig1', name: 'Maria Doroteia Dias Lemos', role: 'Chefe De Gabinete', sector: 'Gabinete do Prefeito' },
  { id: 'sig2', name: 'Ailton Geraldo Dos Santos', role: 'Prefeito Municipal', sector: '' },
  { id: 'sig3', name: 'Guilherme Araújo Ferreira dos Santos', role: 'Secretário Administrativo Municipal', sector: 'Administração Municipal' },
  { id: 'sig4', name: 'Tamires Araújo Rufino', role: 'Assitente Social - CRESS MG 33.870', sector: 'EMulti e Proteção Especial' }
];

export const DEFAULT_SECTORS: Sector[] = [
  { id: '8e780517-7489-408a-b866-932135029a1a', name: 'Secretaria de Administração' },
  { id: '0655d81b-5eab-4d4b-bf02-79469e7102e3', name: 'Secretaria de Saúde' },
  { id: '4465aa90-b53d-49d7-832f-762925b48197', name: 'Departamento de Cultura' },
  { id: 'f299723a-f2b7-4d69-a86d-62140bb0f828', name: 'Departamento de Turismo' },
  { id: 'e6cbaa03-2415-4424-91d1-667793d59e44', name: 'Departamento de Assistência Social' },
  { id: 'c155375d-639a-41f8-953b-e8549e3bf13f', name: 'Departamento de Contabilidade' },
  { id: '5779c164-9f79-4d68-af7e-3ce8ae375a00', name: 'Departamento de Educação' },
  { id: 'd8506e78-e565-427c-9189-9b9365c1979b', name: 'Departamento de Transporte' },
  { id: 'ab1a6f05-0453-487e-8566-60907e5b2257', name: 'Departamento de Recursos Humanos' },
  { id: '0bf81203-7a94-4d89-9a2f-38a6ec2726d1', name: 'Departamento de Compras' },
  { id: '25b12850-8041-432d-863a-bb9645218a59', name: 'Departamento de Tributos' },
  { id: 'f8347209-fa95-46aa-af74-72cc33544d64', name: 'Gabinete' },
  { id: 'd428e210-9276-4d05-b1a7-19e917d5982e', name: 'Departamento De Agricultura' },
  { id: 'fb719711-d0b8-472e-8356-946e537c35f0', name: 'Departamento De Obras' },
  { id: '23c6fa21-f998-4f54-b865-b94212f630ef', name: 'Departamento de Licitação' },
  { id: '82510255-a226-4d2b-9128-443b7be86455', name: 'Departamento de Meio Ambiente' },
  { id: 'c52119eb-8a4e-4dfc-a63e-089c8a929bc3', name: 'Departamento de Informática' }
];

export const DEFAULT_JOBS: Job[] = [
  { id: 'job1', name: 'Secretário de Administração e Finanças' },
  { id: 'job2', name: 'Chefe do Departamento de Educação' },
  { id: 'job3', name: 'Chefe do Departamento de Turismo' },
  { id: 'job4', name: 'Chefe do Departamento de Transporte' },
  { id: 'job5', name: 'Operador de Maquinas' },
  { id: 'job6', name: 'Motorista' },
  { id: 'job7', name: 'Prefeito' },
  { id: 'job8', name: 'Operário' },
  { id: 'job9', name: 'Auxiliar de serviços de contabilidade' },
  { id: 'job10', name: 'Chefe dos Serviços de Contabilidade e Orçamento' },
  { id: 'job11', name: 'Secretario de Saúde' },
  { id: 'job12', name: 'Chefe de Gabinete' },
  { id: 'job13', name: 'Chefe do Departamento de Cultura' },
  { id: 'job14', name: 'Auxiliar Administrativo' },
  { id: 'job15', name: 'Chefe do departamento de Licitação' },
  { id: 'job16', name: 'Chefe do Departamento de Compras' },
  { id: 'job17', name: 'Chefe do Departamento De Agricultura' },
  { id: 'job18', name: 'Vice-Prefeito' },
  { id: 'job19', name: 'Operador De Maquinas Pesadas' },
  { id: 'job20', name: 'Chefe Do Servico De Compras' },
  { id: 'job21', name: 'Gestor De Contratos' },
  { id: 'job22', name: 'Agente De Contratacao' },
  { id: 'job23', name: 'Controle Interno' },
  { id: 'job24', name: 'Auxiliar De Secretaria' },
  { id: 'job25', name: 'Chefe do Departamento de Saúde' },
  { id: 'job26', name: 'Bioquimico' },
  { id: 'job27', name: 'Farmaceutico' },
  { id: 'job28', name: 'Tecnico Administrativo' },
  { id: 'job29', name: 'Tecnico de TI' }
];

export const DEFAULT_PERSONS: Person[] = [
  { id: 'p1', name: 'Gaspar De Castro Andreu', jobId: 'job6', sectorId: 'f8347209-fa95-46aa-af74-72cc33544d64' },
  { id: 'p2', name: 'Guilherme Araujo Ferreira Dos Santos', jobId: 'job1', sectorId: '8e780517-7489-408a-b866-932135029a1a' },
  { id: 'p3', name: 'Ailton Geraldo Dos Santos', jobId: 'job7', sectorId: 'f8347209-fa95-46aa-af74-72cc33544d64' },
  { id: 'p4', name: 'Elio Vicente', jobId: 'job18', sectorId: 'f8347209-fa95-46aa-af74-72cc33544d64' },
  { id: 'p5', name: 'Maria Doroteia Dias Lemos', jobId: 'job12', sectorId: 'f8347209-fa95-46aa-af74-72cc33544d64' },
  { id: 'p6', name: 'Ernani Almeida Silva', jobId: 'job4', sectorId: 'd8506e78-e565-427c-9189-9b9365c1979b' },
  { id: 'p7', name: 'Allan Cesar Moraes Marques', jobId: 'job6', sectorId: 'd428e210-9276-4d05-b1a7-19e917d5982e' },
  { id: 'p8', name: 'Rodrigo Ermelindo De Souza', jobId: 'job19', sectorId: 'fb719711-d0b8-472e-8356-946e537c35f0' },
  { id: 'p9', name: 'Iaskara Soares Moraes', jobId: 'job2', sectorId: '5779c164-9f79-4d68-af7e-3ce8ae375a00' },
  { id: 'p10', name: 'Ricardo Faraci', jobId: 'job11', sectorId: '0655d81b-5eab-4d4b-bf02-79469e7102e3' },
  { id: 'p11', name: 'Gustavo Andreu Simoes Moraes', jobId: 'job17', sectorId: 'd428e210-9276-4d05-b1a7-19e917d5982e' },
  { id: 'p12', name: 'Apoliana Teixeira Silva', jobId: 'job20', sectorId: '0bf81203-7a94-4d89-9a2f-38a6ec2726d1' },
  { id: 'p13', name: 'Ramon Sandalo De Castro Perdigao', jobId: 'job21', sectorId: '0bf81203-7a94-4d89-9a2f-38a6ec2726d1' },
  { id: 'p14', name: 'Vitoria Eduarda Silva De Souza', jobId: 'job22', sectorId: '23c6fa21-f998-4f54-b865-b94212f630ef' },
  { id: 'p15', name: 'Edimeia Aparecida Silvestre', jobId: 'job23', sectorId: '23c6fa21-f998-4f54-b865-b94212f630ef' },
  { id: 'p16', name: 'Sheila Mara M M Rodrigues', jobId: 'job24', sectorId: '0655d81b-5eab-4d4b-bf02-79469e7102e3' },
  { id: 'p17', name: 'Cleunice Lourenco Carvalho', jobId: 'job25', sectorId: '0655d81b-5eab-4d4b-bf02-79469e7102e3' },
  { id: 'p18', name: 'Amanda Beatriz Ferreira', jobId: 'job26', sectorId: '0655d81b-5eab-4d4b-bf02-79469e7102e3' },
  { id: 'p19', name: 'Natalia Aparecida Da Silva', jobId: 'job27', sectorId: '0655d81b-5eab-4d4b-bf02-79469e7102e3' },
  { id: 'p20', name: 'Marcos Vinicios Felix Martins', jobId: 'job29', sectorId: 'c52119eb-8a4e-4dfc-a63e-089c8a929bc3' }
];

export const DEFAULT_USERS: User[] = [
  {
    id: 'user_guilherme',
    username: 'gaf',
    password: 'gaf',
    name: 'Guilherme Araújo Ferreira dos Santos',
    role: 'admin',
    sector: 'Secretaria de Administração',
    jobTitle: 'Secretário de Administração e Finanças',
    allowedSignatureIds: ['sig1', 'sig2', 'sig3'],
    permissions: ['parent_criar_oficio', 'parent_compras', 'parent_diarias', 'parent_diarias_novo_evento', 'parent_diarias_lancamentos', 'parent_admin', 'parent_agendamento_veiculo', 'parent_agricultura', 'parent_obras', 'parent_calendario', 'parent_rh']
  },
  {
    id: 'user_juliana',
    username: 'jmv',
    password: 'jmv',
    name: 'Juliana Miranda Vasconcelos',
    role: 'admin',
    sector: 'Secretaria de Administração',
    jobTitle: 'Tecnico Administrativo',
    allowedSignatureIds: ['sig1', 'sig2', 'sig3'],
    permissions: ['parent_criar_oficio', 'parent_compras', 'parent_diarias', 'parent_diarias_novo_evento', 'parent_diarias_lancamentos', 'parent_admin', 'parent_agendamento_veiculo', 'parent_agricultura', 'parent_obras', 'parent_calendario', 'parent_rh']
  },
  {
    id: 'user_maria',
    username: 'mdl',
    password: 'mdl',
    name: 'Maria Doroteia Dias Lemos',
    role: 'collaborator',
    sector: 'Gabinete',
    jobTitle: 'Chefe De Gabinete',
    allowedSignatureIds: ['sig1', 'sig2'],
    permissions: ['parent_criar_oficio', 'parent_compras', 'parent_diarias', 'parent_agendamento_veiculo', 'parent_rh']
  },
  {
    id: 'user_apoliana',
    username: 'apoliana',
    password: '123',
    name: 'Apoliana Teixeira Silva',
    role: 'compras',
    sector: 'Departamento de Compras',
    jobTitle: 'Chefe Do Servico De Compras',
    allowedSignatureIds: [],
    permissions: ['parent_criar_oficio', 'parent_compras', 'parent_diarias', 'parent_agendamento_veiculo', 'parent_rh']
  },
  {
    id: 'user_vitoria',
    username: 'ves',
    password: 'ves',
    name: 'Vitoria Eduarda Silva De Souza',
    role: 'licitacao',
    sector: 'Departamento de Licitação',
    jobTitle: 'Agente De Contratacao',
    allowedSignatureIds: [],
    permissions: ['parent_criar_oficio', 'parent_compras', 'parent_diarias', 'parent_agendamento_veiculo', 'parent_rh']
  },
  {
    id: 'user_marcos',
    username: 'mvf',
    password: 'mvf',
    name: 'Marcos Vinicios Felix Martins',
    role: 'admin',
    sector: 'Departamento de Informática',
    jobTitle: 'Tecnico de TI',
    allowedSignatureIds: ['sig1', 'sig2', 'sig3', 'sig4'],
    permissions: ['parent_criar_oficio', 'parent_compras', 'parent_diarias', 'parent_diarias_novo_evento', 'parent_diarias_lancamentos', 'parent_admin', 'parent_agendamento_veiculo', 'parent_agricultura', 'parent_obras', 'parent_calendario', 'parent_rh']
  }
];

export const MOCK_ORDERS: Order[] = [];
