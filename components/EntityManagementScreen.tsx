
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Person, Sector, Job } from '../types';
import {
  Plus, Search, Edit2, Trash2, Save, X,
  User as UserIcon, Network, Briefcase, CheckCircle2, Trash, AlertTriangle, Info, ArrowLeft,
  Calendar, Hash, Users, Sparkles, Building2
} from 'lucide-react';

interface EntityManagementScreenProps {
  persons: Person[];
  sectors: Sector[];
  jobs: Job[];
  onAddPerson: (p: Person) => void;
  onUpdatePerson: (p: Person) => void;
  onDeletePerson: (id: string) => void;
  onAddSector: (s: Sector) => void;
  onUpdateSector: (s: Sector) => void;
  onDeleteSector: (id: string) => void;
  onAddJob: (j: Job) => void;
  onUpdateJob: (j: Job) => void;
  onDeleteJob: (id: string) => void;
  onBack?: () => void;
}

export const EntityManagementScreen: React.FC<EntityManagementScreenProps> = ({
  persons, sectors, jobs,
  onAddPerson, onUpdatePerson, onDeletePerson,
  onAddSector, onUpdateSector, onDeleteSector,
  onAddJob, onUpdateJob, onDeleteJob,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'persons' | 'sectors' | 'jobs'>('persons');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Modais customizados
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' }>({
    isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'warning'
  });

  const [formData, setFormData] = useState({
    name: '',
    jobId: '',
    sectorId: '',
    birthDate: '',
    driverCode: ''
  });

  // Alternar abas com atualização de URL
  const handleTabChange = (tab: 'persons' | 'sectors' | 'jobs') => {
    setActiveTab(tab);
    setSearchTerm('');
    if (tab === 'persons') window.history.pushState({}, '', '/Admin/Entidades/Pessoas');
    else if (tab === 'sectors') window.history.pushState({}, '', '/Admin/Entidades/Setores');
    else if (tab === 'jobs') window.history.pushState({}, '', '/Admin/Entidades/Cargos');
  };

  // Detecção de Rota Inicial
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/setores') || path.includes('/setor')) {
      setActiveTab('sectors');
    } else if (path.includes('/cargos') || path.includes('/cargo')) {
      setActiveTab('jobs');
    } else if (path.includes('/pessoas') || path.includes('/pessoa')) {
      setActiveTab('persons');
    }
  }, []);

  // Sincronização com botões de navegação (Voltar / Avançar)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/setores') || path.includes('/setor')) {
        setActiveTab('sectors');
      } else if (path.includes('/cargos') || path.includes('/cargo')) {
        setActiveTab('jobs');
      } else if (path.includes('/pessoas') || path.includes('/pessoa')) {
        setActiveTab('persons');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        jobId: item.jobId || '',
        sectorId: item.sectorId || '',
        birthDate: item.birth_date || '',
        driverCode: item.driver_code?.toString() || ''
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', jobId: '', sectorId: '', birthDate: '', driverCode: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      return;
    }

    const commonData = {
      id: editingItem ? editingItem.id : Date.now().toString(),
      name: formData.name
    };

    if (activeTab === 'persons') {
      const person: Person = {
        ...commonData,
        jobId: formData.jobId,
        sectorId: formData.sectorId,
        birth_date: formData.birthDate || undefined,
        driver_code: formData.driverCode ? parseInt(formData.driverCode) : undefined
      };
      editingItem ? onUpdatePerson(person) : onAddPerson(person);
    } else if (activeTab === 'sectors') {
      const sector: Sector = { ...commonData };
      editingItem ? onUpdateSector(sector) : onAddSector(sector);
    } else {
      const job: Job = { ...commonData };
      editingItem ? onUpdateJob(job) : onAddJob(job);
    }

    setIsModalOpen(false);
  };

  const filteredItems = () => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
      if (activeTab === 'persons') return persons;
      if (activeTab === 'sectors') return sectors;
      return jobs;
    }

    if (activeTab === 'persons') {
      return persons.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(term);
        const jobMatch = jobs.find(j => j.id === p.jobId)?.name.toLowerCase().includes(term);
        const sectorMatch = sectors.find(s => s.id === p.sectorId)?.name.toLowerCase().includes(term);
        const driverMatch = p.driver_code?.toString().includes(term);
        return nameMatch || jobMatch || sectorMatch || driverMatch;
      });
    }

    if (activeTab === 'sectors') return sectors.filter(s => s.name.toLowerCase().includes(term));
    return jobs.filter(j => j.name.toLowerCase().includes(term));
  };

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1";
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="flex-1 h-full bg-slate-100 p-3.5 md:p-6 overflow-auto custom-scrollbar animate-fade-in">
      <div className="w-full space-y-3.5 md:space-y-6 max-w-7xl mx-auto">

        {/* Header Desktop (hidden no mobile) */}
        <div className="hidden md:flex flex-row items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-all"
                  title="Voltar"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
              )}
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Base Organizacional</h2>
            </div>
            <p className="text-slate-500 mt-1">Gerencie pessoas, setores e cargos independentemente.</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="px-5 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg hover:shadow-orange-500/30 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Adicionar {activeTab === 'persons' ? 'Pessoa' : activeTab === 'sectors' ? 'Setor' : 'Cargo'}
          </button>
        </div>

        {/* Header Mobile (visível apenas no mobile) */}
        <div className="flex md:hidden flex-col bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs gap-3">
          <div className="flex items-center justify-between gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 -ml-1 text-slate-500 hover:text-orange-600 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-200/80 flex items-center justify-center transition-all active:scale-95 shrink-0"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0 shadow-xs">
                {activeTab === 'persons' ? <UserIcon className="w-4 h-4" /> : activeTab === 'sectors' ? <Network className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-slate-900 tracking-tight leading-none uppercase truncate">
                  Base Organizacional
                </h2>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate mt-0.5">
                  Pessoas, Setores e Cargos
                </span>
              </div>
            </div>

            <button
              onClick={() => handleOpenModal()}
              className="px-3 py-2 bg-gradient-to-r from-orange-600 to-orange-700 active:scale-95 text-white font-black rounded-xl shadow-md shadow-orange-600/20 flex items-center gap-1.5 uppercase text-[10px] tracking-wider shrink-0 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo</span>
            </button>
          </div>
        </div>

        {/* Tabs Desktop (hidden no mobile) */}
        <div className="hidden md:flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
          <button
            onClick={() => handleTabChange('persons')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'persons' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <UserIcon className="w-4 h-4" /> Pessoas ({persons.length})
          </button>
          <button
            onClick={() => handleTabChange('sectors')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'sectors' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Network className="w-4 h-4" /> Setores ({sectors.length})
          </button>
          <button
            onClick={() => handleTabChange('jobs')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'jobs' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Briefcase className="w-4 h-4" /> Cargos ({jobs.length})
          </button>
        </div>

        {/* Tabs Mobile (visível apenas no mobile) */}
        <div className="flex md:hidden grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => handleTabChange('persons')}
            className={`flex-1 py-2 px-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 ${activeTab === 'persons' ? 'bg-orange-600 text-white shadow-sm' : 'bg-white/80 text-slate-600 hover:bg-white'}`}
          >
            <UserIcon className="w-3 h-3" />
            <span>Pessoas</span>
            <span className="opacity-75 text-[9px]">({persons.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('sectors')}
            className={`flex-1 py-2 px-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 ${activeTab === 'sectors' ? 'bg-orange-600 text-white shadow-sm' : 'bg-white/80 text-slate-600 hover:bg-white'}`}
          >
            <Network className="w-3 h-3" />
            <span>Setores</span>
            <span className="opacity-75 text-[9px]">({sectors.length})</span>
          </button>
          <button
            onClick={() => handleTabChange('jobs')}
            className={`flex-1 py-2 px-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 ${activeTab === 'jobs' ? 'bg-orange-600 text-white shadow-sm' : 'bg-white/80 text-slate-600 hover:bg-white'}`}
          >
            <Briefcase className="w-3 h-3" />
            <span>Cargos</span>
            <span className="opacity-75 text-[9px]">({jobs.length})</span>
          </button>
        </div>

        {/* Busca Desktop (hidden no mobile) */}
        <div className="hidden md:flex bg-white p-4 rounded-2xl border border-slate-200 shadow-sm items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={`Buscar em ${activeTab === 'persons' ? 'pessoas por nome, cargo ou setor' : activeTab === 'sectors' ? 'setores' : 'cargos'}...`}
            className="flex-1 bg-transparent outline-none text-slate-700 font-medium placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Busca Mobile (visível apenas no mobile) */}
        <div className="flex md:hidden relative group w-full">
          <input
            type="text"
            placeholder={`Buscar em ${activeTab === 'persons' ? 'pessoas, cargo ou setor' : activeTab === 'sectors' ? 'setores' : 'cargos'}...`}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Listagem Desktop (hidden no mobile) */}
        <div className="hidden md:grid gap-4">
          {filteredItems().map((item: any) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50 text-orange-600 shadow-sm">
                  {activeTab === 'persons' ? <UserIcon className="w-6 h-6" /> : activeTab === 'sectors' ? <Network className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{item.name}</h3>
                  {activeTab === 'persons' && (
                    <div className="flex gap-3 text-xs text-slate-500 mt-1 font-medium">
                      <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" /> {jobs.find(j => j.id === item.jobId)?.name || 'Sem Cargo'}
                      </span>
                      <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1">
                        <Network className="w-3 h-3" /> {sectors.find(s => s.id === item.sectorId)?.name || 'Sem Setor'}
                      </span>
                      {item.birth_date && (
                        <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Nasc: {formatDate(item.birth_date)}
                        </span>
                      )}
                      {item.driver_code && (
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                          <Hash className="w-3 h-3" /> Cód: {item.driver_code}
                        </span>
                      )}
                    </div>
                  )}
                  {activeTab === 'sectors' && (
                    <div className="text-xs text-slate-400 mt-0.5 font-medium">
                      {persons.filter(p => p.sectorId === item.id).length} pessoa(s) vinculada(s)
                    </div>
                  )}
                  {activeTab === 'jobs' && (
                    <div className="text-xs text-slate-400 mt-0.5 font-medium">
                      {persons.filter(p => p.jobId === item.id).length} pessoa(s) com este cargo
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => handleOpenModal(item)} className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button
                  onClick={() => setConfirmModal({
                    isOpen: true,
                    title: "Remover Item",
                    message: `Deseja realmente excluir "${item.name}"? Esta ação afetará documentos que utilizam esta referência.`,
                    type: 'danger',
                    onConfirm: () => {
                      if (activeTab === 'persons') onDeletePerson(item.id);
                      else if (activeTab === 'sectors') onDeleteSector(item.id);
                      else onDeleteJob(item.id);
                      setConfirmModal({ ...confirmModal, isOpen: false });
                    }
                  })}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredItems().length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
              <X className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-lg font-bold text-slate-500">Nenhum registro encontrado</p>
              <p className="text-sm text-slate-400 mt-1">Comece adicionando novos itens clicando no botão acima.</p>
            </div>
          )}
        </div>

        {/* Listagem Mobile Cards (visível apenas no mobile) */}
        <div className="flex md:hidden flex-col gap-2.5">
          {filteredItems().map((item: any) => {
            const jobName = jobs.find(j => j.id === item.jobId)?.name || 'Sem Cargo';
            const sectorName = sectors.find(s => s.id === item.sectorId)?.name || 'Sem Setor';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col transition-all"
              >
                {/* Linha Principal do Card Mobile */}
                <div className="p-3.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-50 text-orange-600 border border-orange-100/80 shadow-xs shrink-0 mt-0.5">
                      {activeTab === 'persons' ? <UserIcon className="w-4 h-4" /> : activeTab === 'sectors' ? <Network className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-black text-slate-900 leading-snug uppercase tracking-tight">
                        {item.name}
                      </h3>

                      {/* Informações adicionais de Setor/Cargo no Mobile */}
                      {activeTab === 'sectors' && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          {persons.filter(p => p.sectorId === item.id).length} pessoa(s) vinculada(s)
                        </p>
                      )}

                      {activeTab === 'jobs' && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          {persons.filter(p => p.jobId === item.id).length} pessoa(s) com este cargo
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas no Topo */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-1.5 text-slate-400 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 border border-slate-200/80 rounded-lg transition-all active:scale-90"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmModal({
                        isOpen: true,
                        title: "Remover Item",
                        message: `Deseja realmente excluir "${item.name}"? Esta ação afetará documentos que utilizam esta referência.`,
                        type: 'danger',
                        onConfirm: () => {
                          if (activeTab === 'persons') onDeletePerson(item.id);
                          else if (activeTab === 'sectors') onDeleteSector(item.id);
                          else onDeleteJob(item.id);
                          setConfirmModal({ ...confirmModal, isOpen: false });
                        }
                      })}
                      className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200/80 rounded-lg transition-all active:scale-90"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tags e Detalhes da Pessoa no Mobile */}
                {activeTab === 'persons' && (
                  <div className="px-3.5 pb-3 pt-0 flex flex-wrap gap-1.5 border-t border-slate-50 mt-1 pt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200/80 text-slate-700 text-[10px] font-bold rounded-lg truncate max-w-full">
                      <Briefcase className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span className="truncate">{jobName}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200/80 text-slate-700 text-[10px] font-bold rounded-lg truncate max-w-full">
                      <Network className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span className="truncate">{sectorName}</span>
                    </span>

                    {item.birth_date && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200/80 text-[10px] font-black rounded-lg">
                        <Calendar className="w-2.5 h-2.5 text-orange-500 shrink-0" />
                        <span>Nasc: {formatDate(item.birth_date)}</span>
                      </span>
                    )}

                    {item.driver_code && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-black rounded-lg">
                        <Hash className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                        <span>Cód: {item.driver_code}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredItems().length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-4">
              <X className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-600 uppercase">Nenhum registro encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "+ Novo" no topo para cadastrar.</p>
            </div>
          )}
        </div>

        {/* MODAL DE ADICIONAR / EDITAR */}
        {isModalOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 md:p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-3xl md:rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col animate-slide-up border border-white/20">
              <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    {activeTab === 'persons' ? <UserIcon className="w-4 h-4" /> : activeTab === 'sectors' ? <Network className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                  </div>
                  <h3 className="text-base md:text-xl font-black text-slate-800 uppercase tracking-tight">
                    {editingItem ? 'Editar' : 'Adicionar'} {activeTab === 'persons' ? 'Pessoa' : activeTab === 'sectors' ? 'Setor' : 'Cargo'}
                  </h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-5 md:p-8 space-y-4 md:space-y-6 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className={labelClass}>Nome Completo / Título</label>
                  <input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass}
                    placeholder="Digite o nome..."
                    autoFocus
                  />
                </div>

                {activeTab === 'persons' && (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className={labelClass}>Cargo</label>
                      <select
                        value={formData.jobId}
                        onChange={e => setFormData({ ...formData, jobId: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Selecione um Cargo</option>
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Setor</label>
                      <select
                        value={formData.sectorId}
                        onChange={e => setFormData({ ...formData, sectorId: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Selecione um Setor</option>
                        {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Data de Nascimento</label>
                      <input
                        type="date"
                        value={formData.birthDate}
                        onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Código do Motorista / CNH</label>
                      <input
                        type="number"
                        value={formData.driverCode}
                        onChange={e => setFormData({ ...formData, driverCode: e.target.value })}
                        className={inputClass}
                        placeholder="Ex: 1234..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5 shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-bold text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button onClick={handleSave} className="px-6 py-2.5 bg-orange-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-orange-700 shadow-md flex items-center gap-2 transition-all active:scale-95"><Save className="w-4 h-4" /> Salvar</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* MODAL DE CONFIRMAÇÃO PERSONALIZADO */}
        {confirmModal.isOpen && createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3.5 md:p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20">
              <div className="p-6 md:p-8 text-center">
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-xl ${confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-600 shadow-rose-500/10' :
                  'bg-indigo-50 text-indigo-600 shadow-indigo-500/10'
                  }`}>
                  {confirmModal.type === 'danger' ? <Trash className="w-8 h-8 md:w-10 md:h-10" /> : <Info className="w-8 h-8 md:w-10 md:h-10" />}
                </div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">{confirmModal.title}</h3>
                <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed px-2">{confirmModal.message}</p>
              </div>
              <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-2.5">
                <button
                  onClick={confirmModal.onConfirm}
                  className={`w-full py-3.5 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl transition-all active:scale-[0.98] ${confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' :
                    'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                    }`}
                >
                  Confirmar Ação
                </button>
                <button
                  onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                  className="w-full py-3 bg-white text-slate-400 font-black text-xs uppercase tracking-[0.2em] rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-slate-600 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};
