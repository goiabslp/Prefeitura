import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  MapPin, 
  Edit3, 
  Trash2, 
  User, 
  UserPlus, 
  Car, 
  ShieldAlert, 
  HeartPulse, 
  AlertCircle,
  Clock,
  Building2
} from 'lucide-react';
import { CrewMember, Vehicle } from '../../types';
import { maskCpfPartial } from '../../utils/cpfUtils';
import { formatBirthDateComIdade } from '../../utils/ageValidation';

interface TripulacaoTableProps {
  passengers: CrewMember[];
  selectedVehicle?: Vehicle | null;
  tripDate?: string | null | Date;
  onOpenNewPassengerModal: () => void;
  onEditPassenger: (index: number) => void;
  onRemovePassenger: (index: number) => void;
}

export const TripulacaoTable: React.FC<TripulacaoTableProps> = ({
  passengers = [],
  selectedVehicle,
  tripDate,
  onOpenNewPassengerModal,
  onEditPassenger,
  onRemovePassenger
}) => {
  const [filterSearch, setFilterSearch] = useState('');
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  // Filtragem instantânea dos passageiros da viagem
  const filteredPassengers = useMemo(() => {
    if (!filterSearch.trim()) return passengers;
    const q = filterSearch.toLowerCase().trim();
    const cleanDigits = filterSearch.replace(/\D/g, '');

    return passengers.filter(p => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchCpf = cleanDigits && (p.cpf || '').replace(/\D/g, '').includes(cleanDigits);
      const matchProc = (p.procedureName || '').toLowerCase().includes(q);
      return matchName || matchCpf || matchProc;
    });
  }, [passengers, filterSearch]);

  // Cálculos de Indicadores de Ocupação
  const totalPacientes = useMemo(() => {
    return passengers.filter(p => p.type === 'paciente' || (!p.type && !p.companionForPatientId)).length;
  }, [passengers]);

  const totalAcompanhantes = useMemo(() => {
    return passengers.filter(p => p.type === 'acompanhante' || Boolean(p.companionForPatientId)).length;
  }, [passengers]);

  const ocupacaoTotal = passengers.length;

  // Capacidade para passageiros é a capacidade total menos 1 assento do motorista oficial
  const capacidadeMaximaPassageiros = useMemo(() => {
    if (!selectedVehicle) return 15;
    const total = selectedVehicle.passengerCapacity || (selectedVehicle as any).capacity || 5;
    return Math.max(1, total - 1);
  }, [selectedVehicle]);

  const vagasDisponiveis = Math.max(0, capacidadeMaximaPassageiros - ocupacaoTotal);

  // Ação de Exclusão com Validação de Acompanhante Obrigatório
  const handleAttemptRemove = (index: number) => {
    const item = passengers[index];
    if (!item) return;

    // Se estiver tentando excluir um acompanhante vinculado a um menor
    if (item.type === 'acompanhante' || item.companionForPatientId) {
      const menorAcompanhado = passengers.find(
        p => (p.isMinor || p.type === 'paciente') && 
             (p.patientId === item.companionForPatientId || p.id === item.companionForPatientId || p.companionId === item.id)
      );

      if (menorAcompanhado && menorAcompanhado.isMinor) {
        // Verifica se há outro acompanhante vinculado a este menor
        const outrosAcompanhantes = passengers.filter(
          (p, idx) => idx !== index && 
                     (p.type === 'acompanhante') && 
                     (p.companionForPatientId === menorAcompanhado.patientId || p.companionForPatientId === menorAcompanhado.id)
        );

        if (outrosAcompanhantes.length === 0) {
          setDeleteWarning(
            `Este acompanhante é obrigatório, pois está vinculado ao paciente menor de 18 anos "${menorAcompanhado.name}". Cadastre outro acompanhante antes de removê-lo.`
          );
          setTimeout(() => setDeleteWarning(null), 6000);
          return;
        }
      }
    }

    onRemovePassenger(index);
  };

  return (
    <div className="w-full space-y-4">
      
      {/* Alerta de Validação de Acompanhante Obrigatório */}
      {deleteWarning && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{deleteWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteWarning(null)}
            className="text-rose-500 hover:text-rose-700 font-black px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARRA SUPERIOR: TÍTULO, PESQUISA E BOTÃO + NOVO PASSAGEIRO */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        
        {/* Título com Ícone */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-tight">
            Passageiros / Tripulação
          </h3>
        </div>

        {/* Campo de Pesquisa Instantânea e Botão Novo Passageiro na mesma linha */}
        <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Pesquisar passageiro por nome ou CPF..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400"
            />
            {filterSearch && (
              <button
                type="button"
                onClick={() => setFilterSearch('')}
                className="w-4 h-4 rounded-full text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botão Roxo: + Novo Passageiro */}
          <button
            type="button"
            onClick={onOpenNewPassengerModal}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-500/25 flex items-center gap-2 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Novo Passageiro</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABELA DE PASSAGEIROS (100% DA LARGURA DISPONÍVEL) */}
      {/* ========================================================================= */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            
            {/* Header da Tabela */}
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5 w-12 text-center">#</th>
                <th className="py-3 px-4 min-w-[220px]">Passageiro</th>
                <th className="py-3 px-4 w-36">CPF</th>
                <th className="py-3 px-4 w-36">Embarque</th>
                <th className="py-3 px-4 min-w-[180px]">Compromisso</th>
                <th className="py-3 px-4 w-24 text-center">Acomp.</th>
                <th className="py-3 px-4 w-24 text-center">Ações</th>
              </tr>
            </thead>

            {/* Corpo da Tabela */}
            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
              {filteredPassengers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="space-y-2">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-black uppercase tracking-wider text-slate-600">
                        Nenhum passageiro adicionado à viagem
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        Clique no botão <strong>+ Novo Passageiro</strong> acima para pesquisar e vincular pacientes da base compartilhada.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPassengers.map((p, idx) => {
                  const originalIndex = passengers.findIndex(
                    item => item === p || (item.patientId && item.patientId === p.patientId) || item.name === p.name
                  );

                  const isAcompanhante = p.type === 'acompanhante' || Boolean(p.companionForPatientId);
                  const isMenor = Boolean(p.isMinor);

                  return (
                    <tr 
                      key={p.id || idx}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 1. Numeração */}
                      <td className="py-3.5 px-3.5 text-center font-bold text-slate-400">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-mono text-[11px] font-black inline-flex items-center justify-center">
                          {idx + 1}
                        </span>
                      </td>

                      {/* 2. Passageiro (Nome + Subtítulo com Nascimento/Idade + Menor de Idade) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isAcompanhante 
                              ? 'bg-purple-50 text-purple-600' 
                              : isMenor 
                              ? 'bg-amber-50 text-amber-600' 
                              : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {isAcompanhante ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-900 uppercase text-xs sm:text-sm">
                                {p.name}
                              </span>

                              {isMenor && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[9px] font-black uppercase tracking-wider border border-amber-200">
                                  Menor de Idade
                                </span>
                              )}

                              {isAcompanhante && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[9px] font-black uppercase tracking-wider border border-purple-200">
                                  Acompanhante
                                </span>
                              )}
                            </div>

                            {/* Data de Nascimento e Idade na Data da Viagem */}
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                              Nasc.: {formatBirthDateComIdade(p.birthDate, tripDate)}
                            </p>

                            {/* Se for menor de idade, exibe o acompanhante responsável */}
                            {isMenor && p.companionName && (
                              <p className="text-[10px] font-extrabold text-amber-800 flex items-center gap-1 mt-0.5">
                                <span>Acompanhante:</span>
                                <strong className="uppercase">{p.companionName}</strong>
                              </p>
                            )}

                            {/* Se for acompanhante, exibe a quem acompanha */}
                            {isAcompanhante && p.companionForPatientName && (
                              <p className="text-[10px] font-extrabold text-purple-800 flex items-center gap-1 mt-0.5">
                                <span>Acompanhando:</span>
                                <strong className="uppercase">{p.companionForPatientName}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. CPF */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700 font-bold whitespace-nowrap">
                        {p.cpf ? maskCpfPartial(p.cpf) : <span className="text-slate-400 italic font-sans text-[11px]">Não inf.</span>}
                      </td>

                      {/* 4. Local de Embarque */}
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">
                          <MapPin className="w-3 h-3 text-indigo-500" />
                          <span>{p.departureLocation || 'Sede'}</span>
                        </span>
                      </td>

                      {/* 5. Procedimento / Compromisso */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-bold">
                          {p.procedureName || p.appointmentLocation || 'Consulta / Exame'}
                        </span>
                        {p.appointmentTime && (
                          <span className="text-[10px] text-slate-400 font-mono ml-2">
                            ({p.appointmentTime})
                          </span>
                        )}
                      </td>

                      {/* 6. Acompanhante Vinculado */}
                      <td className="py-3.5 px-4 text-center">
                        {p.companionId || p.needsCompanion ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black uppercase">
                            Sim (1)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">
                            Não
                          </span>
                        )}
                      </td>

                      {/* 7. Ações */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditPassenger(originalIndex >= 0 ? originalIndex : idx)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar dados deste passageiro"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttemptRemove(originalIndex >= 0 ? originalIndex : idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover passageiro da viagem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 CARDS DE INDICADORES DE OCUPAÇÃO NO RODAPÉ */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        
        {/* 1. Total de Passageiros */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Total de Passageiros
            </span>
            <span className="text-lg font-black text-slate-900 leading-tight">
              {totalPacientes}
            </span>
          </div>
        </div>

        {/* 2. Acompanhantes */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Acompanhantes
            </span>
            <span className="text-lg font-black text-slate-900 leading-tight">
              {totalAcompanhantes}
            </span>
          </div>
        </div>

        {/* 3. Ocupação da Viagem */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Ocupação da Viagem
            </span>
            <span className="text-lg font-black text-slate-900 leading-tight">
              {ocupacaoTotal} {ocupacaoTotal === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </div>
        </div>

        {/* 4. Vagas Disponíveis */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Vagas Disponíveis
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500 text-white font-black text-xs font-mono">
                {vagasDisponiveis}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold truncate">
                de {capacidadeMaximaPassageiros} assentos
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
