import React, { useState, useEffect } from 'react';
import { FilePlus, Package, History, FileText, ArrowRight, ArrowLeft, ShoppingCart, Gavel, Wallet, Inbox, CalendarRange, FileSearch, Droplet, Fuel, BarChart3, TrendingUp, LogOut, Sprout, HardHat, Activity, Car, ChevronDown, CalendarDays, Users, LayoutGrid, Megaphone, Database } from 'lucide-react';
import { UserRole, UIConfig, AppPermission, BlockType } from '../types';
import { TasksDashboard } from './dashboard/TasksDashboard';
import { QuickTaskCreation } from './dashboard/QuickTaskCreation';
import { UpcomingEventsNotification } from './calendario/UpcomingEventsNotification';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { Order, User } from '../types';
import { ExcelImportModal } from './compras/ExcelImportModal';

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
    onAgricultura?: () => void;
    onObras?: () => void;
    onRH?: () => void;
    onProjetos?: () => void;
    onMarketing?: () => void;
    onViewTasksDashboard?: () => void;
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
    onTaskCreated?: (task: Order) => void;
    onManageInventory?: () => void;
    subView?: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
    onNewOrder,
    onTrackOrder,
    onVehicleScheduling,
    onCalendario,
    onOpenAdmin,
    userRole,
    userName,
    userId,
    permissions = [],
    activeBlock,
    setActiveBlock,
    stats,
    onManageLicitacaoScreening,
    onViewAllLicitacao,
    onAbastecimento,
    onAgricultura,
    onObras,
    onRH,
    onProjetos,
    onMarketing,
    onLogout,
    onViewTasksDashboard,
    orders = [], // Receive orders for Tasks Dashboard
    onViewOrder, // Callback to view order details
    onManageInventory,
    allUsers = [], // Add access to users for task assignment (Need to add to Props interface first, but for now assuming it flows via spreading or defined explicitly if strict)
    subView = ''
}) => {
    // Permission Checks
    const { moduleStatus, mobileModuleStatus } = useSystemSettings();
    const [isMobileViewport, setIsMobileViewport] = useState(window.innerWidth < 700);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobileViewport(window.innerWidth < 700);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Permission Checks (AND Global Status - Web or Mobile)
    const isModuleActive = (key: string) => {
        if (isMobileViewport) {
            return mobileModuleStatus[key] !== false;
        }
        return moduleStatus[key] !== false;
    };

    const canAccessOficio = permissions.includes('parent_criar_oficio') && isModuleActive('parent_criar_oficio');
    const canAccessCompras = permissions.includes('parent_compras') && isModuleActive('parent_compras');
    const canAccessLicitacao = permissions.includes('parent_licitacao') && isModuleActive('parent_licitacao');
    const canAccessDiarias = permissions.includes('parent_diarias') && isModuleActive('parent_diarias');
    const canAccessScheduling = permissions.includes('parent_agendamento_veiculo') && isModuleActive('parent_agendamento_veiculo');
    const canAccessFleet = permissions.includes('parent_frotas') && isModuleActive('parent_frotas');
    const canAccessLicitacaoTriagem = permissions.includes('parent_licitacao_triagem');
    const canAccessLicitacaoProcessos = permissions.includes('parent_licitacao_processos');
    const canAccessAbastecimento = permissions.includes('parent_abastecimento') && isModuleActive('parent_abastecimento');
    const canAccessAgricultura = (permissions.includes('parent_agricultura') || userRole === 'admin') && isModuleActive('parent_agricultura');
    const canAccessObras = (permissions.includes('parent_obras') || userRole === 'admin') && isModuleActive('parent_obras');
    const canAccessTarefas = permissions.includes('parent_tarefas') && isModuleActive('parent_tarefas');
    const canAccessCalendario = (permissions.includes('parent_calendario') || userRole === 'admin') && isModuleActive('parent_calendario');
    const canAccessRh = (permissions.includes('parent_rh') || userRole === 'admin') && isModuleActive('parent_rh');
    const canAccessProjetos = (permissions.includes('parent_projetos') || userRole === 'admin') && isModuleActive('parent_projetos');
    const canAccessMarketing = (permissions.includes('parent_marketing') || userRole === 'admin') && isModuleActive('parent_marketing');
    const firstName = userName.split(' ')[0];

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

    const [isTasksDrawerOpen, setIsTasksDrawerOpen] = React.useState(false);
    const [isTaskCreationOpen, setIsTaskCreationOpen] = React.useState(false);

    React.useEffect(() => {
        if (activeBlock === 'tarefas') {
            if (subView === 'new') setIsTaskCreationOpen(true);
            else if (subView === 'dashboard') setIsTasksDrawerOpen(true);
            else {
                setIsTaskCreationOpen(false);
                setIsTasksDrawerOpen(false);
            }
        }
    }, [activeBlock, subView]);

    // --- Render Module Button ---
    const renderModuleButton = (
        onClick: () => void,
        color: string,
        Icon: React.ElementType,
        title: string,
        description: string,
        delay: string = '0ms',
        hideOnMobile: boolean = false,
        badgeCount: number = 0
    ) => (
        <button
            onClick={onClick}
            className={`${getCardClass(color, hideOnMobile)} animate-in fade-in zoom-in duration-500 fill-mode-backwards`}
            style={{ animationDelay: delay }}
        >
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

    // --- Active Block Rendering Logic ---
    const renderActiveBlock = () => {
        const getBlockConfig = () => {
            switch (activeBlock) {
                case 'oficio': return { name: "Módulo de Ofícios", color: 'indigo', icon: FileText };
                case 'compras': return { name: "Módulo de Compras", color: 'emerald', icon: ShoppingCart };
                case 'licitacao': return { name: "Módulo de Licitação", color: 'blue', icon: Gavel };
                case 'diarias': return { name: "Diárias e Custeio", color: 'amber', icon: Wallet };
                case 'agendamento': return { name: "Agendamento", color: 'indigo', icon: CalendarRange };
                case 'abastecimento': return { name: "Abastecimento", color: 'cyan', icon: Fuel };
                case 'agricultura': return { name: "Agricultura", color: 'emerald', icon: Sprout };
                case 'obras': return { name: "Obras", color: 'orange', icon: HardHat };
                case 'tarefas': return { name: "Gestão de Tarefas", color: 'pink', icon: Activity };
                default: return { name: "", color: 'slate', icon: Package };
            }
        };

        const config = getBlockConfig();

        // Define Action Buttons for Active Block
        const actionButtons: Array<any> = [];

        // "New" Button
        if (activeBlock !== 'abastecimento' && activeBlock !== 'tarefas') {
            actionButtons.push({
                label: activeBlock === 'compras' ? 'Novo Pedido' : activeBlock === 'oficio' ? 'Novo Ofício' : activeBlock === 'diarias' ? 'Nova Solicitação' : activeBlock === 'licitacao' ? 'Novo Processo' : 'Novo Registro',
                desc: "Criar novo registro",
                icon: FilePlus,
                onClick: () => onNewOrder(activeBlock || 'oficio', true), // Force state reset always when starting a new flow
                color: config.color
            });
            // "Track" Button
            actionButtons.push({
                label: activeBlock === 'licitacao' ? 'Meus Processos' : 'Histórico',
                desc: `Consulte registros de ${activeBlock?.toUpperCase()}`,
                icon: History,
                onClick: onTrackOrder,
                color: 'purple'
            });
        }

        // Diárias Specific Buttons
        if (activeBlock === 'diarias') {
            if (permissions.includes('parent_diarias_novo_evento') || userRole === 'admin') {
                actionButtons.push({
                    label: 'Novo Evento',
                    desc: 'Registrar evento externo',
                    icon: CalendarRange,
                    onClick: () => {
                        window.history.pushState({}, '', '/Diarias/NovoEvento');
                        window.dispatchEvent(new Event('popstate'));
                    },
                    color: 'amber'
                });
            }
            if (permissions.includes('parent_diarias_lancamentos') || userRole === 'admin') {
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
        }

        // Tarefas Specific Buttons
        if (activeBlock === 'tarefas') {
            actionButtons.push({
                label: 'Nova Tarefa',
                desc: "Criar nova atividade",
                icon: FilePlus,
                onClick: () => {
                    window.history.pushState({}, '', '/Tarefas/NovaTarefa');
                    setIsTaskCreationOpen(true);
                },
                color: 'pink'
            });
            actionButtons.push({
                label: 'Minhas Tarefas',
                desc: "Dashboard de Atividades",
                icon: History,
                onClick: onViewTasksDashboard,
                color: 'purple'
            });
        }

        // Specific Extra Buttons
        if (activeBlock === 'compras') {
            if (isModuleActive('parent_compras_itens') && permissions.includes('parent_compras_itens')) {
                actionButtons.push({ label: 'Itens', desc: 'Catálogo e Inventário', icon: Package, onClick: onManageInventory, color: 'amber' });
            }
            if (isModuleActive('parent_compras_dados') && permissions.includes('parent_compras_dados')) {
                actionButtons.push({ label: 'Dados', desc: 'Importar Planilha de Estoque', icon: Database, onClick: () => setIsExcelModalOpen(true), color: 'cyan' });
            }
        }
        if (activeBlock === 'licitacao') {
            if (canAccessLicitacaoTriagem) actionButtons.push({ label: 'Triagem', desc: 'Triagem de Processos', icon: Inbox, onClick: onManageLicitacaoScreening, color: 'amber' });
            if (canAccessLicitacaoProcessos) actionButtons.push({ label: 'Processos', desc: 'Todos os Processos', icon: FileSearch, onClick: onViewAllLicitacao, color: 'sky' });
        }
        if (activeBlock === 'abastecimento') {
            if (isModuleActive('parent_abastecimento_novo') && permissions.includes('parent_abastecimento_novo')) {
                actionButtons.push({ label: 'Novo Abastecimento', desc: 'Registrar entrada', icon: Fuel, onClick: () => onAbastecimento?.('new'), color: 'cyan', hideOnMobile: false });
            }
            if (isModuleActive('parent_abastecimento_gestao') && permissions.includes('parent_abastecimento_gestao')) {
                actionButtons.push({ label: 'Gestão', desc: 'Histórico Completo', icon: History, onClick: () => onAbastecimento?.('management'), color: 'blue', hideOnMobile: true });
            }
            if (isModuleActive('parent_abastecimento_dashboard') && permissions.includes('parent_abastecimento_dashboard')) {
                actionButtons.push({ label: 'Dashboard', desc: 'Indicadores', icon: BarChart3, onClick: () => onAbastecimento?.('dashboard'), color: 'emerald', hideOnMobile: true });
            }
        }

        return (
            <>
                {/* Fixed Back Button */}
                <button
                    onClick={() => setActiveBlock(null)}
                    className="fixed top-20 left-4 desktop:top-24 desktop:left-8 z-[999] group flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all p-2 pr-4 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-lg hover:shadow-xl hover:bg-white hover:-translate-y-0.5 hover:border-indigo-100"
                    title="Voltar ao Menu"
                >
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-indigo-600" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold group-hover:text-indigo-700">Voltar</span>
                </button>

                <div className="w-full h-full flex flex-col relative animate-fade-in z-0 overflow-hidden">
                    <div className="flex-1 w-full h-full p-4 desktop:p-8 pt-20 desktop:pt-24">
                        <div className="w-full min-h-full flex flex-col items-center justify-center container mx-auto">
                            <div className="flex flex-col items-center mb-8 shrink-0 animation-delay-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className={`p-5 rounded-[2rem] bg-gradient-to-br from-${config.color}-50 to-${config.color}-100/50 mb-5 shadow-sm ring-8 ring-white/50`}>
                                    <config.icon className={`w-12 h-12 text-${config.color}-600 drop-shadow-sm`} />
                                </div>
                                <h2 className="text-3xl desktop:text-5xl font-black text-slate-800 tracking-tight text-center drop-shadow-sm">{config.name}</h2>
                            </div>

                            <div className="w-full flex flex-wrap justify-center items-stretch gap-3 desktop:gap-4 max-w-6xl animate-in zoom-in duration-500 fill-mode-backwards p-2">
                                {actionButtons.map((btn, idx) => (
                                    <button
                                        key={idx}
                                        onClick={btn.onClick}
                                        className={`group relative flex-1 min-w-[240px] desktop:min-w-[260px] max-w-[360px] min-h-[120px] desktop:min-h-[130px] h-auto py-6 rounded-[2.5rem] bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-[0_10px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_25px_60px_rgb(0,0,0,0.12)] hover:shadow-${btn.color}-500/30 hover:border-${btn.color}-200 hover:from-white hover:to-${btn.color}-50/30 transition-all duration-300 ease-spring hover:-translate-y-2 active:scale-95 flex flex-col items-center justify-center overflow-hidden shrink-0 basis-0 grow ${btn.hideOnMobile ? 'hidden desktop:flex' : 'flex'}`}
                                        style={{ animationDelay: `${idx * 100}ms` }}
                                    >
                                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${btn.color}-500/5 rounded-bl-[100%] -mr-10 -mt-10 transition-transform duration-700 ease-out group-hover:scale-150`}></div>
                                        <div className={`absolute bottom-0 left-0 w-24 h-24 bg-${btn.color}-500/5 rounded-tr-[100%] -ml-10 -mb-10 transition-transform duration-700 ease-out group-hover:scale-125 opacity-0 group-hover:opacity-100`}></div>

                                        <div className={`relative w-12 h-12 desktop:w-14 desktop:h-14 rounded-2xl bg-gradient-to-br from-${btn.color}-500 to-${btn.color}-600 flex items-center justify-center mb-3 text-white group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 shadow-lg shadow-${btn.color}-500/30 ring-4 ring-white`}>
                                            <btn.icon className="w-6 h-6 desktop:w-7 desktop:h-7 drop-shadow-md" />
                                        </div>

                                        <h3 className="text-lg desktop:text-2xl font-bold text-slate-800 mb-1 group-hover:text-slate-900 tracking-tight">{btn.label}</h3>
                                        <p className="text-[10px] desktop:text-xs font-bold text-slate-400 group-hover:text-${btn.color}-600 transition-colors uppercase tracking-widest">{btn.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#F8FAFC] font-sans flex flex-col overflow-hidden relative">
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

                            {/* Modules Grid */}
                            <div className="grid grid-cols-2 desktop:grid-cols-3 xl:grid-cols-4 wide:grid-cols-5 gap-3 desktop:gap-4">
                                {/* Operational Modules */}
                                {canAccessOficio && renderModuleButton(() => setActiveBlock('oficio'), 'indigo', FileText, 'Ofícios', 'Geração e trâmite', '50ms', false)}
                                {canAccessCompras && renderModuleButton(() => setActiveBlock('compras'), 'emerald', ShoppingCart, 'Compras', 'Pedidos e requisições', '100ms', false, 0)}
                                {canAccessDiarias && renderModuleButton(() => setActiveBlock('diarias'), 'amber', Wallet, 'Diárias', 'Despesas', '150ms', false)}
                                {canAccessLicitacao && renderModuleButton(() => setActiveBlock('licitacao'), 'blue', Gavel, 'Licitação', 'Processos', '200ms', false)}

                                {/* Management Modules */}
                                {canAccessTarefas && renderModuleButton(() => setActiveBlock('tarefas'), 'pink', Activity, 'Tarefas', 'Atividades', '225ms', false)}
                                {canAccessCalendario && renderModuleButton(() => onCalendario?.(), 'rose', CalendarDays, 'Calendário', 'Agenda', '235ms', false)}
                                {canAccessRh && renderModuleButton(() => onRH?.(), 'fuchsia', Users, 'RH', 'Gestão', '240ms', false)}
                                {canAccessProjetos && renderModuleButton(() => onProjetos?.(), 'teal', LayoutGrid, 'Projetos', 'Gestão', '245ms', false)}
                                {canAccessMarketing && renderModuleButton(() => onMarketing?.(), 'teal', Megaphone, 'Marketing', 'Criativo', '248ms', false)}

                                {canAccessScheduling && renderModuleButton(() => { setActiveBlock('agendamento'); onVehicleScheduling?.(); }, 'violet', CalendarRange, 'Veículos', 'Agendamento', '250ms', false)}
                                {canAccessAbastecimento && renderModuleButton(() => setActiveBlock('abastecimento'), 'cyan', Droplet, 'Abastecimento', 'Combustível', '300ms', false)}

                                {/* Field Modules */}
                                {canAccessAgricultura && renderModuleButton(() => onAgricultura?.(), 'emerald', Sprout, 'Agricultura', 'Gestão rural', '350ms', false)}
                                {canAccessObras && renderModuleButton(() => onObras?.(), 'orange', HardHat, 'Obras', 'Gestão de obras', '400ms', false)}

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



            {/* TASKS DRAWER OVERLAY */}
            {isTasksDrawerOpen && subView !== 'dashboard' && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setIsTasksDrawerOpen(false)}
                    />

                    {/* Drawer Content */}
                    <div className="relative z-10 w-full max-w-md h-full bg-white/60 backdrop-blur-xl border-l border-white/50 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col p-4 desktop:p-6">
                        <TasksDashboard
                            orders={orders}
                            userRole={userRole}
                            userName={userName}
                            userId={userId}
                            onViewOrder={(order) => {
                                onViewOrder?.(order);
                                setIsTasksDrawerOpen(false); // Close drawer on selection
                            }}
                            onViewAll={(type) => {
                                onTrackOrder();
                                setIsTasksDrawerOpen(false);
                            }}
                            onClose={() => {
                                setIsTasksDrawerOpen(false);
                                if (activeBlock === 'tarefas') window.history.pushState({}, '', '/Tarefas');
                            }}
                        />
                    </div>
                </div>
            )}
            {/* TASK CREATION MODAL */}
            <QuickTaskCreation
                isOpen={isTaskCreationOpen}
                onClose={() => {
                    setIsTaskCreationOpen(false);
                    if (activeBlock === 'tarefas') window.history.pushState({}, '', '/Tarefas');
                }}
                currentUserId={userId}
                currentUserName={userName}
                users={allUsers || []}
                onTaskCreated={(task) => {
                    // Optional: Trigger any immediate UI update if needed, 
                    // though App.tsx should handle the state update via prop callback if we wired it there 
                    // or simply rely on Realtime/Refresh.
                    // Ideally we call a prop method to inject it into local state for instant feedback.
                    // Assuming App.tsx passes a handler or we rely on the refresh cycle triggered by the parent.
                    // For now, let's close.
                }}
            />

            {/* EXCEL IMPORT MODAL */}
            {isExcelModalOpen && (
                <ExcelImportModal
                    userName={userName}
                    onClose={() => setIsExcelModalOpen(false)}
                />
            )}

            <UpcomingEventsNotification />
        </div>
    );
};


