declare global {
  const __APP_VERSION__: string;
}

export enum FontFamily {
  SANS = 'font-sans',
  SERIF = 'font-serif',
  MONO = 'font-mono'
}

export type LogoAlignment = 'left' | 'center' | 'right';

export interface WatermarkConfig {
  enabled: boolean;
  imageUrl: string | null;
  opacity: number;
  size: number;
  grayscale: boolean;
}

export interface BrandingConfig {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: FontFamily;
  logoWidth: number;
  logoAlignment: LogoAlignment;
  watermark: WatermarkConfig;
}

export interface TextStyle {
  size: number;
  color: string;
  alignment: 'left' | 'center' | 'right';
}

export interface DocumentConfig {
  headerText: string;
  footerText: string;
  city: string;
  showDate: boolean;
  showPageNumbers: boolean;
  showSignature: boolean;
  showLeftBlock: boolean;
  showRightBlock: boolean;
  titleStyle: TextStyle;
  leftBlockStyle: {
    size: number;
    color: string;
  };
  rightBlockStyle: {
    size: number;
    color: string;
  };
}

export interface EvidenceItem {
  title: string;
  imageUrl: string;
}

export type InventoryCategory = 'Construção' | 'Limpeza' | 'Alimentação' | 'Material de Uso' | 'Ferramentas' | 'Serviços';

export interface PurchaseItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'Pacote' | 'Caixa' | 'Kg' | 'Unidade' | 'Serviço' | 'Metro Cúbico (m³)' | string;
  code?: string;
  unit_value?: number;
  brand?: string;
  details?: string;
  isTendered?: boolean; // false = Não Licitado (Item de Inventário)
  originalProtocol?: string;
  category?: InventoryCategory;
  inventory_item_id?: string; // Add explicit reference to origin inventory item
  fornecedor?: string;
}

export interface InventoryItem {
  id: string;
  code?: string;
  name: string;
  brand?: string;
  details?: string;
  quantity: number;
  unit: string;
  unit_value?: number;
  reserved_quantity?: number; // Quantity allocated to pending orders
  category: InventoryCategory;
  is_tendered: boolean;
  original_order_protocol?: string;
  original_item_id?: string;
  created_at?: string;
  import_id?: string;
  fornecedor?: string;
}

export interface InventoryImport {
  id: string;
  filename: string;
  imported_by: string;
  imported_at: string;
  items_added: number;
  items_updated: number;
  items_ignored: number;
}

export interface ContentData {
  title: string;
  body: string;
  protocol?: string;
  protocolId?: string;
  signatureName: string;
  signatureRole: string;
  signatureSector: string;
  leftBlockText: string;
  rightBlockText: string;
  subType?: 'diaria' | 'custeio';
  showDiariaSignatures?: boolean;
  showExtraField?: boolean;
  extraFieldText?: string;
  processType?: string;
  completionForecast?: string;
  evidenceItems?: EvidenceItem[];
  purchaseItems?: PurchaseItem[];
  priority?: 'Normal' | 'Média' | 'Alta' | 'Urgência';
  priorityJustification?: string;
  requesterName?: string;
  requesterRole?: string;
  requesterSector?: string;
  destination?: string;
  departureDateTime?: string;
  returnDateTime?: string;
  lodgingCount?: number;
  authorizedBy?: string;
  distanceKm?: number;
  requestedValue?: string;
  descriptionReason?: string;
  description?: string; // Add description
  paymentForecast?: string;
  selectedAccount?: string;
  useDigitalSignature?: boolean;
  digitalSignature?: {
    enabled: boolean;
    method: string;
    ip: string;
    date: string;
    id: string; // Add ID as required
    signerName?: string;
    signerRole?: string;
  };
  signatures?: { name: string; role: string; sector: string; id?: string }[];
  licitacaoStages?: {
    id: string;
    title?: string; // Retained existing property
    body?: string; // Retained existing property
    signatureName?: string;
    signatureRole?: string;
    signatureSector?: string;
    signatures?: { name: string; role: string; sector: string; id?: string }[];
  }[];
  licitacaoActiveDraft?: { body: string; signatureName?: string; signatureRole?: string; signatureSector?: string; signatures?: { name: string; role: string; sector: string; id?: string }[] };
  currentStageIndex?: number;
  viewingStageIndex?: number;
  images?: {
    id: string;
    url: string;
    width?: number;
    height?: number;
    display_width?: number; // % or px
    align?: 'left' | 'center' | 'right';
  }[];
  attachments?: Attachment[];
}

export interface UIConfig {
  loginLogoUrl: string | null;
  loginLogoHeight: number;
  headerLogoUrl: string | null;
  headerLogoHeight: number;
  homeLogoPosition: 'left' | 'center';
}

export interface AppState {
  branding: BrandingConfig;
  document: DocumentConfig;
  content: ContentData;
  ui: UIConfig;
  view?: string; // Add optional view property for compatibility
  sub?: string;
  selectedId?: string;
}

export type UserRole = 'admin' | 'collaborator' | 'licitacao' | 'compras' | 'marketing';

export type AppPermission = 'parent_criar_oficio' | 'parent_admin' | 'parent_compras' | 'parent_licitacao' | 'parent_diarias' | 'parent_frotas' | 'parent_agendamento_veiculo' | 'parent_licitacao_triagem' | 'parent_licitacao_processos' | 'parent_abastecimento' | 'parent_abastecimento_novo' | 'parent_abastecimento_gestao' | 'parent_abastecimento_dashboard' | 'parent_agricultura' | 'parent_obras' | 'parent_tarefas' | 'parent_calendario' | 'parent_rh' | 'parent_projetos' | 'parent_marketing' | 'parent_compras_itens' | 'parent_compras_dados';

export type BlockType = 'oficio' | 'compras' | 'licitacao' | 'diarias' | 'agendamento' | 'abastecimento' | 'vs_calendar' | 'vs_history' | 'vs_approvals' | 'dashboard' | 'licitacao_screening' | 'agricultura' | 'obras' | 'tarefas' | 'calendario' | 'rh' | 'projetos' | 'marketing';

export interface User {
  id: string;
  username: string;
  password?: string;
  tempPassword?: string;
  tempPasswordExpiresAt?: number;
  mustChangePassword?: boolean;
  name: string;
  role: UserRole;
  sector?: string;
  sectorId?: string;
  jobTitle?: string;
  jobId?: string;
  allowedSignatureIds?: string[];
  permissions: AppPermission[];
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorEnabled2?: boolean;
  twoFactorSecret2?: string;
  email?: string;
  whatsapp?: string;
}

export interface Signature {
  id: string;
  name: string;
  role: string;
  sector: string;
}

export interface StatusMovement {
  statusLabel: string;
  date: string;
  userName: string;
  justification?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  date: string;
}

export interface Order {
  id: string;
  protocol: string;
  title: string;
  status: 'pending' | 'completed' | 'canceled' | 'approved' | 'rejected' | 'awaiting_approval' | 'in_progress' | 'finishing' | 'payment_account';
  purchaseStatus?: 'recebido' | 'coletando_orcamento' | 'aprovacao_orcamento' | 'coletando_dotacao' | 'realizado' | 'concluido' | 'cancelado';
  statusHistory?: StatusMovement[];
  createdAt: string;
  userId: string;
  userName: string;
  blockType: BlockType;
  documentSnapshot?: AppState;
  paymentStatus?: 'pending' | 'contabilidade' | 'paid';
  paymentDate?: string | null;
  budgetFileUrl?: string;
  attachments?: Attachment[];
  completionForecast?: string;
  stage?: string;
  requestingSector?: string;
  description?: string;
  is_public?: boolean;
  assigned_user_id?: string;
  priority?: 'Normal' | 'Média' | 'Alta' | 'Urgência' | 'normal'; // Allow lowercase 'normal' for back compatibility
  updatedAt?: string; // Add updatedAt
}

export interface Person {
  id: string;
  name: string;
  jobId?: string;
  sectorId?: string;
  role?: string;
  birth_date?: string;
  driver_code?: number;
}

export interface Sector {
  id: string;
  name: string;
  full_name?: string;
}

export interface Job {
  id: string;
  name: string;
}

export interface RhHorasExtras {
  id: string;
  created_at?: string;
  month: string;
  sector: string;
  entries: any[];
  user_id: string;
  user_name: string;
  signature_name: string;
  signature_role: string;
  signature_sector: string;
  updated_at?: string;
}

export type AccountStatus = 'Ativa' | 'Pendente';

export interface PurchaseAccount {
  id: string;
  agency: string;
  account_number: string;
  description: string;
  sector: string;
  status: AccountStatus;
  created_at: string;
  created_by?: string;
}

// Fleet Module Types
export type VehicleType = 'leve' | 'pesado' | 'acessorio';

export type VehicleStatus = 'operacional' | 'manutencao' | 'vistoria' | 'documentacao' | 'nao_liberado' | 'leilao' | 'leiloado' | 'batido';
export type MaintenanceStatus = 'em_dia' | 'andamento' | 'vencido';

export interface VehicleBrand {
  id: string;
  name: string;
  category: VehicleType;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  model: string;
  plate: string;
  brand: string;
  year: string;
  color: string;
  renavam: string;
  chassis: string;
  sectorId: string;
  responsiblePersonId?: string;
  documentUrl?: string;
  documentName?: string;
  vehicleImageUrl?: string;
  status: VehicleStatus;
  maintenanceStatus: MaintenanceStatus;
  vehicleCategory?: 'Carro' | 'Moto' | 'Van' | 'Ônibus' | 'Máquina Pesada' | 'Caminhão' | 'Acessórios';
  availableForScheduling?: 'Sim' | 'Não';
  fuelTypes?: string[];
  requestManagerIds?: string[];
  maxKml?: number;
  minKml?: number;
  currentKm?: number;
  oilLastChange?: number;
  oilNextChange?: number;
  oilCalculationBase?: 500 | 1000 | 2000 | 3000 | 5000 | 7000 | 10000;
  timingBeltLastChange?: number;
  timingBeltNextChange?: number;
  timingBeltCalculationBase?: 10000 | 20000 | 40000 | 50000 | 60000 | 80000 | 100000;

}

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  name: string;
  description?: string;
  file_url: string;
  file_type?: string;
  created_at?: string;
}

export type ScheduleStatus = 'pendente' | 'confirmado' | 'em_curso' | 'concluido' | 'cancelado';

export interface VehicleSchedule {
  id: string;
  protocol: string;
  vehicleId: string;
  driverId: string;
  serviceSectorId?: string;
  requesterPersonId?: string;
  departureDateTime: string;
  returnDateTime: string;
  destination: string;
  purpose: string;
  status: ScheduleStatus;
  requesterId: string;
  createdAt: string;
  vehicleLocation?: string;
  authorizedByName?: string;
  passengers?: CrewMember[];
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface CrewMember {
  name: string;
  departureLocation: string;
  appointmentTime: string;
  appointmentLocation: string;
}

export type ProjetoStatus = 'Aguardando Admin' | 'Em Andamento' | 'Concluído' | 'Cancelado';
export type ProjetoHistoryAction = 'Criado' | 'Encaminhado' | 'Mensagem' | 'Anexo' | 'Status Alterado';

export interface ProjetoObjective {
  id: string;
  name: string;
  responsible: string;
  details: string;
  status: 'Não Iniciado' | 'Em Andamento' | 'Concluído';
  attachments?: { url: string; name: string; caption?: string }[];
}

export interface Projeto {
  id: string;
  name: string;
  description?: string;
  responsible_id: string;
  status: ProjetoStatus;
  start_date?: string;
  end_date?: string;
  current_owner_id?: string;
  current_sector_id?: string;
  objectives?: ProjetoObjective[];
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjetoHistory {
  id: string;
  project_id: string;
  user_id: string;
  sector_id?: string;
  action: ProjetoHistoryAction;
  message?: string;
  attachments?: { url: string; name: string; caption?: string }[];
  created_at?: string;
}
