import React, { useState, useEffect } from 'react';
import { FilePlus, Package, History, FileText, ArrowRight, ArrowLeft, ShoppingCart, Gavel, Wallet, Inbox, CalendarRange, FileSearch, Droplet, Fuel, BarChart3, TrendingUp, LogOut, Activity, Car, ChevronDown, CalendarDays, Users, LayoutGrid, Megaphone, Database, Pill, Timer, Upload, Banknote, Newspaper, Sparkles, Star, AlertTriangle, Palette, FolderCheck, Ticket } from 'lucide-react';
import { UserRole, UIConfig, AppPermission, BlockType, DiariaEvento, Order, User } from '../types';
import { UpcomingEventsNotification } from './calendario/UpcomingEventsNotification';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { ExcelImportModal } from './compras/ExcelImportModal';
import { NoticiasAnnouncementModal } from './noticias/NoticiasAnnouncementModal';
import { userCanAccessSubmodule, userCanAccessModuleParent, MODULE_ACCESS_TREE } from '../services/permissionService';

interface HomeScreenProps {
    onNewOrder: (block?: BlockType, forceReset?: boolean) => void;
    onTrackOrder: () => void;
    onManageLicitacaoScreening?: () => void;
    onViewAllLicitacao?: () => void;
    onVehicleScheduling?: () => void;
    onCalendario?: () => void;
    onLogout: () => void;
    onOpenAdmin: (tab?: string | null) => void;
    onAbastecimento?: (sub: string) => void;
    onRH?: () => void;
    onProjetos?: () => void;
    onMarketing?: () => void;
    onConsultas?: () => void;
    onFarmacia?: () => void;
    onAutoSenha?: () => void;
    onNoticias?: () => void;
    onArt?: () => void;
    currentUser?: User | null;
    userRole: UserRole;
    userName: string;
    userId: string;
    userJobTitle?: string;
    uiConfig?: UIConfig;
    permissions: AppPermission[];
    activeBlock: BlockType | null;
    setActiveBlock: (block: BlockType | null) => void;
    stats: {
        totalGenerated: number;
        historyCount: number;
        activeUsers: number;
    };
    orders?: Order[];
    onViewOrder?: (order: Order) => void;
    allUsers?: User[];
    onManageInventory?: () => void;
    subView?: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
    currentUser,
    onNewOrder,
    onTrackOrder,
    onVehicleScheduling,
    onCalendario,
    onOpenAdmin,
    userRole,
    userName,
    userId,
    uiConfig,
    permissions = [],
    activeBlock,
    setActiveBlock,
    stats,
    onManageLicitacaoScreening,
    onViewAllLicitacao,
    onAbastecimento,
    onRH,
    onProjetos,
    onMarketing,
    onConsultas,
    onFarmacia,
    onAutoSenha,
    onNoticias,
    onArt,
    onLogout,
    orders = [],
    onViewOrder,
    onManageInventory,
    allUsers = [],
    subView = ''
}) => {
    // Permission Checks
    const { moduleStatus, mobileModuleStatus } = useSystemSettings();
    const [isMobileViewport, setIsMobileViewport] = useState(window.innerWidth < 700);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

    const [activeTrip, setActiveTrip] = useState<DiariaEvento | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobileViewport(window.innerWidth < 700);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const checkActiveTrip = async () => {
            if (!userId && !userName) return;
            try {
                const { getAllDiariaEventos } = await import('../services/diariasEventosService');
                const allEvts = await getAllDiariaEventos();
                const normalizeText = (t: string) => t ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
                const active = allEvts.find(evt => {
                    if (!evt.pessoas || !Array.isArray(evt.pessoas)) return false;
                    const p = evt.pessoas.find(x => x.id === userId || (x.name && normalizeText(x.name) === normalizeText(userName)));
                    return p && (p as any).viagem_inicio && !(p as any).viagem_fim;
                });
                setActiveTrip(active || null);
            } catch (e) {}
        };
        checkActiveTrip();
    }, [userId, userName]);

    // Permission Checks (AND Global Status - Web or Mobile)
    const isModuleActive = (key: string) => {
        if (isMobileViewport) {
            return mobileModuleStatus[key] !== false;
        }
        return moduleStatus[key] !== false;
    };

    const currentGlobalStatus = isMobileViewport ? mobileModuleStatus : moduleStatus;

    const activeUser: User = React.useMemo(() => {
        if (currentUser) return currentUser;
        return {
            id: userId,
            username: userName,
            name: userName,
            role: userRole,
            permissions: permissions
        };
    }, [currentUser, userId, userName, userRole, permissions]);

    const checkModuleAccess = (parentKey: string) => {
        const def = MODULE_ACCESS_TREE.find(m => m.key === parentKey);
        if (!def) return isModuleActive(parentKey) && permissions.includes(parentKey as AppPermission);
        return userCanAccessModuleParent(activeUser, def, currentGlobalStatus);
    };

    const canAccessOficio = checkModuleAccess('parent_criar_oficio');
    const canAccessCompras = checkModuleAccess('parent_compras');
    const canAccessLicitacao = checkModuleAccess('parent_licitacao');
    const canAccessDiarias = checkModuleAccess('parent_diarias');
    const canAccessScheduling = checkModuleAccess('parent_agendamento_veiculo');
    const canAccessFleet = checkModuleAccess('parent_frotas');
    const canAccessLicitacaoTriagem = permissions.includes('parent_licitacao_triagem');
    const canAccessLicitacaoProcessos = permissions.includes('parent_licitacao_processos');
    const canAccessAbastecimento = checkModuleAccess('parent_abastecimento');
    const canAccessCalendario = checkModuleAccess('parent_calendario');
    const canAccessRh = checkModuleAccess('parent_rh');
    const canAccessProjetos = checkModuleAccess('parent_projetos');
    const canAccessMarketing = checkModuleAccess('parent_marketing');
    const canAccessConsultas = checkModuleAccess('parent_consultas');
    const canAccessFarmacia = checkModuleAccess('parent_farmacia');
    const canAccessAutoSenha = checkModuleAccess('parent_autosenha');
    const canAccessNoticias = checkModuleAccess('parent_noticias');
    const canAccessUpload = checkModuleAccess('parent_upload');
    const canAccessArt = checkModuleAccess('parent_art');
    const canAccessDocumentos = checkModuleAccess('parent_documentos');
    const firstName = userName.split(' ')[0];

    const getPendingCount = (blockType: string) => {
        return orders.filter(o => {
            if (o.blockType !== blockType) return false;
            if (['completed', 'canceled', 'rejected', 'finishing', 'payment_account', 'paid'].includes(o.status)) return false;

            // Depende diretamente do usuário logado
            if (o.assigned_user_id === userId) return true;

            // Depende do Administrador para aprovar/prosseguir
            if (['pending', 'awaiting_approval', 'awaiting_ficha'].includes(o.status) && (userRole === 'admin' || permissions.includes('parent_admin'))) {
                return true;
            }

            return false;
        }).length;
    };

    // --- Helper Functions for Card Styling ---
    const getCardClass = (color: string, hideOnMobile: boolean = false) => {
        // Dynamic classes for hover states
        const hoverShadow = `hover:shadow-${color}-500/20`;
        const hoverBorder = `hover:border-${color}-200`;
        const hoverBg = `hover:from-white hover:to-${color}-50`;

        return `group relative w-full h-auto min-h-[90px] desktop:min-h-[140px] py-3.5 desktop:py-4 rounded-[2rem] desktop:rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.1)] ${hoverShadow} hover:-translate-y-1.5 ${hoverBorder} ${hoverBg} active:scale-95 transition-all duration-300 ease-out ${hideOnMobile ? 'hidden desktop:flex' : 'flex'} flex-col items-center justify-center overflow-hidden shrink-0`;
    };

    const getIconContainerClass = (color: string) => {
        return `w-12 h-12 desktop:w-16 desktop:h-16 rounded-xl desktop:rounded-2xl flex items-center justify-center mb-2 desktop:mb-3 transition-transform duration-500 ease-spring group-hover:scale-110 group-hover:rotate-3 shadow-lg bg-gradient-to-br from-${color}-500 to-${color}-600 text-white ring-4 ring-white`;
    };

    // --- Render Module Button ---
    const renderModuleButton = (
        onClick: () => void,
        color: string,
        Icon: React.ElementType,
        title: string,
        description: string,
        delay: string = '0ms',
        hideOnMobile: boolean = false,
        badgeCount: number = 0,
        isNewBadge: boolean = false
    ) => (
        <button
            onClick={onClick}
            className={`${getCardClass(color, hideOnMobile)} animate-in fade-in zoom-in duration-500 fill-mode-backwards relative`}
            style={{ animationDelay: delay }}
        >
            {isNewBadge && (
                <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-0.5 animate-pulse">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Novo</span>
                </div>
            )}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150`}></div>
            <div className={`absolute bottom-0 left-0 w-24 h-24 bg-${color}-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100`}></div>

            <div className="relative z-10 flex flex-col items-center p-4">
                <div className={`${getIconContainerClass(color)} relative`}>
                    <Icon className="w-7 h-7 desktop:w-8 desktop:h-8 drop-shadow-md" />
                    {badgeCount > 0 && (
                        <div className="absolute -top-2.5 -right-2.5 min-w-[24px] h-6 px-1.5 bg-rose-500 text-white text-[11px] font-black flex items-center justify-center rounded-full shadow-md ring-4 ring-white animate-in zoom-in spin-in-12 duration-300">
                            {badgeCount > 99 ? '99+' : badgeCount}
                        </div>
                    )}
                </div>
                <h2 className="text-sm desktop:text-xl font-bold text-slate-800 tracking-tight leading-none mb-1 group-hover:text-slate-900 transition-colors">{title}</h2>
                <p className="text-[10px] desktop:text-xs font-medium text-slate-500 text-center max-w-[120px] desktop:max-w-[150px] leading-tight group-hover:text-${color}-600 transition-colors">{description}</p>
            </div>

            <div className={`absolute bottom-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 text-${color}-600 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1`}>
                Acessar <ArrowRight className="w-3 h-3" />
            </div>
        </button>
    );

    // --- Scroll Indicator Logic ---
    const [showScrollIndicator, setShowScrollIndicator] = React.useState(false);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const checkScroll = () => {
            if (scrollContainerRef.current) {
                const { scrollHeight, clientHeight, scrollTop } = scrollContainerRef.current;
                // Show if content is taller than container AND user hasn't scrolled much yet
                if (scrollHeight > clientHeight && scrollTop < 50) {
                    setShowScrollIndicator(true);
                } else {
                    setShowScrollIndicator(false);
                }
            }
        };

        // Check on mount and resize
        checkScroll();
        window.addEventListener('resize', checkScroll);

        return () => window.removeEventListener('resize', checkScroll);
    }, []);

    const handleScroll = () => {
        if (showScrollIndicator) {
            setShowScrollIndicator(false);
        }
    };

    // --- Helper de Paleta de Cores para Submódulos ---
    const getSubmoduleColorTheme = (color: string) => {
        switch (color) {
            case 'amber':
                return {
                    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
                    iconShadow: 'shadow-amber-500/30',
                    hoverBorder: 'hover:border-amber-300',
                    hoverShadow: 'hover:shadow-amber-500/20',
                    hoverBgTo: 'hover:to-amber-50/60',
                    accentText: 'text-amber-600',
                    badgeText: 'text-amber-600',
                    cornerGlow: 'bg-amber-500/5'
                };
            case 'emerald':
                return {
                    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
                    iconShadow: 'shadow-emerald-500/30',
                    hoverBorder: 'hover:border-emerald-300',
                    hoverShadow: 'hover:shadow-emerald-500/20',
                    hoverBgTo: 'hover:to-emerald-50/60',
                    accentText: 'text-emerald-600',
                    badgeText: 'text-emerald-600',
                    cornerGlow: 'bg-emerald-500/5'
                };
            case 'indigo':
                return {
                    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
                    iconShadow: 'shadow-indigo-500/30',
                    hoverBorder: 'hover:border-indigo-300',
                    hoverShadow: 'hover:shadow-indigo-500/20',
                    hoverBgTo: 'hover:to-indigo-50/60',
                    accentText: 'text-indigo-600',
                    badgeText: 'text-indigo-600',
                    cornerGlow: 'bg-indigo-500/5'
                };
            case 'blue':
                return {
                    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
                    iconShadow: 'shadow-blue-500/30',
                    hoverBorder: 'hover:border-blue-300',
                    hoverShadow: 'hover:shadow-blue-500/20',
                    hoverBgTo: 'hover:to-blue-50/60',
                    accentText: 'text-blue-600',
                    badgeText: 'text-blue-600',
                    cornerGlow: 'bg-blue-500/5'
                };
            case 'violet':
                return {
                    iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
                    iconShadow: 'shadow-violet-500/30',
                    hoverBorder: 'hover:border-violet-300',
                    hoverShadow: 'hover:shadow-violet-500/20',
                    hoverBgTo: 'hover:to-violet-50/60',
                    accentText: 'text-violet-600',
                    badgeText: 'text-violet-600',
                    cornerGlow: 'bg-violet-500/5'
                };
            case 'purple':
                return {
                    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
                    iconShadow: 'shadow-purple-500/30',
                    hoverBorder: 'hover:border-purple-300',
                    hoverShadow: 'hover:shadow-purple-500/20',
                    hoverBgTo: 'hover:to-purple-50/60',
                    accentText: 'text-purple-600',
                    badgeText: 'text-purple-600',
                    cornerGlow: 'bg-purple-500/5'
                };
            case 'cyan':
                return {
                    iconBg: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
                    iconShadow: 'shadow-cyan-500/30',
                    hoverBorder: 'hover:border-cyan-300',
                    hoverShadow: 'hover:shadow-cyan-500/20',
                    hoverBgTo: 'hover:to-cyan-50/60',
                    accentText: 'text-cyan-600',
                    badgeText: 'text-cyan-600',
                    cornerGlow: 'bg-cyan-500/5'
                };
            case 'teal':
                return {
                    iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600',
                    iconShadow: 'shadow-teal-500/30',
                    hoverBorder: 'hover:border-teal-300',
                    hoverShadow: 'hover:shadow-teal-500/20',
                    hoverBgTo: 'hover:to-teal-50/60',
                    accentText: 'text-teal-600',
                    badgeText: 'text-teal-600',
                    cornerGlow: 'bg-teal-500/5'
                };
            case 'sky':
                return {
                    iconBg: 'bg-gradient-to-br from-sky-500 to-sky-600',
                    iconShadow: 'shadow-sky-500/30',
                    hoverBorder: 'hover:border-sky-300',
                    hoverShadow: 'hover:shadow-sky-500/20',
                    hoverBgTo: 'hover:to-sky-50/60',
                    accentText: 'text-sky-600',
                    badgeText: 'text-sky-600',
                    cornerGlow: 'bg-sky-500/5'
                };
            default:
                return {
                    iconBg: 'bg-gradient-to-br from-slate-600 to-slate-700',
                    iconShadow: 'shadow-slate-500/30',
                    hoverBorder: 'hover:border-slate-300',
                    hoverShadow: 'hover:shadow-slate-500/20',
                    hoverBgTo: 'hover:to-slate-50/60',
                    accentText: 'text-slate-600',
                    badgeText: 'text-slate-600',
                    cornerGlow: 'bg-slate-500/5'
                };
        }
    };

    // --- Active Block Rendering Logic ---
    const renderActiveBlock = () => {
        const getBlockConfig = () => {
            switch (activeBlock) {
                case 'oficio': return { name: "Módulo de Ofícios", color: 'indigo', icon: FileText, desc: "Geração, acompanhamento e histórico de ofícios oficiais" };
                case 'compras': return { name: "Módulo de Compras", color: 'emerald', icon: ShoppingCart, desc: "Abertura de pedidos, catálogo e controle de inventário" };
                case 'licitacao': return { name: "Módulo de Licitação", color: 'blue', icon: Gavel, desc: "Abertura e tramitação de processos licitatórios" };
                case 'diarias': return { name: "Módulo de Diárias", color: 'amber', icon: Wallet, desc: "Gestão completa de viagens, diárias, adiantamentos e prestações de contas" };
                case 'agendamento': return { name: "Agendamento", color: 'indigo', icon: CalendarRange, desc: "Agendamento de veículos e controle de motoristas" };
                case 'abastecimento': return { name: "Módulo de Abastecimento", color: 'cyan', icon: Fuel, desc: "Controle de abastecimentos, gestão e indicadores da frota" };
                default: return { name: "Módulo", color: 'slate', icon: Package, desc: "Selecione uma ação para continuar" };
            }
        };

        const config = getBlockConfig();

        const canAccessSub = (parentKey: string, subKey: string) => {
            return userCanAccessSubmodule(activeUser, parentKey, subKey, currentGlobalStatus);
        };

        // Define Action Buttons for Active Block
        const actionButtons: Array<any> = [];

        // Compras Specific Buttons
        if (activeBlock === 'compras') {
            if (canAccessSub('parent_compras', 'sub_compras_novo')) {
                actionButtons.push({
                    label: 'Novo Pedido',
                    desc: "Criar novo pedido de compras",
                    icon: FilePlus,
                    onClick: () => onNewOrder('compras', true),
                    color: config.color
                });
            }
            if (canAccessSub('parent_compras', 'sub_compras_historico')) {
                actionButtons.push({
                    label: 'Histórico',
                    desc: "Consulte registros de COMPRAS",
                    icon: History,
                    onClick: onTrackOrder,
                    color: 'purple'
                });
            }
            if (canAccessSub('parent_compras', 'sub_compras_itens')) {
                actionButtons.push({
                    label: 'Itens',
                    desc: 'Catálogo e Inventário',
                    icon: Package,
                    onClick: onManageInventory,
                    color: 'amber'
                });
            }
            if (isModuleActive('parent_compras_dados') && permissions.includes('parent_compras_dados')) {
                actionButtons.push({
                    label: 'Dados',
                    desc: 'Importar Planilha de Estoque',
                    icon: Database,
                    onClick: () => setIsExcelModalOpen(true),
                    color: 'cyan'
                });
            }
        }

        // Ofícios Specific Buttons
        if (activeBlock === 'oficio') {
            if (canAccessSub('parent_criar_oficio', 'sub_oficios_editor')) {
                actionButtons.push({
                    label: 'Novo Ofício',
                    desc: "Criar novo ofício",
                    icon: FilePlus,
                    onClick: () => onNewOrder('oficio', true),
                    color: config.color
                });
            }
            if (canAccessSub('parent_criar_oficio', 'sub_oficios_historico')) {
                actionButtons.push({
                    label: 'Histórico',
                    desc: "Consulte ofícios emitidos",
                    icon: History,
                    onClick: onTrackOrder,
                    color: 'purple'
                });
            }
        }

        // Diárias Specific Buttons: Organização padronizada por fluxo operacional e financeiro
        if (activeBlock === 'diarias') {
            // 1. Operacional de Viagens
            if (canAccessSub('parent_diarias', 'sub_diarias_novo_evento')) {
                actionButtons.push({
                    label: 'Nova Viagem',
                    desc: 'Cadastrar nova viagem',
                    icon: CalendarRange,
                    onClick: () => {
                        window.history.pushState({}, '', '/Diarias/NovoEvento');
                        window.dispatchEvent(new Event('popstate'));
                    },
                    color: 'amber'
                });
            }
            if (canAccessSub('parent_diarias', 'sub_diarias_viajar')) {
                actionButtons.push({
                    label: 'Viajar',
                    desc: 'Iniciar / Finalizar Viagens',
                    icon: Car,
                    onClick: () => {
                        window.history.pushState({}, '', '/Diarias/Viajar');
                        window.dispatchEvent(new Event('popstate'));
                    },
                    color: 'emerald'
                });
            }
            if (canAccessSub('parent_diarias', 'sub_diarias_lancamentos')) {
                actionButtons.push({
                    label: 'Lançamentos',
                    desc: 'Acompanhar Eventos',
                    icon: FileSearch,
                    onClick: () => {
                        window.history.pushState({}, '', '/Diarias/Lancamentos');
                        window.dispatchEvent(new Event('popstate'));
                    },
                    color: 'blue'
                });
            }

            // 2. Financeiro / Custeio
            if (canAccessSub('parent_diarias', 'sub_diarias_adiantamento')) {
                actionButtons.push({
                    label: 'Adiantamento',
                    desc: 'Solicitar Adiantamento',
                    icon: Banknote,
                    onClick: () => {
                        window.history.pushState({}, '', '/Diarias/Adiantamento');
                        window.dispatchEvent(new Event('popstate'));
                    },
                    color: 'violet'
                });
            }
            if (canAccessSub('parent_diarias', 'sub_diarias_reembolso')) {
                actionButtons.push({
                    label: 'Reembolso',
                    desc: 'Prestação de Contas',
                    icon: Wallet,
                    onClick: () => {
                        window.history.pushState({}, '', '/Diarias/Reembolso');
                        window.dispatchEvent(new Event('popstate'));
                    },
                    color: 'teal'
                });
            }

            // 3. Gestão e Registros
            if (canAccessSub('parent_diarias', 'sub_diarias_gestores')) {
                actionButtons.push({
                    label: 'Gestores',
                    desc: 'Vincular Gestores',
                    icon: Users,
                    onClick: () => {
                        window.history.pushState({}, '', '/Diarias/Gestores');
                        window.dispatchEvent(new Event('popstate'));
                    },
                    color: 'indigo'
                });
            }
            if (canAccessSub('parent_diarias', 'sub_diarias_historico')) {
                actionButtons.push({
                    label: 'Histórico',
                    desc: 'Consultar Registros',
                    icon: History,
                    onClick: onTrackOrder,
                    color: 'purple'
                });
            }
            if (canAccessSub('parent_diarias', 'sub_diarias_editor')) {
                actionButtons.push({
                    label: 'Nova Solicitação',
                    desc: 'Formulário Avulso',
                    icon: FilePlus,
                    onClick: () => onNewOrder('diarias', true),
                    color: 'slate'
                });
            }
        }

        // Licitação Specific Buttons
        if (activeBlock === 'licitacao') {
            if (canAccessSub('parent_licitacao', 'sub_licitacao_novo')) {
                actionButtons.push({
                    label: 'Novo Pedido',
                    desc: 'Abertura de Processo',
                    icon: FilePlus,
                    onClick: () => onNewOrder('licitacao', true),
                    color: config.color
                });
            }
            if (canAccessSub('parent_licitacao', 'sub_licitacao_processos')) {
                actionButtons.push({
                    label: 'Processos',
                    desc: 'Todos os Processos',
                    icon: FileSearch,
                    onClick: onTrackOrder,
                    color: 'sky'
                });
            }
        }

        // Abastecimento Specific Buttons
        if (activeBlock === 'abastecimento') {
            if (canAccessSub('parent_abastecimento', 'sub_abastecimento_novo')) {
                actionButtons.push({ label: 'Novo Abastecimento', desc: 'Registrar entrada', icon: Fuel, onClick: () => onAbastecimento?.('new'), color: 'cyan', hideOnMobile: false });
            }
            if (canAccessSub('parent_abastecimento', 'sub_abastecimento_gestao')) {
                actionButtons.push({ label: 'Gestão', desc: 'Histórico Completo', icon: History, onClick: () => onAbastecimento?.('management'), color: 'blue', hideOnMobile: false });
            }
            if (canAccessSub('parent_abastecimento', 'sub_abastecimento_dashboard')) {
                actionButtons.push({ label: 'Dashboard', desc: 'Indicadores', icon: BarChart3, onClick: () => onAbastecimento?.('dashboard'), color: 'emerald', hideOnMobile: false });
            }
        }

        const getGridContainerClass = (count: number) => {
            switch (count) {
                case 1:
                    return "w-full grid grid-cols-1 max-w-sm mx-auto gap-4";
                case 2:
                    return "w-full grid grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto gap-4 md:gap-6";
                case 3:
                    return "w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto gap-4 md:gap-6";
                case 4:
                    return "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto gap-4 md:gap-5";
                case 5:
                    return "w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 max-w-6xl mx-auto gap-3.5 md:gap-4";
                case 6:
                    return "w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto gap-4 md:gap-6";
                case 7:
                case 8:
                    return "w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-5xl mx-auto gap-4 md:gap-5";
                default:
                    return "w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-6xl mx-auto gap-4 md:gap-5";
            }
        };

        const headerTheme = getSubmoduleColorTheme(config.color);

        return (
            <>
                {/* Botão Voltar Padronizado com Rota URL */}
                <button
                    onClick={() => {
                        setActiveBlock(null);
                        window.history.pushState({}, '', '/PaginaInicial');
                        window.dispatchEvent(new Event('popstate'));
                    }}
                    className="fixed top-20 left-4 desktop:top-24 desktop:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-indigo-100 cursor-pointer"
                    title="Voltar ao Menu Principal"
                >
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-500 group-hover:text-indigo-600" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-indigo-700">Voltar</span>
                </button>

                <div className="w-full h-full flex flex-col relative animate-fade-in z-0 overflow-hidden bg-[#FAFAFA]">
                    <div className="flex-1 w-full p-4 md:p-8 overflow-y-auto custom-scrollbar flex flex-col items-center">
                        <div className="w-full my-auto flex flex-col items-center max-w-6xl py-8 md:py-12">
                            {/* Cabeçalho do Módulo */}
                            <div className="flex flex-col items-center mb-6 md:mb-8 shrink-0 text-center animation-delay-100 animate-in fade-in slide-in-from-bottom-3 duration-500">
                                <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl ${headerTheme.iconBg} flex items-center justify-center mb-3 shadow-lg ${headerTheme.iconShadow} ring-4 ring-white`}>
                                    <config.icon className="w-7 h-7 md:w-8 md:h-8 text-white drop-shadow-sm" />
                                </div>
                                <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight drop-shadow-xs">{config.name}</h2>
                                <p className="text-xs md:text-sm font-medium text-slate-500 max-w-md mt-1">{config.desc}</p>
                            </div>

                            {/* Banner de Viagem Ativa (se aplicável ao Módulo de Diárias) */}
                            {activeBlock === 'diarias' && activeTrip && (
                                <div
                                    onClick={() => {
                                        window.history.pushState({}, '', `/Diarias/Viajar/Detalhes?id=${activeTrip.id}`);
                                        window.dispatchEvent(new Event('popstate'));
                                    }}
                                    className="w-full max-w-4xl mb-6 bg-gradient-to-r from-amber-500 via-emerald-600 to-indigo-600 p-0.5 rounded-3xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group"
                                >
                                    <div className="bg-white rounded-[1.4rem] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Car className="w-5 h-5 animate-pulse" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                                                        <Timer className="w-3 h-3 text-amber-600" />
                                                        <span>Você está em Viagem</span>
                                                    </span>
                                                </div>
                                                <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                                                    {activeTrip.destino}
                                                </h3>
                                                <p className="text-slate-500 text-xs font-medium">
                                                    Clique para abrir o painel de bordo da viagem ativa em tempo real.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-wider shrink-0 self-end sm:self-auto bg-indigo-50 px-3.5 py-2 rounded-xl border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            <span>Ir para a Viagem</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Grade Padronizada de Ações */}
                            <div className={`${getGridContainerClass(actionButtons.length)} animate-in zoom-in duration-500 fill-mode-backwards p-1`}>
                                {actionButtons.length === 0 ? (
                                    <div className="col-span-full text-center p-8 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200 max-w-md shadow-sm animate-fade-in mx-auto">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3 text-amber-600">
                                            <AlertTriangle className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-base mb-1">Acesso Restrito</h3>
                                        <p className="text-xs text-slate-500 mb-4 leading-relaxed">Seu usuário não possui permissão ativa para as funcionalidades deste módulo.</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveBlock(null);
                                                window.history.pushState({}, '', '/PaginaInicial');
                                                window.dispatchEvent(new Event('popstate'));
                                            }}
                                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                                        >
                                            Voltar à Página Inicial
                                        </button>
                                    </div>
                                ) : (
                                    actionButtons.map((btn, idx) => {
                                        const theme = getSubmoduleColorTheme(btn.color);
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={btn.onClick}
                                                className={`group relative w-full min-h-[145px] md:min-h-[165px] p-5 md:p-6 rounded-[2rem] bg-gradient-to-br from-white via-white to-slate-50/60 border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_45px_rgb(0,0,0,0.08)] ${theme.hoverShadow} ${theme.hoverBorder} hover:from-white ${theme.hoverBgTo} transition-all duration-300 ease-spring hover:-translate-y-1.5 active:scale-95 flex flex-col items-center justify-between text-center overflow-hidden shrink-0 cursor-pointer ${btn.hideOnMobile ? 'hidden desktop:flex' : 'flex'}`}
                                                style={{ animationDelay: `${idx * 70}ms` }}
                                            >
                                                {/* Brilhos sutis nos cantos */}
                                                <div className={`absolute top-0 right-0 w-32 h-32 ${theme.cornerGlow} rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150`}></div>
                                                <div className={`absolute bottom-0 left-0 w-24 h-24 ${theme.cornerGlow} rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100`}></div>

                                                {/* Ícone */}
                                                <div className={`relative w-12 h-12 md:w-14 md:h-14 rounded-2xl ${theme.iconBg} flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-md ${theme.iconShadow} ring-4 ring-white shrink-0`}>
                                                    <btn.icon className="w-6 h-6 md:w-7 md:h-7 drop-shadow-xs" />
                                                </div>

                                                {/* Textos */}
                                                <div className="flex-1 flex flex-col items-center justify-center w-full">
                                                    <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight leading-snug group-hover:text-slate-950 transition-colors">
                                                        {btn.label}
                                                    </h3>
                                                    <p className={`text-[10px] md:text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider leading-relaxed transition-colors group-hover:${theme.accentText}`}>
                                                        {btn.desc}
                                                    </p>
                                                </div>

                                                {/* Indicador de Ação no Hover */}
                                                <div className={`mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1.5 group-hover:translate-y-0 ${theme.badgeText} font-extrabold text-[10px] uppercase tracking-widest flex items-center gap-1`}>
                                                    <span>Acessar</span>
                                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="flex-1 w-full h-full bg-[#F8FAFC] font-sans flex flex-col overflow-hidden relative">
            {activeBlock ? (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA] relative">
                    {renderActiveBlock()}
                </div>
            ) : (
                <main className="flex-1 flex flex-col overflow-hidden relative">


                    {/* Scrollable Modules Grid */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth"
                    >
                        <div className="p-4 lg:p-8 pb-32 desktop:pb-24 max-w-7xl mx-auto w-full pt-4 desktop:pt-6">

                            {/* ... content ... */}

                            {/* Welcome Header */}
                            <div className="mb-4">
                                <h1 className="text-2xl desktop:text-3xl font-extrabold text-slate-900 tracking-tighter mb-0.5">
                                    Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">{firstName}</span>.
                                </h1>
                                <p className="text-slate-500 text-base font-medium max-w-2xl">
                                    Selecione um módulo para iniciar suas atividades.
                                </p>
                            </div>

                            {/* Banner de Viagem em Andamento */}
                            {activeTrip && (
                                <div
                                    onClick={() => {
                                        window.history.pushState({}, '', `/Diarias/Viajar/Detalhes?id=${activeTrip.id}`);
                                        window.dispatchEvent(new Event('popstate'));
                                    }}
                                    className="mb-6 bg-gradient-to-r from-amber-500 via-emerald-600 to-indigo-600 p-0.5 rounded-[2rem] shadow-xl hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group"
                                >
                                    <div className="bg-white rounded-[1.9rem] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Car className="w-6 h-6 animate-pulse" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                                                        <Timer className="w-3 h-3 text-amber-600" />
                                                        <span>Você está em Viagem</span>
                                                    </span>
                                                </div>
                                                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                                                    {activeTrip.destino}
                                                </h3>
                                                <p className="text-slate-500 text-xs font-medium">
                                                    Você possui uma viagem em andamento. Clique aqui para ir direto para a tela da viagem.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-wider shrink-0 self-end sm:self-auto bg-indigo-50 px-4 py-2.5 rounded-2xl border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            <span>Ir para a Viagem</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modules Grid */}
                            <div className="grid grid-cols-2 desktop:grid-cols-3 xl:grid-cols-4 wide:grid-cols-5 gap-3 desktop:gap-4">
                                {/* Operational Modules */}
                                {canAccessOficio && renderModuleButton(() => setActiveBlock('oficio'), 'indigo', FileText, 'Ofícios', 'Geração e trâmite', '50ms', false, getPendingCount('oficio'))}
                                {canAccessDocumentos && renderModuleButton(() => {
                                    window.history.pushState({}, '', '/Documentos');
                                    window.dispatchEvent(new Event('popstate'));
                                }, 'blue', FolderCheck, 'Documentos', 'Fluxo interno e prazos', '75ms', false)}
                                {canAccessCompras && renderModuleButton(() => setActiveBlock('compras'), 'emerald', ShoppingCart, 'Compras', 'Pedidos e requisições', '100ms', false, getPendingCount('compras'))}
                                {canAccessDiarias && renderModuleButton(() => setActiveBlock('diarias'), 'amber', Wallet, 'Diárias', 'Despesas', '150ms', false, getPendingCount('diarias'))}
                                {canAccessLicitacao && renderModuleButton(() => setActiveBlock('licitacao'), 'blue', Gavel, 'Licitação', 'Processos', '200ms', false, getPendingCount('licitacao'))}

                                {/* Management Modules */}
                                {canAccessCalendario && renderModuleButton(() => onCalendario?.(), 'rose', CalendarDays, 'Calendário', 'Agenda', '235ms', false, getPendingCount('calendario'))}
                                {canAccessRh && renderModuleButton(() => onRH?.(), 'fuchsia', Users, 'RH', 'Gestão', '240ms', false, getPendingCount('rh'))}
                                {canAccessProjetos && renderModuleButton(() => onProjetos?.(), 'teal', LayoutGrid, 'Projetos', 'Gestão', '245ms', false, getPendingCount('projetos'))}
                                {canAccessMarketing && renderModuleButton(() => onMarketing?.(), 'teal', Megaphone, 'Marketing', 'Criativo', '248ms', false, getPendingCount('marketing'))}
                                {canAccessConsultas && renderModuleButton(() => onConsultas?.(), 'sky', Activity, 'Regulação', 'Regulação e exames', '249ms', false, getPendingCount('consultas'))}
                                {canAccessFarmacia && renderModuleButton(() => onFarmacia?.(), 'pink', Pill, 'Farmácia Popular', 'Medicamentos', '252ms', false, getPendingCount('farmacia'))}
                                {canAccessAutoSenha && renderModuleButton(() => {
                                    if (onAutoSenha) onAutoSenha();
                                    else {
                                        window.history.pushState({}, '', '/AutoSenha');
                                        window.dispatchEvent(new Event('popstate'));
                                    }
                                }, 'emerald', Ticket, 'AutoSenha', 'Filas & Senhas TV', '254ms', false, 0)}
                                {canAccessNoticias && renderModuleButton(() => onNoticias?.(), 'indigo', Newspaper, 'Notícias', 'Boletim & métricas', '255ms', false, 0, true)}
                                {canAccessArt && renderModuleButton(() => {
                                    if (onArt) onArt();
                                    else {
                                        window.history.pushState({}, '', '/Art');
                                        window.dispatchEvent(new Event('popstate'));
                                    }
                                }, 'violet', Palette, 'Art', 'Gerador de artes IA', '258ms', false, 0, true)}

                                {canAccessScheduling && renderModuleButton(() => { setActiveBlock('agendamento'); onVehicleScheduling?.(); }, 'violet', CalendarRange, 'Veículos', 'Agendamento', '250ms', false, getPendingCount('agendamento'))}
                                {canAccessAbastecimento && renderModuleButton(() => setActiveBlock('abastecimento'), 'cyan', Droplet, 'Abastecimento', 'Combustível', '300ms', false, getPendingCount('abastecimento'))}
                                {canAccessUpload && renderModuleButton(() => {
                                    window.history.pushState({}, '', '/Upload');
                                    window.dispatchEvent(new Event('popstate'));
                                }, 'sky', Upload, 'Upload Rápido', 'Anexar documentos', '320ms', false)}

                                {/* Admin Shortcut */}
                                {canAccessFleet && renderModuleButton(() => onOpenAdmin('fleet'), 'slate', Car, 'Frotas', 'Gestão', '450ms', false)}
                            </div>

                            {/* Mobile-only Logout */}
                            <button
                                onClick={onLogout}
                                className="mt-12 w-full py-4 rounded-2xl border border-rose-200 bg-white text-rose-500 font-bold uppercase tracking-widest text-xs flex desktop:hidden items-center justify-center gap-2 hover:bg-rose-50 transition-all shadow-sm"
                            >
                                <LogOut className="w-4 h-4" /> Sair do Sistema
                            </button>
                        </div>
                    </div>

                    {/* Scroll Indicator */}
                    <div
                        className={`absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-700 pointer-events-none z-30 ${showScrollIndicator ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    >
                        <div className="flex flex-col items-center gap-2 animate-bounce">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ver Mais</span>
                            <div className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-sm border border-white/60 shadow-lg flex items-center justify-center text-indigo-600">
                                <ChevronDown className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                </main>
            )}





            {/* EXCEL IMPORT MODAL */}
            {isExcelModalOpen && (
                <ExcelImportModal
                    userName={userName}
                    onClose={() => setIsExcelModalOpen(false)}
                />
            )}

            <UpcomingEventsNotification />

            {/* Modal Instantâneo de Anúncio: Novo Módulo Notícias */}
            <NoticiasAnnouncementModal
                userId={userId}
                logoUrl={uiConfig?.headerLogoUrl || uiConfig?.loginLogoUrl || localStorage.getItem('prefeitura_logo_url') || ''}
                onConhecerNoticias={() => {
                    if (onNoticias) {
                        onNoticias();
                    }
                }}
            />
        </div>
    );
};


