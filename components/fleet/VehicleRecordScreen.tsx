import React, { useState, useEffect } from 'react';
import { 
    Vehicle, 
    Sector, 
    Person, 
    VehicleDocument, 
    VehicleSchedule 
} from '../../types';
import { 
    FleetMaintenance, 
    VehicleHealthInfo, 
    HealthStatus 
} from '../../types/fleetTypes';
import { 
    fleetManagementService 
} from '../../services/fleetManagementService';
import { 
    Car, 
    Gauge, 
    Fuel, 
    Wrench, 
    Clock, 
    AlertTriangle, 
    CheckCircle2, 
    Calendar, 
    DollarSign, 
    FileText, 
    Upload, 
    Download, 
    Trash2, 
    Eye, 
    ChevronDown, 
    ChevronUp, 
    ArrowLeft, 
    Sparkles, 
    Plus, 
    Loader2, 
    Droplet, 
    ShieldCheck, 
    MapPin, 
    User, 
    Check, 
    X,
    ExternalLink,
    Paperclip,
    Layers,
    Share2,
    Printer
} from 'lucide-react';
import { AbastecimentoRecord } from '../../services/abastecimentoService';
import { fleetService } from '../../services/fleetService';

interface VehicleRecordScreenProps {
    vehicleId: string;
    onBack: () => void;
    sectors: Sector[];
    persons: Person[];
    onOpenNewMaintenance: (vehicleId: string) => void;
    onOpenNewOilChange: (vehicleId: string, currentKm: number) => void;
    onOpenNewTimingBelt: (vehicleId: string, currentKm: number) => void;
    onRefreshVehicles?: () => void;
}

export const VehicleRecordScreen: React.FC<VehicleRecordScreenProps> = ({
    vehicleId,
    onBack,
    sectors,
    persons,
    onOpenNewMaintenance,
    onOpenNewOilChange,
    onOpenNewTimingBelt,
    onRefreshVehicles
}) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        vehicle: Vehicle | null;
        health: VehicleHealthInfo | null;
        maintenances: FleetMaintenance[];
        abastecimentos: AbastecimentoRecord[];
        schedules: VehicleSchedule[];
        documents: VehicleDocument[];
        partsInstalled: any[];
        costsSummary: any;
        oilHistory: any[];
        timingBeltHistory: any[];
    }>({
        vehicle: null,
        health: null,
        maintenances: [],
        abastecimentos: [],
        schedules: [],
        documents: [],
        partsInstalled: [],
        costsSummary: null,
        oilHistory: [],
        timingBeltHistory: []
    });

    // Controle de Blocos Expansíveis (Minimizados por padrão, exceto Dados Gerais e Saúde)
    const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
        dadosGerais: true,
        saude: true,
        quilometragem: false,
        oleo: false,
        correia: false,
        manutencoes: false,
        pecas: false,
        abastecimentos: false,
        custos: false,
        documentos: false,
        agendamentos: false
    });

    const toggleBlock = (blockKey: string) => {
        setExpandedBlocks(prev => ({ ...prev, [blockKey]: !prev[blockKey] }));
    };

    const expandAll = () => {
        setExpandedBlocks({
            dadosGerais: true,
            saude: true,
            quilometragem: true,
            oleo: true,
            correia: true,
            manutencoes: true,
            pecas: true,
            abastecimentos: true,
            custos: true,
            documentos: true,
            agendamentos: true
        });
    };

    const collapseAll = () => {
        setExpandedBlocks({
            dadosGerais: false,
            saude: false,
            quilometragem: false,
            oleo: false,
            correia: false,
            manutencoes: false,
            pecas: false,
            abastecimentos: false,
            custos: false,
            documentos: false,
            agendamentos: false
        });
    };

    // Upload de Documentos
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [docDescription, setDocDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    const loadProntuario = async () => {
        setLoading(true);
        try {
            const res = await fleetManagementService.getVehicleProntuario(vehicleId);
            setData(res);
        } catch (err) {
            console.error('Erro ao carregar prontuário do veículo:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProntuario();
    }, [vehicleId]);

    const handleUploadDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !data.vehicle) return;

        setIsUploadingDoc(true);
        try {
            await fleetService.uploadVehicleDocument(
                data.vehicle.id,
                selectedFile,
                docDescription || selectedFile.name
            );
            await fleetManagementService.logHistory({
                vehicle_id: data.vehicle.id,
                event_type: 'documento',
                title: `Documento anexado: ${selectedFile.name}`,
                description: docDescription
            });
            setIsUploadModalOpen(false);
            setSelectedFile(null);
            setDocDescription('');
            await loadProntuario();
        } catch (err: any) {
            alert('Erro ao anexar documento: ' + (err.message || 'Falha no upload'));
        } finally {
            setIsUploadingDoc(false);
        }
    };

    const handleDeleteDoc = async (docId: string, fileUrl: string) => {
        if (!window.confirm('Deseja realmente excluir este documento?')) return;
        try {
            await fleetService.deleteVehicleDocument(docId, fileUrl);
            await loadProntuario();
        } catch (err: any) {
            alert('Erro ao excluir documento: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="h-96 w-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Carregando prontuário completo do veículo...
                </span>
            </div>
        );
    }

    const { vehicle, health, maintenances, abastecimentos: abasts, schedules, documents, partsInstalled, costsSummary, oilHistory, timingBeltHistory } = data;

    if (!vehicle) {
        return (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                <h3 className="text-lg font-black text-slate-900 uppercase">Veículo não encontrado</h3>
                <p className="text-xs text-slate-500 mt-1">O registro solicitado não existe ou foi removido.</p>
                <button
                    onClick={onBack}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase"
                >
                    Voltar para a Frota
                </button>
            </div>
        );
    }

    const sectorName = sectors.find(s => s.id === vehicle.sectorId)?.name || 'Não alocado';
    const responsibleName = persons.find(p => p.id === vehicle.responsiblePersonId)?.name || 'Não definido';

    return (
        <div className="space-y-4 pb-12 animate-in fade-in duration-300">
            {/* Header com Navegação e Resumo do Veículo */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start md:items-center gap-3.5">
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl active:scale-95 transition-all cursor-pointer shrink-0"
                            title="Voltar para a Lista de Veículos"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1 bg-slate-900 text-white font-mono font-black text-sm rounded-lg tracking-wider shadow-xs">
                                    {vehicle.plate}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                    vehicle.status === 'operacional' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                    vehicle.status === 'manutencao' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                    'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                    {vehicle.status === 'operacional' ? 'Operacional' : vehicle.status === 'manutencao' ? 'Em Manutenção' : 'Indisponível'}
                                </span>
                                {health && (
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                                        health.generalStatus === 'vencido' ? 'bg-rose-600 text-white' :
                                        health.generalStatus === 'proximo' ? 'bg-amber-500 text-white' :
                                        'bg-emerald-600 text-white'
                                    }`}>
                                        {health.generalStatus === 'vencido' ? '🔴 Vencido' : health.generalStatus === 'proximo' ? '🟡 Próximo' : '🟢 Em Dia'}
                                    </span>
                                )}
                            </div>

                            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight mt-1.5">
                                {vehicle.brand} {vehicle.model}
                            </h2>
                            <p className="text-xs font-semibold text-slate-500">
                                Prontuário Completo de Vida Útil do Veículo • Setor: {sectorName}
                            </p>
                        </div>
                    </div>

                    {/* Ações Rápidas no Prontuário */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => onOpenNewMaintenance(vehicle.id)}
                            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Nova Manutenção</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenNewOilChange(vehicle.id, Number(vehicle.currentKm) || 0)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                            <Droplet className="w-3.5 h-3.5 text-amber-600" />
                            <span>Trocar Óleo</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsUploadModalOpen(true)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                            <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                            <span>Anexar Doc</span>
                        </button>
                    </div>
                </div>

                {/* Barra de Controle de Expansão dos Blocos */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs font-bold text-slate-500">
                    <span>Organização em blocos expansíveis</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={expandAll}
                            className="text-sky-600 hover:underline cursor-pointer font-black"
                        >
                            Expandir Todos
                        </button>
                        <span>•</span>
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="text-slate-500 hover:underline cursor-pointer"
                        >
                            Recolher Todos
                        </button>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 1: DADOS GERAIS DO VEÍCULO */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('dadosGerais')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                            <Car className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            1. Dados Gerais & Cadastrais
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-xs font-bold">{expandedBlocks.dadosGerais ? 'Ocultar' : 'Exibir'}</span>
                        {expandedBlocks.dadosGerais ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </button>

                {expandedBlocks.dadosGerais && (
                    <div className="p-4 md:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 border-t border-slate-100 animate-in fade-in duration-200">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Marca / Modelo</span>
                            <span className="text-xs font-black text-slate-900 uppercase">{vehicle.brand} {vehicle.model}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Placa</span>
                            <span className="text-xs font-mono font-black text-slate-900">{vehicle.plate}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Ano</span>
                            <span className="text-xs font-bold text-slate-800">{vehicle.year || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Cor</span>
                            <span className="text-xs font-bold text-slate-800">{vehicle.color || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Renavam</span>
                            <span className="text-xs font-mono font-bold text-slate-800">{vehicle.renavam || 'Não informado'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Chassi</span>
                            <span className="text-xs font-mono font-bold text-slate-800">{vehicle.chassis || 'Não informado'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Setor Alocado</span>
                            <span className="text-xs font-extrabold text-slate-900">{sectorName}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Responsável / Motorista</span>
                            <span className="text-xs font-extrabold text-slate-900">{responsibleName}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Categoria</span>
                            <span className="text-xs font-bold text-slate-800">{vehicle.vehicleCategory || vehicle.type || 'Carro'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Capacidade</span>
                            <span className="text-xs font-bold text-slate-800">{vehicle.passengerCapacity || 5} passageiros</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Combustível</span>
                            <span className="text-xs font-bold text-slate-800">{(vehicle.fuelTypes || ['FLEX']).join(', ')}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Para Agendamento</span>
                            <span className="text-xs font-bold text-emerald-700">{vehicle.availableForScheduling || 'Sim'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 2: QUILOMETRAGEM & ODÔMETRO */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('quilometragem')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Gauge className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                2. Quilometragem Atual & Histórico de Odômetro
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                            {(Number(vehicle.currentKm) || 0).toLocaleString('pt-BR')} km
                        </span>
                        {expandedBlocks.quilometragem ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.quilometragem && (
                    <div className="p-4 md:p-6 space-y-4 border-t border-slate-100 animate-in fade-in duration-200">
                        <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-950 flex items-start gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-black uppercase block">Controle Automático de Odômetro:</strong>
                                O KM Atual é sincronizado e validado automaticamente a partir dos lançamentos de abastecimentos e ordens de serviço mecânicas, garantindo precisão e evitando descalibração manual.
                            </div>
                        </div>

                        {/* Tabela dos últimos odômetros registrados */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-black text-[10px]">
                                    <tr>
                                        <th className="p-2.5 rounded-l-xl">Data</th>
                                        <th className="p-2.5">Origem</th>
                                        <th className="p-2.5">Odômetro Registrado</th>
                                        <th className="p-2.5 rounded-r-xl">Motorista / Responsável</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {abasts.slice(0, 5).map(a => (
                                        <tr key={a.id} className="hover:bg-slate-50/80">
                                            <td className="p-2.5 font-bold">{new Date(a.date).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-2.5">
                                                <span className="px-2 py-0.5 bg-sky-50 text-sky-700 font-black rounded-md border border-sky-200 text-[10px] uppercase">
                                                    Abastecimento
                                                </span>
                                            </td>
                                            <td className="p-2.5 font-mono font-black text-slate-900">
                                                {(a.odometer || 0).toLocaleString('pt-BR')} km
                                            </td>
                                            <td className="p-2.5 font-bold text-slate-800">{a.driver || 'Não informado'}</td>
                                        </tr>
                                    ))}
                                    {abasts.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-4 text-center text-slate-400 font-bold">
                                                Nenhum registro de odômetro registrado via abastecimento
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 3: TROCA DE ÓLEO & HISTÓRICO */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('oleo')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Droplet className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            3. Situação da Troca de Óleo
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        {health && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                                health.oilStatus === 'vencido' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                health.oilStatus === 'proximo' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                                {health.oilStatus === 'vencido' ? 'Óleo Vencido' : health.oilStatus === 'proximo' ? 'Óleo Próximo' : 'Óleo Em Dia'}
                            </span>
                        )}
                        {expandedBlocks.oleo ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.oleo && (
                    <div className="p-4 md:p-6 space-y-4 border-t border-slate-100 animate-in fade-in duration-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Última Troca</span>
                                <span className="text-base font-black font-mono text-slate-900">
                                    {(Number(vehicle.oilLastChange) || 0).toLocaleString('pt-BR')} km
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Base de Cálculo</span>
                                <span className="text-base font-black font-mono text-slate-900">
                                    {(vehicle.oilCalculationBase || 5000).toLocaleString('pt-BR')} km
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Próxima Troca</span>
                                <span className="text-base font-black font-mono text-slate-900">
                                    {(Number(vehicle.oilNextChange) || 0).toLocaleString('pt-BR')} km
                                </span>
                            </div>
                            <div className={`p-3 rounded-2xl border ${
                                (health?.oilKmRemaining || 0) < 0 ? 'bg-rose-50 border-rose-200 text-rose-900' :
                                (health?.oilKmRemaining || 0) <= 500 ? 'bg-amber-50 border-amber-200 text-amber-900' :
                                'bg-emerald-50 border-emerald-200 text-emerald-900'
                            }`}>
                                <span className="text-[10px] font-black uppercase block opacity-80">KM Restante</span>
                                <span className="text-base font-black font-mono">
                                    {health?.oilKmRemaining !== undefined
                                        ? `${health.oilKmRemaining.toLocaleString('pt-BR')} km`
                                        : 'A definir'}
                                </span>
                            </div>
                        </div>

                        {/* Botão para lançar troca */}
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => onOpenNewOilChange(vehicle.id, Number(vehicle.currentKm) || 0)}
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Registrar Nova Troca de Óleo</span>
                            </button>
                        </div>

                        {/* Histórico completo de trocas de óleo */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-black text-[10px]">
                                    <tr>
                                        <th className="p-2.5 rounded-l-xl">Data do Serviço</th>
                                        <th className="p-2.5">KM Registrado</th>
                                        <th className="p-2.5 rounded-r-xl">Protocolo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {oilHistory.map(o => (
                                        <tr key={o.id} className="hover:bg-slate-50/80">
                                            <td className="p-2.5 font-bold">{new Date(o.service_date).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-2.5 font-mono font-black text-slate-900">
                                                {(o.current_km || 0).toLocaleString('pt-BR')} km
                                            </td>
                                            <td className="p-2.5 font-mono text-slate-400">{o.id.substring(0, 8).toUpperCase()}</td>
                                        </tr>
                                    ))}
                                    {oilHistory.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-4 text-center text-slate-400 font-bold">
                                                Nenhum registro histórico de troca de óleo
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 4: CORREIA DENTADA & HISTÓRICO */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('correia')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                            <Layers className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            4. Situação da Correia Dentada
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        {health && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                                health.timingBeltStatus === 'vencido' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                health.timingBeltStatus === 'proximo' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                                {health.timingBeltStatus === 'vencido' ? 'Correia Vencida' : health.timingBeltStatus === 'proximo' ? 'Correia Próxima' : 'Correia Em Dia'}
                            </span>
                        )}
                        {expandedBlocks.correia ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.correia && (
                    <div className="p-4 md:p-6 space-y-4 border-t border-slate-100 animate-in fade-in duration-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Última Troca</span>
                                <span className="text-base font-black font-mono text-slate-900">
                                    {(Number(vehicle.timingBeltLastChange) || 0).toLocaleString('pt-BR')} km
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Base de Cálculo</span>
                                <span className="text-base font-black font-mono text-slate-900">
                                    {(vehicle.timingBeltCalculationBase || 50000).toLocaleString('pt-BR')} km
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Próxima Troca</span>
                                <span className="text-base font-black font-mono text-slate-900">
                                    {(Number(vehicle.timingBeltNextChange) || 0).toLocaleString('pt-BR')} km
                                </span>
                            </div>
                            <div className={`p-3 rounded-2xl border ${
                                (health?.timingBeltKmRemaining || 0) < 0 ? 'bg-rose-50 border-rose-200 text-rose-900' :
                                (health?.timingBeltKmRemaining || 0) <= 2000 ? 'bg-amber-50 border-amber-200 text-amber-900' :
                                'bg-emerald-50 border-emerald-200 text-emerald-900'
                            }`}>
                                <span className="text-[10px] font-black uppercase block opacity-80">KM Restante</span>
                                <span className="text-base font-black font-mono">
                                    {health?.timingBeltKmRemaining !== undefined
                                        ? `${health.timingBeltKmRemaining.toLocaleString('pt-BR')} km`
                                        : 'A definir'}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => onOpenNewTimingBelt(vehicle.id, Number(vehicle.currentKm) || 0)}
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Registrar Troca de Correia</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 5: HISTÓRICO DE MANUTENÇÕES PREVENTIVAS E CORRETIVAS */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('manutencoes')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                            <Wrench className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            5. Manutenções Preventivas & Corretivas
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500">
                            {maintenances.length} ordens de serviço
                        </span>
                        {expandedBlocks.manutencoes ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.manutencoes && (
                    <div className="p-4 md:p-6 space-y-4 border-t border-slate-100 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500">Histórico mecânico detalhado</span>
                            <button
                                type="button"
                                onClick={() => onOpenNewMaintenance(vehicle.id)}
                                className="px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Cadastrar Manutenção</span>
                            </button>
                        </div>

                        <div className="space-y-3">
                            {maintenances.map(m => (
                                <div key={m.id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black uppercase rounded-md border border-amber-300">
                                                    {m.type}
                                                </span>
                                                <span className="text-xs font-bold text-slate-500">
                                                    {new Date(m.maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </span>
                                                <span className="text-xs font-mono font-black text-slate-800">
                                                    {m.current_km.toLocaleString('pt-BR')} km
                                                </span>
                                            </div>
                                            <p className="text-xs font-extrabold text-slate-900 mt-1">
                                                {m.description}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black text-slate-900 block">
                                                R$ {m.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400">
                                                {m.workshop_name || m.supplier_name || 'Oficina Geral'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Peças utilizadas nesta manutenção */}
                                    {m.parts_used && m.parts_used.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap text-[10px]">
                                            <span className="font-bold text-slate-400 uppercase">Peças aplicadas:</span>
                                            {m.parts_used.map(pu => (
                                                <span key={pu.id} className="px-2 py-0.5 bg-white rounded-md border border-slate-200 font-extrabold text-slate-800">
                                                    {pu.quantity}x {pu.part_name} (R$ {pu.total_price.toFixed(2)})
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {maintenances.length === 0 && (
                                <div className="p-8 text-center text-slate-400 text-xs font-bold">
                                    Nenhuma manutenção registrada para este veículo
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 6: PEÇAS INSTALADAS */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('pecas')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Wrench className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            6. Peças Instaladas no Veículo
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500">
                            {partsInstalled.length} peças
                        </span>
                        {expandedBlocks.pecas ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.pecas && (
                    <div className="p-4 md:p-6 border-t border-slate-100 animate-in fade-in duration-200">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-black text-[10px]">
                                    <tr>
                                        <th className="p-2.5 rounded-l-xl">Data Instalação</th>
                                        <th className="p-2.5">KM</th>
                                        <th className="p-2.5">Peça</th>
                                        <th className="p-2.5">Qtd</th>
                                        <th className="p-2.5">Valor Unit.</th>
                                        <th className="p-2.5">Total</th>
                                        <th className="p-2.5 rounded-r-xl">Oficina</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {partsInstalled.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50/80">
                                            <td className="p-2.5 font-bold">{new Date(p.maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                            <td className="p-2.5 font-mono font-bold">{p.maintenance_km.toLocaleString('pt-BR')} km</td>
                                            <td className="p-2.5 font-extrabold text-slate-900">{p.part_name}</td>
                                            <td className="p-2.5 font-bold">{p.quantity}</td>
                                            <td className="p-2.5 font-mono">R$ {p.unit_price.toFixed(2)}</td>
                                            <td className="p-2.5 font-mono font-black text-slate-900">R$ {p.total_price.toFixed(2)}</td>
                                            <td className="p-2.5 font-semibold text-slate-500">{p.workshop_name || '-'}</td>
                                        </tr>
                                    ))}
                                    {partsInstalled.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                                                Nenhuma peça registrada via ordem de manutenção
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 7: ABASTECIMENTOS & CONSUMO */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('abastecimentos')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                            <Fuel className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            7. Histórico de Abastecimentos & Consumo
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500">
                            {abasts.length} abastecimentos
                        </span>
                        {expandedBlocks.abastecimentos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.abastecimentos && (
                    <div className="p-4 md:p-6 space-y-4 border-t border-slate-100 animate-in fade-in duration-200">
                        {/* Resumo de Consumo */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Total Gasto</span>
                                <span className="text-sm md:text-base font-black text-slate-900">
                                    R$ {(costsSummary?.totalFuelCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Total Litros</span>
                                <span className="text-sm md:text-base font-black font-mono text-slate-900">
                                    {(costsSummary?.totalLiters || 0).toFixed(1)} L
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Consumo Médio</span>
                                <span className="text-sm md:text-base font-black text-sky-700">
                                    {costsSummary?.avgConsumptionKml > 0 ? `${costsSummary.avgConsumptionKml} km/L` : 'Em apuração'}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                                <span className="text-[10px] font-black uppercase text-slate-400 block">Abastecimentos</span>
                                <span className="text-sm md:text-base font-black text-slate-900">
                                    {abasts.length} registros
                                </span>
                            </div>
                        </div>

                        {/* Tabela de Abastecimentos */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-black text-[10px]">
                                    <tr>
                                        <th className="p-2.5 rounded-l-xl">Data</th>
                                        <th className="p-2.5">KM Odômetro</th>
                                        <th className="p-2.5">Combustível</th>
                                        <th className="p-2.5">Litros</th>
                                        <th className="p-2.5">Valor</th>
                                        <th className="p-2.5">Posto</th>
                                        <th className="p-2.5 rounded-r-xl">Motorista</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {abasts.map(a => (
                                        <tr key={a.id} className="hover:bg-slate-50/80">
                                            <td className="p-2.5 font-bold">{new Date(a.date).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-2.5 font-mono font-bold text-slate-900">{(a.odometer || 0).toLocaleString('pt-BR')} km</td>
                                            <td className="p-2.5 font-extrabold uppercase text-slate-800">{a.fuelType}</td>
                                            <td className="p-2.5 font-mono">{(a.liters || 0).toFixed(1)} L</td>
                                            <td className="p-2.5 font-mono font-black text-slate-900">R$ {(a.cost || 0).toFixed(2)}</td>
                                            <td className="p-2.5 text-slate-500">{a.station || '-'}</td>
                                            <td className="p-2.5 text-slate-700">{a.driver || '-'}</td>
                                        </tr>
                                    ))}
                                    {abasts.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                                                Nenhum abastecimento registrado para este veículo
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 8: CONSOLIDAÇÃO DE CUSTOS */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('custos')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <DollarSign className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            8. Consolidação Financeira de Custos
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-900">
                            Total: R$ {(costsSummary?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {expandedBlocks.custos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.custos && (
                    <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5 border-t border-slate-100 animate-in fade-in duration-200">
                        <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 space-y-1">
                            <span className="text-[10px] font-black uppercase text-sky-700">Combustível Total</span>
                            <div className="text-xl font-black text-sky-950">
                                R$ {(costsSummary?.totalFuelCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <span className="text-[10px] font-bold text-sky-600">
                                {(costsSummary?.totalLiters || 0).toFixed(0)} litros consumidos
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-100 space-y-1">
                            <span className="text-[10px] font-black uppercase text-orange-700">Manutenção & Peças</span>
                            <div className="text-xl font-black text-orange-950">
                                R$ {(costsSummary?.totalMaintenanceCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <span className="text-[10px] font-bold text-orange-600">
                                {maintenances.length} serviços mecânicos
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-400">Custo Total de Operação</span>
                            <div className="text-xl font-black text-white">
                                R$ {(costsSummary?.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                                Investimento total durante a vida útil
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 9: DOCUMENTOS & ANEXOS */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('documentos')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            9. Documentos, CRLV & Anexos Digitais
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500">
                            {documents.length} documentos
                        </span>
                        {expandedBlocks.documentos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.documentos && (
                    <div className="p-4 md:p-6 space-y-4 border-t border-slate-100 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500">Arquivos armazenados no Supabase Storage</span>
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Anexar Novo Documento</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {documents.map(doc => (
                                <div key={doc.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-purple-600 shrink-0">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-xs font-black text-slate-900 truncate block">
                                                {doc.name}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-semibold block truncate">
                                                {doc.description || (doc.created_at ? new Date(doc.created_at).toLocaleDateString('pt-BR') : 'Documento')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <a
                                            href={doc.file_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-white rounded-lg transition-colors"
                                            title="Visualizar Documento"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteDoc(doc.id, doc.file_url)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {documents.length === 0 && (
                                <div className="col-span-full py-8 text-center text-slate-400 text-xs font-bold">
                                    Nenhum documento anexado ao prontuário deste veículo
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 10: HISTÓRICO DE AGENDAMENTOS */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleBlock('agendamentos')}
                    className="w-full p-4 flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            10. Viagens & Agendamentos
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500">
                            {schedules.length} agendamentos
                        </span>
                        {expandedBlocks.agendamentos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                </button>

                {expandedBlocks.agendamentos && (
                    <div className="p-4 md:p-6 border-t border-slate-100 animate-in fade-in duration-200">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-black text-[10px]">
                                    <tr>
                                        <th className="p-2.5 rounded-l-xl">Protocolo</th>
                                        <th className="p-2.5">Saída</th>
                                        <th className="p-2.5">Retorno</th>
                                        <th className="p-2.5">Destino</th>
                                        <th className="p-2.5">Finalidade</th>
                                        <th className="p-2.5 rounded-r-xl">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {schedules.slice(0, 10).map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50/80">
                                            <td className="p-2.5 font-mono font-black text-slate-900">{s.protocol}</td>
                                            <td className="p-2.5 font-bold">{new Date(s.departureDateTime).toLocaleString('pt-BR')}</td>
                                            <td className="p-2.5">{s.returnDateTime ? new Date(s.returnDateTime).toLocaleString('pt-BR') : '-'}</td>
                                            <td className="p-2.5 font-extrabold text-slate-900">{s.destination}</td>
                                            <td className="p-2.5 text-slate-600 truncate max-w-xs">{s.purpose}</td>
                                            <td className="p-2.5">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                                    s.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' :
                                                    s.status === 'cancelado' ? 'bg-rose-100 text-rose-800' :
                                                    s.status === 'em_curso' ? 'bg-sky-100 text-sky-800' :
                                                    'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {s.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {schedules.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                                                Nenhum agendamento vinculado a este veículo
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DE UPLOAD DE DOCUMENTO */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-5 md:p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                            <h3 className="text-sm font-black text-slate-900 uppercase">
                                Anexar Documento ao Prontuário
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUploadDocument} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                                    Arquivo (PDF, Imagem, CRLV, Nota Fiscal)
                                </label>
                                <input
                                    type="file"
                                    required
                                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs font-bold text-slate-800 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                                    Descrição do Documento
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: CRLV 2026, Laudo de Vistoria, Apólice de Seguro..."
                                    value={docDescription}
                                    onChange={e => setDocDescription(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUploadingDoc || !selectedFile}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase shadow-md flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {isUploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    <span>{isUploadingDoc ? 'Enviando...' : 'Salvar Documento'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
