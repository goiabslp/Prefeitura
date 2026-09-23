import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Vehicle, 
    Sector, 
    Person, 
    VehicleBrand as Brand, 
    Job 
} from '../../types';
import { 
    FleetMaintenance, 
    FleetPart, 
    FleetPurchase, 
    FleetStockMovement, 
    FleetSupplier, 
    FleetHistoryEvent, 
    VehicleHealthInfo, 
    FleetSettings as FleetSettingsType 
} from '../../types/fleetTypes';
import { 
    fleetManagementService 
} from '../../services/fleetManagementService';
import { AbastecimentoRecord } from '../../services/abastecimentoService';
import { 
    FleetDashboard 
} from './FleetDashboard';
import { 
    FleetVehicles 
} from './FleetVehicles';
import { 
    VehicleRecordScreen 
} from './VehicleRecordScreen';
import { 
    FleetMaintenances 
} from './FleetMaintenances';
import { 
    FleetParts 
} from './FleetParts';
import { 
    FleetStock 
} from './FleetStock';
import { 
    FleetPurchases 
} from './FleetPurchases';
import { 
    FleetSuppliers 
} from './FleetSuppliers';
import { 
    FleetTimeline 
} from './FleetTimeline';
import { 
    FleetReports 
} from './FleetReports';
import { 
    FleetSettings 
} from './FleetSettings';
import { 
    VehicleHealthModal, 
    NewMaintenanceModal, 
    NewPartModal 
} from './FleetModals';
import { 
    Car, 
    Gauge, 
    Wrench, 
    Package, 
    ShoppingBag, 
    Building2, 
    Clock, 
    FileText, 
    Sliders, 
    LayoutDashboard, 
    Layers, 
    ArrowLeft, 
    Sparkles, 
    Loader2 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

interface FleetModuleProps {
    vehicles: Vehicle[];
    sectors: Sector[];
    persons: Person[];
    jobs: Job[];
    brands?: Brand[];
    onAddVehicle?: (v: Vehicle) => Promise<void>;
    onUpdateVehicle?: (v: Vehicle) => Promise<void>;
    onDeleteVehicle?: (id: string) => Promise<void>;
    onBack: () => void;
}

export type FleetTab = 
    | 'dashboard' 
    | 'veiculos' 
    | 'prontuario' 
    | 'manutencoes' 
    | 'pecas' 
    | 'estoque' 
    | 'compras' 
    | 'fornecedores' 
    | 'historico' 
    | 'relatorios' 
    | 'configuracoes';

const TABS: Array<{ id: FleetTab; label: string; icon: any; path: string }> = [
    { id: 'dashboard', label: 'Dashboard & Saúde', icon: LayoutDashboard, path: '/Frota' },
    { id: 'veiculos', label: 'Veículos', icon: Car, path: '/Frota/Veiculos' },
    { id: 'manutencoes', label: 'Manutenções', icon: Wrench, path: '/Frota/Manutencoes' },
    { id: 'pecas', label: 'Peças', icon: Package, path: '/Frota/Pecas' },
    { id: 'estoque', label: 'Estoque', icon: Layers, path: '/Frota/Estoque' },
    { id: 'compras', label: 'Compras', icon: ShoppingBag, path: '/Frota/Compras' },
    { id: 'fornecedores', label: 'Fornecedores', icon: Building2, path: '/Frota/Fornecedores' },
    { id: 'historico', label: 'Histórico', icon: Clock, path: '/Frota/Historico' },
    { id: 'relatorios', label: 'Relatórios', icon: FileText, path: '/Frota/Relatorios' },
    { id: 'configuracoes', label: 'Configurações', icon: Sliders, path: '/Frota/Configuracoes' },
];

export const FleetModule: React.FC<FleetModuleProps> = ({
    vehicles,
    sectors,
    persons,
    jobs,
    brands,
    onAddVehicle,
    onUpdateVehicle,
    onDeleteVehicle,
    onBack
}) => {
    // Estado de Rota e Aba
    const [currentTab, setCurrentTab] = useState<FleetTab>('dashboard');
    const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);

    // Estados de Dados do Módulo Frota
    const [maintenances, setMaintenances] = useState<FleetMaintenance[]>([]);
    const [parts, setParts] = useState<FleetPart[]>([]);
    const [movements, setMovements] = useState<FleetStockMovement[]>([]);
    const [purchases, setPurchases] = useState<FleetPurchase[]>([]);
    const [suppliers, setSuppliers] = useState<FleetSupplier[]>([]);
    const [history, setHistory] = useState<FleetHistoryEvent[]>([]);
    const [abastecimentos, setAbastecimentos] = useState<AbastecimentoRecord[]>([]);
    const [settings, setSettings] = useState<FleetSettingsType>({
        oilAlertThresholdKm: 500,
        timingBeltAlertThresholdKm: 2000,
        maintenanceAlertThresholdDays: 15,
        defaultOilKm: 5000,
        defaultTimingBeltKm: 50000
    });
    const [loadingData, setLoadingData] = useState(true);

    // Modais
    const [healthModalTarget, setHealthModalTarget] = useState<{ health: VehicleHealthInfo; vehicle: Vehicle } | null>(null);
    const [isNewMaintenanceModalOpen, setIsNewMaintenanceModalOpen] = useState(false);
    const [maintenanceVehicleTarget, setMaintenanceVehicleTarget] = useState<string | undefined>(undefined);
    const [isNewPartModalOpen, setIsNewPartModalOpen] = useState(false);

    // 1. Carregar todos os dados da Frota do Supabase
    const loadAllFleetData = useCallback(async () => {
        try {
            const [
                maintenancesData,
                partsData,
                movementsData,
                purchasesData,
                suppliersData,
                historyData,
                settingsData
            ] = await Promise.all([
                fleetManagementService.getMaintenances(),
                fleetManagementService.getParts(),
                fleetManagementService.getStockMovements(),
                fleetManagementService.getPurchases(),
                fleetManagementService.getSuppliers(),
                fleetManagementService.getHistory(),
                fleetManagementService.getSettings()
            ]);

            setMaintenances(maintenancesData);
            setParts(partsData);
            setMovements(movementsData);
            setPurchases(purchasesData);
            setSuppliers(suppliersData);
            setHistory(historyData);
            setSettings(settingsData);

            // Carregar abastecimentos para cálculo de consumo e odômetro
            try {
                const { data: aData } = await supabase.from('abastecimentos').select('*').order('date', { ascending: false });
                if (aData) {
                    setAbastecimentos(aData.map((r: any) => ({
                        id: r.id,
                        protocol: r.protocol,
                        fiscal: r.fiscal,
                        date: r.date,
                        vehicle: r.vehicle,
                        driver: r.driver,
                        fuelType: r.fuel_type,
                        liters: Number(r.liters) || 0,
                        odometer: Number(r.odometer) || 0,
                        cost: Number(r.cost) || 0,
                        station: r.station,
                        invoiceNumber: r.invoice_number,
                        created_at: r.created_at
                    })));
                }
            } catch {}
        } catch (err) {
            console.error('Erro ao carregar dados da frota:', err);
        } finally {
            setLoadingData(false);
        }
    }, []);

    useEffect(() => {
        loadAllFleetData();
    }, [loadAllFleetData]);

    // 2. Cálculo da Lista de Saúde de Toda a Frota
    const healthList = useMemo(() => {
        return vehicles.map(v => fleetManagementService.calculateVehicleHealth(v, maintenances, settings));
    }, [vehicles, maintenances, settings]);

    // 3. Sincronização de URL e Navegação
    useEffect(() => {
        const path = window.location.pathname.toLowerCase();

        if (path.startsWith('/frota/veiculos/')) {
            const parts = path.split('/frota/veiculos/');
            const id = parts[1]?.split('/')[0];
            if (id) {
                setActiveVehicleId(id);
                setCurrentTab('prontuario');
                return;
            }
        }

        if (path === '/frota/veiculos') setCurrentTab('veiculos');
        else if (path === '/frota/manutencoes') setCurrentTab('manutencoes');
        else if (path === '/frota/pecas') setCurrentTab('pecas');
        else if (path === '/frota/estoque') setCurrentTab('estoque');
        else if (path === '/frota/compras') setCurrentTab('compras');
        else if (path === '/frota/fornecedores') setCurrentTab('fornecedores');
        else if (path === '/frota/historico') setCurrentTab('historico');
        else if (path === '/frota/relatorios') setCurrentTab('relatorios');
        else if (path === '/frota/configuracoes') setCurrentTab('configuracoes');
        else if (path === '/frota' || path === '/frota/dashboard') setCurrentTab('dashboard');
    }, []);

    const handleNavigate = (tab: string, subId?: string) => {
        const targetTab = tab as FleetTab;
        if (targetTab === 'prontuario' && subId) {
            setActiveVehicleId(subId);
            setCurrentTab('prontuario');
            window.history.pushState({}, '', `/Frota/Veiculos/${subId}`);
            return;
        }

        setActiveVehicleId(null);
        setCurrentTab(targetTab);
        const tabConfig = TABS.find(t => t.id === targetTab);
        if (tabConfig) {
            window.history.pushState({}, '', tabConfig.path);
        }
    };

    // Handlers de Ações
    const handleOpenProntuario = (vehicleId: string) => {
        handleNavigate('prontuario', vehicleId);
    };

    const handleOpenNewMaintenance = (vehicleId?: string) => {
        setMaintenanceVehicleTarget(vehicleId);
        setIsNewMaintenanceModalOpen(true);
    };

    const handleMaintenanceSubmit = async (maintenanceData: any) => {
        await fleetManagementService.createMaintenance(maintenanceData);
        await loadAllFleetData();
    };

    const handlePartSubmit = async (partData: any) => {
        await fleetManagementService.createPart(partData);
        await loadAllFleetData();
    };

    const handlePurchaseStatusUpdate = async (purchaseId: string, status: any) => {
        await fleetManagementService.updatePurchaseStatus(purchaseId, status);
        await loadAllFleetData();
    };

    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-slate-50 overflow-hidden">
            {/* BARRA SUPERIOR DE NAVEGAÇÃO E BREADCRUMBS */}
            <div className="bg-white border-b border-slate-200/90 shrink-0 px-3.5 py-2.5 md:px-5 flex flex-col gap-2 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl active:scale-95 transition-all cursor-pointer"
                            title="Voltar ao Painel Geral"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                            <Car className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <h1 className="text-sm md:text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-1.5">
                                <span>Gestão da Frota</span>
                                <span className="text-slate-300 font-normal">/</span>
                                <span className="text-amber-700 font-extrabold text-xs md:text-sm">
                                    {currentTab === 'prontuario' ? 'Prontuário do Veículo' :
                                     TABS.find(t => t.id === currentTab)?.label || 'Dashboard'}
                                </span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <span className="hidden sm:inline">Prefeitura de São José do Goiabal</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>
                </div>

                {/* CARROSSEL / MENU DE ABAS DO MÓDULO FROTA */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = currentTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleNavigate(tab.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                                    isActive
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                                }`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ÁREA DE CONTEÚDO PRINCIPAL (VIEWPORT MAXIMIZADO) */}
            <div className="flex-1 overflow-y-auto p-3.5 md:p-6 custom-scrollbar">
                {currentTab === 'dashboard' && (
                    <FleetDashboard
                        vehicles={vehicles}
                        maintenances={maintenances}
                        parts={parts}
                        abastecimentos={abastecimentos}
                        suppliers={suppliers}
                        healthList={healthList}
                        onNavigate={handleNavigate}
                        onOpenVehicleRecord={handleOpenProntuario}
                        onOpenHealthModal={(health, vehicle) => setHealthModalTarget({ health, vehicle })}
                        onOpenNewMaintenance={handleOpenNewMaintenance}
                        onOpenNewPart={() => setIsNewPartModalOpen(true)}
                        onOpenNewPurchase={() => handleNavigate('compras')}
                    />
                )}

                {currentTab === 'veiculos' && (
                    <FleetVehicles
                        vehicles={vehicles}
                        sectors={sectors}
                        persons={persons}
                        brands={brands}
                        healthList={healthList}
                        onOpenVehicleRecord={handleOpenProntuario}
                        onOpenNewVehicle={() => {}}
                        onEditVehicle={() => {}}
                        onDeleteVehicle={async (id) => {
                            if (onDeleteVehicle) await onDeleteVehicle(id);
                        }}
                        onOpenHealthModal={(health, vehicle) => setHealthModalTarget({ health, vehicle })}
                    />
                )}

                {currentTab === 'prontuario' && activeVehicleId && (
                    <VehicleRecordScreen
                        vehicleId={activeVehicleId}
                        onBack={() => handleNavigate('veiculos')}
                        sectors={sectors}
                        persons={persons}
                        onOpenNewMaintenance={handleOpenNewMaintenance}
                        onOpenNewOilChange={(vId, currentKm) => handleOpenNewMaintenance(vId)}
                        onOpenNewTimingBelt={(vId, currentKm) => handleOpenNewMaintenance(vId)}
                        onRefreshVehicles={loadAllFleetData}
                    />
                )}

                {currentTab === 'manutencoes' && (
                    <FleetMaintenances
                        maintenances={maintenances}
                        vehicles={vehicles}
                        parts={parts}
                        suppliers={suppliers}
                        onOpenNewMaintenance={handleOpenNewMaintenance}
                        onOpenVehicleRecord={handleOpenProntuario}
                    />
                )}

                {currentTab === 'pecas' && (
                    <FleetParts
                        parts={parts}
                        vehicles={vehicles}
                        suppliers={suppliers}
                        onOpenNewPart={() => setIsNewPartModalOpen(true)}
                        onEditPart={() => {}}
                        onDeletePart={async (id) => {
                            if (window.confirm('Excluir esta peça do catálogo?')) {
                                await fleetManagementService.deletePart(id);
                                await loadAllFleetData();
                            }
                        }}
                    />
                )}

                {currentTab === 'estoque' && (
                    <FleetStock
                        parts={parts}
                        movements={movements}
                        vehicles={vehicles}
                        onOpenNewMovement={() => {}}
                        onOpenNewPart={() => setIsNewPartModalOpen(true)}
                    />
                )}

                {currentTab === 'compras' && (
                    <FleetPurchases
                        purchases={purchases}
                        suppliers={suppliers}
                        parts={parts}
                        onOpenNewPurchase={() => {}}
                        onUpdateStatus={handlePurchaseStatusUpdate}
                    />
                )}

                {currentTab === 'fornecedores' && (
                    <FleetSuppliers
                        suppliers={suppliers}
                        maintenances={maintenances}
                        purchases={purchases}
                        onOpenNewSupplier={() => {}}
                        onEditSupplier={() => {}}
                        onDeleteSupplier={async (id) => {
                            if (window.confirm('Excluir este fornecedor?')) {
                                await fleetManagementService.deleteSupplier(id);
                                await loadAllFleetData();
                            }
                        }}
                    />
                )}

                {currentTab === 'historico' && (
                    <FleetTimeline
                        history={history}
                        vehicles={vehicles}
                        onOpenVehicleRecord={handleOpenProntuario}
                    />
                )}

                {currentTab === 'relatorios' && (
                    <FleetReports
                        vehicles={vehicles}
                        maintenances={maintenances}
                        abastecimentos={abastecimentos}
                        parts={parts}
                        suppliers={suppliers}
                        healthList={healthList}
                        sectors={sectors}
                    />
                )}

                {currentTab === 'configuracoes' && (
                    <FleetSettings
                        onSettingsSaved={() => loadAllFleetData()}
                    />
                )}
            </div>

            {/* MODAIS GLOBAIS DO MÓDULO */}
            {healthModalTarget && (
                <VehicleHealthModal
                    isOpen={!!healthModalTarget}
                    onClose={() => setHealthModalTarget(null)}
                    health={healthModalTarget.health}
                    vehicle={healthModalTarget.vehicle}
                    onOpenProntuario={handleOpenProntuario}
                    onOpenNewMaintenance={handleOpenNewMaintenance}
                    onOpenOilChange={(vId) => handleOpenNewMaintenance(vId)}
                />
            )}

            {isNewMaintenanceModalOpen && (
                <NewMaintenanceModal
                    isOpen={isNewMaintenanceModalOpen}
                    onClose={() => setIsNewMaintenanceModalOpen(false)}
                    vehicles={vehicles}
                    suppliers={suppliers}
                    parts={parts}
                    defaultVehicleId={maintenanceVehicleTarget}
                    onSubmit={handleMaintenanceSubmit}
                />
            )}

            {isNewPartModalOpen && (
                <NewPartModal
                    isOpen={isNewPartModalOpen}
                    onClose={() => setIsNewPartModalOpen(false)}
                    suppliers={suppliers}
                    vehicles={vehicles}
                    onSubmit={handlePartSubmit}
                />
            )}
        </div>
    );
};
