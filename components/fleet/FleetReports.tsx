import React, { useState, useMemo, useRef } from 'react';
import { 
    Vehicle, 
    Sector 
} from '../../types';
import { 
    FleetMaintenance, 
    FleetPart, 
    FleetPurchase, 
    FleetSupplier, 
    VehicleHealthInfo 
} from '../../types/fleetTypes';
import { 
    FileText, 
    Download, 
    Printer, 
    Filter, 
    Calendar, 
    Car, 
    Wrench, 
    Fuel, 
    DollarSign, 
    Loader2, 
    Layers, 
    CheckCircle2, 
    AlertTriangle 
} from 'lucide-react';
import { AbastecimentoRecord } from '../../services/abastecimentoService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface FleetReportsProps {
    vehicles: Vehicle[];
    maintenances: FleetMaintenance[];
    abastecimentos: AbastecimentoRecord[];
    parts: FleetPart[];
    suppliers: FleetSupplier[];
    healthList: VehicleHealthInfo[];
    sectors: Sector[];
}

export const FleetReports: React.FC<FleetReportsProps> = ({
    vehicles,
    maintenances,
    abastecimentos,
    parts,
    suppliers,
    healthList,
    sectors
}) => {
    const [reportType, setReportType] = useState<string>('geral');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('todos');
    const [selectedCategory, setSelectedCategory] = useState<string>('todos');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const reportRef = useRef<HTMLDivElement>(null);

    // Map O(1) de Veículos e Setores
    const vehicleMap = useMemo(() => {
        const map = new Map<string, Vehicle>();
        vehicles.forEach(v => map.set(v.id, v));
        return map;
    }, [vehicles]);

    const sectorMap = useMemo(() => {
        const map = new Map<string, string>();
        sectors.forEach(s => map.set(s.id, s.name));
        return map;
    }, [sectors]);

    // Filtragem de Dados do Relatório
    const reportData = useMemo(() => {
        let vList = [...vehicles];
        if (selectedVehicleId !== 'todos') vList = vList.filter(v => v.id === selectedVehicleId);
        if (selectedCategory !== 'todos') vList = vList.filter(v => (v.vehicleCategory || v.type) === selectedCategory);

        let mList = [...maintenances];
        if (selectedVehicleId !== 'todos') mList = mList.filter(m => m.vehicle_id === selectedVehicleId);
        if (startDate) mList = mList.filter(m => m.maintenance_date >= startDate);
        if (endDate) mList = mList.filter(m => m.maintenance_date <= endDate);

        let aList = [...abastecimentos];
        if (selectedVehicleId !== 'todos') {
            const v = vehicleMap.get(selectedVehicleId);
            if (v) {
                aList = aList.filter(a => a.vehicle.toLowerCase().includes(v.plate.toLowerCase()) || a.vehicle.toLowerCase().includes(v.model.toLowerCase()));
            }
        }
        if (startDate) aList = aList.filter(a => a.date >= startDate);
        if (endDate) aList = aList.filter(a => a.date <= endDate);

        return {
            vehicles: vList,
            maintenances: mList,
            abastecimentos: aList
        };
    }, [vehicles, maintenances, abastecimentos, selectedVehicleId, selectedCategory, startDate, endDate, vehicleMap]);

    const handleDownloadPdf = async () => {
        if (!reportRef.current) return;
        setIsGeneratingPdf(true);

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Relatorio-Frota-${reportType.toUpperCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            alert('Não foi possível gerar o PDF no momento.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Header & Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm">
                <div>
                    <h2 className="text-base md:text-xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent uppercase tracking-tight">
                        Central de Relatórios Gerenciais da Frota
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Emissão, consolidação de dados reais e exportação em PDF oficial
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="px-4 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                >
                    {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Exportar Relatório PDF'}</span>
                </button>
            </div>

            {/* Painel de Configuração do Relatório */}
            <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Configuração dos Filtros do Relatório:</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {/* Tipo de Relatório */}
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Tipo de Relatório</label>
                        <select
                            value={reportType}
                            onChange={e => setReportType(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        >
                            <option value="geral">Inventário Geral da Frota</option>
                            <option value="saude">Saúde & Manutenções Vencidas</option>
                            <option value="manutencoes">Histórico de Manutenções & Peças</option>
                            <option value="abastecimentos">Consumo & Abastecimentos</option>
                            <option value="custos">Consolidação Financeira</option>
                        </select>
                    </div>

                    {/* Veículo */}
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Veículo</label>
                        <select
                            value={selectedVehicleId}
                            onChange={e => setSelectedVehicleId(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        >
                            <option value="todos">Toda a Frota</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                            ))}
                        </select>
                    </div>

                    {/* Categoria */}
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Categoria</label>
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        >
                            <option value="todos">Todas as Categorias</option>
                            <option value="Carro">Carros</option>
                            <option value="Moto">Motos</option>
                            <option value="Van">Vans</option>
                            <option value="Ônibus">Ônibus</option>
                            <option value="Máquina Pesada">Máquinas Pesadas</option>
                            <option value="Caminhão">Caminhões</option>
                            <option value="Acessórios">Acessórios</option>
                        </select>
                    </div>

                    {/* Data Inicial */}
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Data Início</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        />
                    </div>

                    {/* Data Final */}
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Data Fim</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                        />
                    </div>
                </div>
            </div>

            {/* ÁREA DE VISUALIZAÇÃO PRÉVIA / TEMPLATE DO PDF */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg p-6 md:p-8 space-y-6" ref={reportRef}>
                {/* Cabeçalho Oficial da Prefeitura */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-base md:text-lg font-black uppercase tracking-wider text-slate-900">
                            PREFEITURA MUNICIPAL DE SÃO JOSÉ DO GOIABAL
                        </h1>
                        <h2 className="text-xs font-bold text-slate-600 uppercase">
                            DEPARTAMENTO DE GESTÃO DA FROTA MUNICIPAL & TRANSPORTE
                        </h2>
                        <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                            Relatório emitido em: {new Date().toLocaleString('pt-BR')}
                        </span>
                    </div>

                    <div className="text-right">
                        <span className="px-3 py-1 bg-slate-900 text-white font-black text-xs uppercase rounded-lg">
                            {reportType === 'geral' ? 'INVENTÁRIO GERAL' :
                             reportType === 'saude' ? 'SAÚDE DA FROTA' :
                             reportType === 'manutencoes' ? 'MANUTENÇÕES & PEÇAS' :
                             reportType === 'abastecimentos' ? 'ABASTECIMENTOS' : 'CUSTOS CONSOLIDADOS'}
                        </span>
                    </div>
                </div>

                {/* Conteúdo Dinâmico Baseado no Tipo */}
                {reportType === 'geral' && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                            Relação de Veículos da Frota ({reportData.vehicles.length} veículos)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                                    <tr>
                                        <th className="p-2">Placa</th>
                                        <th className="p-2">Marca / Modelo</th>
                                        <th className="p-2">Categoria</th>
                                        <th className="p-2">Setor</th>
                                        <th className="p-2">KM Atual</th>
                                        <th className="p-2">Situação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {reportData.vehicles.map(v => (
                                        <tr key={v.id}>
                                            <td className="p-2 font-mono font-black">{v.plate}</td>
                                            <td className="p-2 font-bold uppercase">{v.brand} {v.model}</td>
                                            <td className="p-2">{v.vehicleCategory || v.type || 'Carro'}</td>
                                            <td className="p-2 font-semibold">{sectorMap.get(v.sectorId) || '-'}</td>
                                            <td className="p-2 font-mono font-bold">{(Number(v.currentKm) || 0).toLocaleString('pt-BR')} km</td>
                                            <td className="p-2 uppercase font-black text-[10px]">{v.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {reportType === 'saude' && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                            Diagnóstico de Saúde e Alertas Mecânicos
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                                    <tr>
                                        <th className="p-2">Placa</th>
                                        <th className="p-2">Modelo</th>
                                        <th className="p-2">KM Atual</th>
                                        <th className="p-2">Troca de Óleo</th>
                                        <th className="p-2">Correia Dentada</th>
                                        <th className="p-2">Status Geral</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {healthList.map(h => {
                                        const v = vehicleMap.get(h.vehicleId);
                                        if (!v) return null;
                                        return (
                                            <tr key={h.vehicleId}>
                                                <td className="p-2 font-mono font-black">{v.plate}</td>
                                                <td className="p-2 font-bold uppercase">{v.model}</td>
                                                <td className="p-2 font-mono">{(Number(v.currentKm) || 0).toLocaleString('pt-BR')} km</td>
                                                <td className="p-2 font-bold uppercase text-[10px]">{h.oilStatus}</td>
                                                <td className="p-2 font-bold uppercase text-[10px]">{h.timingBeltStatus}</td>
                                                <td className="p-2 font-black uppercase text-[10px]">
                                                    {h.generalStatus === 'vencido' ? '🔴 Vencido' : h.generalStatus === 'proximo' ? '🟡 Próximo' : '🟢 Em Dia'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {reportType === 'manutencoes' && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                            Ordens de Manutenção Realizadas ({reportData.maintenances.length})
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                                    <tr>
                                        <th className="p-2">Data</th>
                                        <th className="p-2">Veículo</th>
                                        <th className="p-2">Tipo</th>
                                        <th className="p-2">Descrição</th>
                                        <th className="p-2">Oficina</th>
                                        <th className="p-2">Valor Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {reportData.maintenances.map(m => {
                                        const v = vehicleMap.get(m.vehicle_id);
                                        return (
                                            <tr key={m.id}>
                                                <td className="p-2 font-bold">{new Date(m.maintenance_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                                <td className="p-2 font-mono font-black">{v?.plate || m.vehicle_id.substring(0, 8)}</td>
                                                <td className="p-2 font-black text-[10px] uppercase">{m.type}</td>
                                                <td className="p-2">{m.description}</td>
                                                <td className="p-2 font-semibold text-slate-600">{m.workshop_name || m.supplier_name || '-'}</td>
                                                <td className="p-2 font-mono font-black">R$ {m.total_cost.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {reportType === 'abastecimentos' && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                            Consumo e Abastecimentos ({reportData.abastecimentos.length})
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                                    <tr>
                                        <th className="p-2">Data</th>
                                        <th className="p-2">Veículo</th>
                                        <th className="p-2">Odômetro</th>
                                        <th className="p-2">Combustível</th>
                                        <th className="p-2">Litros</th>
                                        <th className="p-2">Valor Total</th>
                                        <th className="p-2">Motorista</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {reportData.abastecimentos.map(a => (
                                        <tr key={a.id}>
                                            <td className="p-2 font-bold">{new Date(a.date).toLocaleDateString('pt-BR')}</td>
                                            <td className="p-2 font-mono font-bold uppercase">{a.vehicle}</td>
                                            <td className="p-2 font-mono">{(a.odometer || 0).toLocaleString('pt-BR')} km</td>
                                            <td className="p-2 font-black uppercase text-[10px]">{a.fuelType}</td>
                                            <td className="p-2 font-mono">{(a.liters || 0).toFixed(1)} L</td>
                                            <td className="p-2 font-mono font-black">R$ {(a.cost || 0).toFixed(2)}</td>
                                            <td className="p-2">{a.driver || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Rodapé de Assinatura */}
                <div className="pt-12 mt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
                    <div>
                        <div className="w-48 border-t border-slate-900 mx-auto mb-1"></div>
                        <span className="font-black uppercase text-slate-800">Responsável pelo Setor de Frotas</span>
                    </div>
                    <div>
                        <div className="w-48 border-t border-slate-900 mx-auto mb-1"></div>
                        <span className="font-black uppercase text-slate-800">Secretaria Municipal de Administração</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
