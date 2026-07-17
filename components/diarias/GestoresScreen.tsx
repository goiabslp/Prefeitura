import React, { useEffect, useState, useMemo } from 'react';
import { 
  ArrowLeft, Users, UserCheck, Shield, Search, 
  Loader2, Check, AlertCircle, RefreshCw 
} from 'lucide-react';
import { Person, User } from '../../types';
import { getDiariasGestores, saveDiariaGestor, getAllDiariaEventos } from '../../services/diariasEventosService';

interface GestoresScreenProps {
  persons: Person[];
  users: User[];
  onBack: () => void;
  currentUser: User | null;
}

export const GestoresScreen: React.FC<GestoresScreenProps> = ({
  persons,
  users,
  onBack,
  currentUser
}) => {
  const [gestoresMap, setGestoresMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingPersonId, setUpdatingPersonId] = useState<string | null>(null);
  const [peopleWithTrips, setPeopleWithTrips] = useState<Set<string>>(new Set());

  // Carregar os gestores cadastrados
  const fetchGestores = async () => {
    setIsLoading(true);
    try {
      // 1. Buscar os gestores cadastrados
      const data = await getDiariasGestores();
      const map: Record<string, string> = {};
      data.forEach(item => {
        map[item.pessoa_id] = item.gestor_id;
      });
      setGestoresMap(map);

      // 2. Buscar eventos e extrair IDs de pessoas
      const eventos = await getAllDiariaEventos();
      const idsSet = new Set<string>();
      eventos.forEach(evt => {
        evt.pessoas.forEach(p => {
          if (p.id) idsSet.add(p.id);
        });
      });
      setPeopleWithTrips(idsSet);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGestores();
  }, []);

  // Lista de possíveis gestores (usuários do sistema)
  const availableGestores = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Filtrar servidores
  const filteredPersons = useMemo(() => {
    const term = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return persons
      .filter(p => {
        if (!peopleWithTrips.has(p.id)) return false;
        
        const nameNormalized = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nameNormalized.includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, searchTerm, peopleWithTrips]);

  // Alterar/Definir o Gestor de uma pessoa
  const handleAssignGestor = async (pessoaId: string, gestorId: string) => {
    if (!gestorId) return; // evitar valor vazio
    setUpdatingPersonId(pessoaId);
    try {
      await saveDiariaGestor(pessoaId, gestorId);
      setGestoresMap(prev => ({
        ...prev,
        [pessoaId]: gestorId
      }));
    } catch (err) {
      alert("Erro ao associar gestor. Tente novamente.");
    } finally {
      setUpdatingPersonId(null);
    }
  };

  return (
    <div className="flex-1 h-full w-full bg-slate-100/50 backdrop-blur-sm font-sans flex items-center justify-center p-4 desktop:p-8 overflow-hidden animate-fade-in">
      <div className="w-full max-w-5xl bg-white rounded-[2.5rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden animate-slide-up flex flex-col h-full max-h-full">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors font-bold uppercase tracking-widest group text-[10px] p-2 hover:bg-slate-50 rounded-lg -ml-2"
                title="Voltar"
              >
                <ArrowLeft className="transition-transform w-3.5 h-3.5" />
              </button>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                  <UserCheck className="w-4 h-4 text-white" />
                </div>
                <span className="truncate uppercase">Configuração de Gestores (Diárias)</span>
              </h2>
            </div>

            <div className="flex-1 max-w-md flex items-center gap-2">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar servidor por nome..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all pl-9 pr-3 py-2 text-xs"
                />
                <Search className="absolute top-1/2 -translate-y-1/2 text-slate-400 left-3 w-3.5 h-3.5" />
              </div>
              <button
                onClick={fetchGestores}
                disabled={isLoading}
                className="p-2 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                title="Atualizar lista"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-white p-6">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-400 font-medium text-sm animate-pulse">Carregando gestores cadastrados...</p>
            </div>
          ) : filteredPersons.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-800">Nenhum servidor encontrado</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Experimente ajustar o termo de pesquisa.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPersons.map(person => {
                const assignedGestorId = gestoresMap[person.id] || '';
                const isUpdating = updatingPersonId === person.id;

                return (
                  <div 
                    key={person.id}
                    className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between gap-3 hover:border-indigo-200 transition-all"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">{person.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        Servidor
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <select
                          value={assignedGestorId}
                          onChange={(e) => handleAssignGestor(person.id, e.target.value)}
                          disabled={isUpdating || currentUser?.role !== 'admin'}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        >
                          <option value="">Indicar Gestor Responsável...</option>
                          {availableGestores.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.role === 'admin' ? 'Administrador' : 'Gestor/Usuário'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {isUpdating ? (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                        </div>
                      ) : assignedGestorId ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600" title="Gestor Definido">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500" title="Aguardando Definição">
                          <Shield className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
