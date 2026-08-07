
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Vehicle, VehicleType, Sector, VehicleStatus, MaintenanceStatus, Person, Job, VehicleBrand, VehicleDocument } from '../types';
import { fleetService } from '../services/fleetService';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import {
  Plus, Search, Edit2, Trash2, Save, X,
  Car, Truck, Wrench, CheckCircle2, Trash, Info,
  MapPin, Hash, Palette, Calendar, Layers, Network, ChevronDown, Check,
  PenTool, Upload, FileText, Eye, Download, FileCheck, Camera, Image as ImageIcon,
  ArrowLeft, Fuel, Gauge, ShieldCheck, Activity, AlertTriangle, Hammer, ClipboardCheck,
  ShieldAlert, User, Briefcase, Tag, Flame, Droplets
} from 'lucide-react';

interface FleetManagementScreenProps {
  vehicles: Vehicle[];
  sectors: Sector[];
  persons: Person[];
  jobs: Job[];
  brands: VehicleBrand[];
  onAddVehicle: (v: Vehicle) => void;
  onUpdateVehicle: (v: Vehicle) => void;
  onDeleteVehicle: (id: string) => void;
  onAddBrand: (b: VehicleBrand) => void;
  onBack: () => void;
  onFetchDetails?: (id: string) => Promise<Vehicle | null>;
}

const Gavel = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14.5 12.5-8 8a2.11 2.11 0 1 1-3-3l8-8" /><path d="m16 16 2 2" /><path d="m19 13 2 2" /><path d="m5 5 2 2" /><path d="m2 8 2 2" /><path d="m15 7 3 3-4 4-3-3z" /></svg>
);

const FileSearch = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3" /><path d="M14 2v6h6" /><circle cx="5" cy="12" r="3" /><path d="m9 16-1.5-1.5" /></svg>
);

const STATUS_OPTIONS: { value: VehicleStatus, label: string, color: string, icon: any }[] = [
  { value: 'operacional', label: 'Operacional', color: 'emerald', icon: CheckCircle2 },
  { value: 'manutencao', label: 'Em Manutenção', color: 'amber', icon: Hammer },
  { value: 'vistoria', label: 'Em Vistoria', color: 'blue', icon: FileSearch },
  { value: 'documentacao', label: 'Aguardando Documentação', color: 'slate', icon: FileText },
  { value: 'nao_liberado', label: 'Não Liberado', color: 'rose', icon: ShieldAlert },
  { value: 'leilao', label: 'Em Leilão', color: 'indigo', icon: Gavel },
  { value: 'leiloado', label: 'Leiloado', color: 'purple', icon: ClipboardCheck },
  { value: 'batido', label: 'Batido', color: 'red', icon: AlertTriangle },
];

const MAINTENANCE_OPTIONS: { value: MaintenanceStatus, label: string, color: string }[] = [
  { value: 'em_dia', label: 'Em Dia', color: 'emerald' },
  { value: 'andamento', label: 'Em andamento', color: 'amber' },
  { value: 'vencido', label: 'Vencido', color: 'rose' },
];

const FUEL_OPTIONS = ['ALCOOL', 'GASOLINA', 'DIESEL'] as const;

export const FleetManagementScreen: React.FC<FleetManagementScreenProps> = ({
  vehicles, sectors, persons, jobs, brands, onAddVehicle, onUpdateVehicle, onDeleteVehicle, onAddBrand, onBack, onFetchDetails
}) => {
  const { moduleStatus } = useSystemSettings();
  const isDashboardActive = moduleStatus['parent_frotas_dashboard'] !== false;
  const isLeveActive = moduleStatus['parent_frotas_leve'] !== false;
  const isPesadoActive = moduleStatus['parent_frotas_pesado'] !== false;
  const isAcessorioActive = moduleStatus['parent_frotas_acessorio'] !== false;

  const availableTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity, active: isDashboardActive },
    { id: 'leve', label: 'Leves', icon: Car, active: isLeveActive },
    { id: 'pesado', label: 'Pesados', icon: Truck, active: isPesadoActive },
    { id: 'acessorio', label: 'Acessórios', icon: Wrench, active: isAcessorioActive },
  ].filter(t => t.active);

  const defaultTab = isDashboardActive 
    ? 'dashboard' 
    : (isLeveActive ? 'leve' : (isPesadoActive ? 'pesado' : (isAcessorioActive ? 'acessorio' : 'dashboard')));

  const [activeTab, setActiveTab] = useState<VehicleType | 'dashboard'>(defaultTab);

  useEffect(() => {
    if (activeTab === 'dashboard' && !isDashboardActive) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'leve' && !isLeveActive) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'pesado' && !isPesadoActive) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'acessorio' && !isAcessorioActive) {
      setActiveTab(defaultTab);
    }
  }, [isDashboardActive, isLeveActive, isPesadoActive, isAcessorioActive, defaultTab, activeTab]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [viewingVehicleStatus, setViewingVehicleStatus] = useState<Vehicle | null>(null);
  const [viewingDocumentUrl, setViewingDocumentUrl] = useState<{ url: string, name: string, type: 'doc' | 'photo' } | null>(null);
  const [vehicleDocuments, setVehicleDocuments] = useState<VehicleDocument[]>([]);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [newDocumentDescription, setNewDocumentDescription] = useState('');
  const [newDocumentFile, setNewDocumentFile] = useState<File | null>(null);

  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
  const [isRequestManagerModalOpen, setIsRequestManagerModalOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isMaintDropdownOpen, setIsMaintDropdownOpen] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isOilBaseDropdownOpen, setIsOilBaseDropdownOpen] = useState(false);
  const [isTimingBeltBaseDropdownOpen, setIsTimingBeltBaseDropdownOpen] = useState(false);

  const [sectorSearch, setSectorSearch] = useState('');
  const [responsibleSearch, setResponsibleSearch] = useState('');
  const [requestManagerSearch, setRequestManagerSearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');

  const [newBrandName, setNewBrandName] = useState('');
  const [maxKmlInput, setMaxKmlInput] = useState('');
  const [minKmlInput, setMinKmlInput] = useState('');

  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const maintDropdownRef = useRef<HTMLDivElement>(null);
  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const oilBaseDropdownRef = useRef<HTMLDivElement>(null);
  const timingBeltBaseDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'destructive' | 'positive';
    confirmLabel?: string;
    cancelLabel?: string;
  }>({
    isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'destructive'
  });

  const [formData, setFormData] = useState<Partial<Vehicle>>({
    model: '',
    plate: '',
    brand: '',
    year: '',
    color: '',
    renavam: '',
    chassis: '',
    sectorId: '',
    responsiblePersonId: '',
    documentUrl: '',
    documentName: '',
    vehicleImageUrl: '',
    status: 'operacional',
    maintenanceStatus: 'em_dia',
    fuelTypes: [],
    requestManagerIds: [],
    maxKml: undefined,
    minKml: undefined,
    currentKm: undefined,
    oilLastChange: undefined,
    oilNextChange: undefined,
    oilCalculationBase: 5000
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) setIsStatusDropdownOpen(false);
      if (maintDropdownRef.current && !maintDropdownRef.current.contains(target)) setIsMaintDropdownOpen(false);
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(target)) setIsBrandDropdownOpen(false);
      if (oilBaseDropdownRef.current && !oilBaseDropdownRef.current.contains(target)) setIsOilBaseDropdownOpen(false);
      if (timingBeltBaseDropdownRef.current && !timingBeltBaseDropdownRef.current.contains(target)) setIsTimingBeltBaseDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenModal = async (v?: Vehicle) => {
    if (v) {
      if (v.id && (!v.documentUrl || !v.vehicleImageUrl) && isModalOpen === false) {
        // Lazy load if missing details
        if (onBack && typeof onBack === 'function') { // Check props existence (dummy check)
        }
      }

      // Check if we need to fetch details
      let fullVehicle = v;
      if (onFetchDetails && (!v.documentUrl || !v.vehicleImageUrl)) {
        // Show loading or something?
        // For now, let's just await. Ideally we'd have a loading state.
        const fetched = await onFetchDetails(v.id);
        if (fetched) fullVehicle = fetched;
      }

      setEditingVehicle(fullVehicle);
      setFormData({
        ...fullVehicle,
        fuelTypes: fullVehicle.fuelTypes || [],
        requestManagerIds: fullVehicle.requestManagerIds || [],
        maxKml: fullVehicle.maxKml,
        minKml: fullVehicle.minKml
      });
      setMaxKmlInput(fullVehicle.maxKml ? fullVehicle.maxKml.toString().replace('.', ',') : '');
      setMinKmlInput(fullVehicle.minKml ? fullVehicle.minKml.toString().replace('.', ',') : '');
    } else {
      setEditingVehicle(null);
      setFormData({
        type: activeTab === 'dashboard' ? 'leve' : activeTab,
        model: '',
        plate: '',
        brand: '',
        year: '',
        color: '',
        renavam: '',
        chassis: '',
        sectorId: '',
        responsiblePersonId: '',
        documentUrl: '',
        documentName: '',
        vehicleImageUrl: '',
        status: 'operacional',
        maintenanceStatus: 'em_dia',
        fuelTypes: [],
        requestManagerIds: [],
        maxKml: undefined,
        minKml: undefined,
        currentKm: undefined,
        oilLastChange: undefined,
        oilNextChange: undefined,
        oilCalculationBase: 5000
      });
      setMaxKmlInput('');
      setMinKmlInput('');
    }
    setSectorSearch('');
    setResponsibleSearch('');
    setRequestManagerSearch('');
    setBrandSearch('');

    setIsStatusDropdownOpen(false);
    setIsMaintDropdownOpen(false);
    setIsBrandDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          documentUrl: reader.result as string,
          documentName: file.name
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          vehicleImageUrl: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
    setFormData(prev => ({
      ...prev,
      vehicleImageUrl: ''
    }));
  };

  const handleSaveBrand = () => {
    if (!newBrandName.trim()) return;
    const brand: VehicleBrand = {
      id: `br-${Date.now()}-${Math.random()}`,
      name: newBrandName.trim().toUpperCase(),
      category: activeTab === 'dashboard' ? 'leve' : activeTab as VehicleType
    };
    onAddBrand(brand);
    setNewBrandName('');
    setIsBrandModalOpen(false);
  };

  const toggleFuel = (fuel: string) => {
    setFormData(prev => {
      const current = prev.fuelTypes || [];
      if (current.includes(fuel)) {
        return { ...prev, fuelTypes: current.filter(f => f !== fuel) };
      } else {
        return { ...prev, fuelTypes: [...current, fuel] };
      }
    });
  };

  const toggleRequestManager = (personId: string) => {
    setFormData(prev => {
      const current = prev.requestManagerIds || [];
      if (current.includes(personId)) {
        return { ...prev, requestManagerIds: current.filter(id => id !== personId) };
      } else {
        return { ...prev, requestManagerIds: [...current, personId] };
      }
    });
  };

  const handleSave = () => {
    if (!formData.model || !formData.plate || !formData.sectorId) {
      alert("Por favor, preencha o modelo, a placa e o setor do veículo.");
      return;
    }

    const vehicleData = {
      ...formData,
      id: editingVehicle ? editingVehicle.id : Date.now().toString(),
      type: formData.type || (activeTab === 'dashboard' ? 'leve' : activeTab)
    } as Vehicle;

    editingVehicle ? onUpdateVehicle(vehicleData) : onAddVehicle(vehicleData);
    setIsModalOpen(false);
  };

  const filteredVehicles = vehicles.filter(v =>
    v.type === activeTab && (
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.brand.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const filteredSectors = useMemo(() => {
    return sectors
      .filter(s => s.name.toLowerCase().includes(sectorSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sectors, sectorSearch]);

  const filteredPersons = useMemo(() => {
    return persons
      .filter(p => p.name.toLowerCase().includes(responsibleSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, responsibleSearch]);

  const filteredRequestManagers = useMemo(() => {
    return persons
      .filter(p => p.name.toLowerCase().includes(requestManagerSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, requestManagerSearch]);

  const filteredBrands = useMemo(() => {
    const category = activeTab === 'dashboard' ? 'leve' : activeTab;
    return brands
      .filter(b => b.category === category && b.name.toLowerCase().includes(brandSearch.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [brands, activeTab, brandSearch]);

  const oilStats = useMemo(() => {
    let inDay = 0;
    let near = 0;
    let expired = 0;

    vehicles.forEach(v => {
      // Calculate Oil Status
      const oilRemaining = (v.oilNextChange && v.currentKm) ? (v.oilNextChange - v.currentKm) : null;
      let oilStatus: 'inDay' | 'near' | 'expired' = 'inDay';
      if (oilRemaining !== null) {
        if (oilRemaining <= 0) oilStatus = 'expired';
        else if (oilRemaining <= 1000) oilStatus = 'near';
      }

      // Calculate Belt Status
      const beltRemaining = (v.timingBeltNextChange && v.currentKm) ? (v.timingBeltNextChange - v.currentKm) : null;
      let beltStatus: 'inDay' | 'near' | 'expired' = 'inDay';
      if (beltRemaining !== null) {
        if (beltRemaining <= 0) beltStatus = 'expired';
        else if (beltRemaining <= 1000) beltStatus = 'near';
      }

      // Determine Vehicle Overall Status (Worst Case)
      if (oilStatus === 'expired' || beltStatus === 'expired') {
        expired++;
      } else if (oilStatus === 'near' || beltStatus === 'near') {
        near++;
      } else {
        inDay++;
      }
    });

    return { inDay, near, expired };
  }, [vehicles]);

  const selectedSectorName = sectors.find(s => s.id === formData.sectorId)?.name || 'Selecione o Setor';
  const selectedResponsibleName = persons.find(p => p.id === formData.responsiblePersonId)?.name || 'Selecione o Responsável';
  const selectedManagersNames = (formData.requestManagerIds || [])
    .map(id => persons.find(p => p.id === id)?.name)
    .filter(Boolean)
    .join(', ') || 'Nenhum gestor selecionado';

  const inputClass = "w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm font-bold placeholder:text-slate-400 placeholder:font-normal";
  const labelClass = "block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-1";

  const getStatusConfig = (status: VehicleStatus) => {
    return STATUS_OPTIONS.find(opt => opt.value === status) || STATUS_OPTIONS[0];
  };

  const getMaintConfig = (maint: MaintenanceStatus) => {
    return MAINTENANCE_OPTIONS.find(opt => opt.value === maint) || MAINTENANCE_OPTIONS[0];
  };

  const handleDocumentUpload = async () => {
    if (!editingVehicle?.id || !newDocumentFile || !newDocumentDescription) return;

    setIsUploadingDocument(true);
    try {
      await fleetService.uploadVehicleDocument(editingVehicle.id, newDocumentFile, newDocumentDescription);
      const docs = await fleetService.getVehicleDocuments(editingVehicle.id);
      setVehicleDocuments(docs);
      setNewDocumentFile(null);
      setNewDocumentDescription('');
      if (documentInputRef.current) documentInputRef.current.value = '';
      alert('Documento anexado com sucesso!');
    } catch (error) {
      console.error("Erro ao anexar documento:", error);
      alert('Erro ao anexar documento.');
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleDocumentDelete = async (doc: VehicleDocument) => {
    if (!confirm(`Deseja realmente excluir o documento "${doc.name}"?`)) return;

    try {
      await fleetService.deleteVehicleDocument(doc.id, doc.file_url);
      if (editingVehicle?.id) {
        const docs = await fleetService.getVehicleDocuments(editingVehicle.id);
        setVehicleDocuments(docs);
      }
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      alert('Erro ao excluir documento.');
    }
  };

  return (
    <>
      <div className="flex-1 bg-slate-50 font-sans flex flex-col overflow-hidden animate-fade-in">
        {/* Header Full-Width */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm relative z-20">
          <div className="flex items-center gap-6">
            <button
              onClick={onBack}
              className="group flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold transition-all"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs uppercase tracking-widest">Módulos</span>
            </button>

            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Truck className="w-6 h-6 text-indigo-600" />
                Gestão de Frotas
              </h2>
              <p className="text-xs text-slate-500 font-medium">Controle patrimonial de veículos e equipamentos municipais.</p>
            </div>
          </div>

          {availableTabs.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenModal()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]"
              >
                <Plus className="w-4 h-4" />
                Novo Registro
              </button>
            </div>
          )}
        </div>

        {/* Área de Filtros e Categorias */}
        <div className="bg-white/50 backdrop-blur-md px-6 py-4 border-b border-slate-200 shrink-0 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit gap-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: Activity, active: isDashboardActive },
                { id: 'leve', label: 'Leves', icon: Car, active: isLeveActive },
                { id: 'pesado', label: 'Pesados', icon: Truck, active: isPesadoActive },
                { id: 'acessorio', label: 'Acessórios', icon: Wrench, active: isAcessorioActive },
              ].filter(tab => tab.active).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="flex items-center gap-2 animate-fade-in pl-4 border-l border-slate-200 ml-4">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{oilStats.inDay} EM DIA</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{oilStats.near} PRÓXIMO</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-xl border border-rose-200">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{oilStats.expired} VENCIDO</span>
                </div>

              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-96 group">
              <input
                type="text"
                placeholder="Placa, Modelo ou Marca..."
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-slate-50">
          <div className="max-w-[1920px] mx-auto">
            {availableTabs.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200/80 max-w-4xl mx-auto shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                  <Truck className="w-10 h-10 text-slate-300 animate-pulse" />
                </div>
                <h3 className="font-black text-xl text-slate-800 uppercase tracking-tight">Gestão de Frotas</h3>
                <p className="text-xs text-slate-500 mt-2 max-w-sm">Todas as funcionalidades do módulo de Gestão de Frotas foram desativadas temporariamente pelo administrador.</p>
              </div>
            ) : activeTab === 'dashboard' ? (
              <div className="animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {vehicles
                    .filter(v => v.model.toLowerCase().includes(searchTerm.toLowerCase()) || v.plate.toLowerCase().includes(searchTerm.toLowerCase()))
                    .sort((a, b) => {
                      const getDiff = (v: Vehicle) => {
                        const oilDiff = (v.oilNextChange && v.currentKm) ? (v.oilNextChange - v.currentKm) : 1000000;
                        const beltDiff = (v.timingBeltNextChange && v.currentKm) ? (v.timingBeltNextChange - v.currentKm) : 1000000;
                        return Math.min(oilDiff, beltDiff);
                      };
                      return getDiff(a) - getDiff(b);
                    })
                    .map(v => {
                      const oilRemaining = (v.oilNextChange && v.currentKm) ? (v.oilNextChange - v.currentKm) : null;
                      const beltRemaining = (v.timingBeltNextChange && v.currentKm) ? (v.timingBeltNextChange - v.currentKm) : null;

                      // Determine worst status
                      const getStatus = (remaining: number | null) => {
                        if (remaining === null) return 'slate';
                        if (remaining <= 0) return 'rose';
                        if (remaining <= 1000) return 'amber'; // Stricter for dashboard visual
                        return 'emerald';
                      };

                      const oilStatus = getStatus(oilRemaining);
                      const beltStatus = getStatus(beltRemaining);

                      // Overall card color based on worst status
                      let alertColor = 'emerald';
                      if (oilStatus === 'slate' && beltStatus === 'slate') alertColor = 'slate';
                      else if (oilStatus === 'rose' || beltStatus === 'rose') alertColor = 'rose';
                      else if (oilStatus === 'amber' || beltStatus === 'amber') alertColor = 'amber';

                      // Progress for visual bar (taking the one closest to expiry)
                      const getProgress = (remaining: number | null, base: number = 5000) => {
                        if (remaining === null) return 0;
                        return Math.max(0, Math.min(100, (remaining / base) * 100)); // This logic is inverted visually usually? remaining/base * 100 decreases as we drive. 
                        // Actually let's just show a simple bar for the worst one.
                      };

                      // Better visualization: Two mini bars or just the most critical one text?
                      // Let's list both in the card body.

                      return (
                        <div key={v.id}
                          onClick={() => setViewingVehicleStatus(v)}
                          className={`group relative bg-white rounded-3xl border-2 border-${alertColor}-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer`}
                        >
                          <div className={`p-4 flex items-center justify-between border-b border-${alertColor}-100 bg-${alertColor}-50/30`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl bg-${alertColor}-100 text-${alertColor}-600 flex items-center justify-center shadow-inner shrink-0 leading-none`}>
                                <Car className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate leading-tight">{v.model}</h3>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">{v.plate}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenModal(v); }}
                              className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="p-4 flex-1 flex flex-col gap-3">
                            {/* KM Atual */}
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest pb-2 border-b border-slate-50">
                              <span className="text-slate-400">KM Atual</span>
                              <span className="text-slate-900">{v.currentKm?.toLocaleString('pt-BR') || '---'}</span>
                            </div>

                            {/* Oil Status */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
                                <span className="text-slate-400 flex items-center gap-1"><Droplets className="w-3 h-3" /> Óleo</span>
                                <span className={`text-${oilStatus === 'slate' ? 'slate-300' : oilStatus + '-600'}`}>
                                  {oilRemaining !== null ? (oilRemaining <= 0 ? 'Vencido' : `${oilRemaining} km`) : 'N/A'}
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full bg-${oilStatus}-500 transition-all`} style={{ width: `${oilRemaining !== null ? Math.max(0, Math.min(100, (oilRemaining / (v.oilCalculationBase || 5000)) * 100)) : 0}%` }} />
                              </div>
                            </div>

                            {/* Timing Belt Status */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
                                <span className="text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3" /> Correia</span>
                                <span className={`text-${beltStatus === 'slate' ? 'slate-300' : beltStatus + '-600'}`}>
                                  {beltRemaining !== null ? (beltRemaining <= 0 ? 'Vencido' : `${beltRemaining} km`) : 'N/A'}
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full bg-${beltStatus}-500 transition-all`} style={{ width: `${beltRemaining !== null ? Math.max(0, Math.min(100, (beltRemaining / (v.timingBeltCalculationBase || 50000)) * 100)) : 0}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {filteredVehicles.map(v => {
                  const statusCfg = getStatusConfig(v.status || 'operacional');
                  const responsibleName = persons.find(p => p.id === v.responsiblePersonId)?.name || 'Responsável não definido';
                  return (
                    <div key={v.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all flex flex-col group overflow-hidden animate-fade-in">
                      <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                        {v.vehicleImageUrl ? (
                          <img src={v.vehicleImageUrl} alt={v.model} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                            {v.type === 'leve' ? <Car className="w-16 h-16 mb-2" /> : v.type === 'pesado' ? <Truck className="w-16 h-16 mb-2" /> : <Wrench className="w-16 h-16 mb-2" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">Sem Foto</span>
                          </div>
                        )}

                        <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border backdrop-blur-md bg-white/90 text-${statusCfg.color}-700 border-${statusCfg.color}-200 shadow-lg`}>
                          <statusCfg.icon className="w-3 h-3" />
                          {statusCfg.label}
                        </div>

                        <div className="absolute top-4 right-4 flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(v)}
                            className="p-2.5 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-indigo-600 rounded-xl shadow-lg transition-all active:scale-90"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>

                        {v.documentUrl && (
                          <button
                            onClick={() => setViewingDocumentUrl({ url: v.documentUrl!, name: v.documentName || 'documento', type: 'doc' })}
                            className="absolute bottom-4 right-4 p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg transition-all active:scale-90 hover:bg-emerald-500"
                            title="Ver Documento"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}

                        {v.vehicleImageUrl && (
                          <button
                            onClick={() => setViewingDocumentUrl({ url: v.vehicleImageUrl!, name: v.model, type: 'photo' })}
                            className="absolute bottom-4 left-4 p-2.5 bg-indigo-600/90 backdrop-blur-sm text-white rounded-xl shadow-lg transition-all active:scale-90 hover:bg-indigo-500"
                            title="Ampliar Foto"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="p-6 flex flex-col gap-4">
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-slate-900 leading-tight uppercase tracking-tight truncate">{v.model}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="bg-slate-900 text-white font-mono text-[9px] px-2 py-0.5 rounded border border-white/10 shadow-sm tracking-[0.15em] shrink-0">{v.plate}</span>
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest truncate">{v.brand} • {v.year}</span>
                          </div>
                          {v.fuelTypes && v.fuelTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {v.fuelTypes.map(f => (
                                <span key={f} className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase tracking-tighter">{f}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-50 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                              <Network className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider leading-tight">
                              {sectors.find(s => s.id === v.sectorId)?.name || 'Sem Setor'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-tight truncate">
                              {responsibleName}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => setConfirmModal({
                            isOpen: true,
                            title: "Remover Registro",
                            message: `Deseja realmente excluir o veículo ${v.model} (${v.plate})?`,
                            type: 'destructive',
                            confirmLabel: 'Sim, Remover Registro',
                            onConfirm: () => { onDeleteVehicle(v.id); setConfirmModal({ ...confirmModal, isOpen: false }); }
                          })}
                          className="mt-2 w-full py-2 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" /> Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredVehicles.length === 0 && (
              <div className="py-32 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-200">
                  <Truck className="w-10 h-10" />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 tracking-tight uppercase">Nenhum registro localizado</p>
                  <p className="text-sm text-slate-400 font-medium">Refine sua busca ou adicione um novo item.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODAL DE CADASTRO/EDIÇÃO */}
        {
          isModalOpen && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-fade-in">
              <div className="bg-white rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-6xl overflow-hidden flex flex-col animate-slide-up max-h-[95vh] border border-white/20">

                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20 rotate-[-4deg]">
                      {activeTab === 'leve' ? <Car className="w-5 h-5" /> : activeTab === 'pesado' ? <Truck className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
                        {editingVehicle ? 'Perfil do Veículo' : 'Cadastro de Veículo'}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em] mt-1 flex items-center gap-2">
                        <Activity className="w-3 h-3 text-indigo-500" /> Detalhamento Técnico
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-all active:scale-90 border border-slate-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
                  <div className="grid grid-cols-1 lg:grid-cols-12 h-full">

                    <div className="lg:col-span-5 p-6 border-r border-slate-100 bg-white flex flex-col gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className={labelClass}><Camera className="w-3.5 h-3.5 inline mr-2" /> Fotografia do Veículo</label>
                          {formData.vehicleImageUrl && (
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-all active:scale-95 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200"
                              title="Excluir Fotografia"
                            >
                              <Trash2 className="w-3 h-3" /> Excluir Foto
                            </button>
                          )}
                        </div>
                        <div
                          onClick={() => photoInputRef.current?.click()}
                          className={`relative aspect-[4/3] rounded-[2rem] border-4 border-dashed transition-all cursor-pointer group flex flex-col items-center justify-center overflow-hidden shadow-inner
                              ${formData.vehicleImageUrl ? 'border-indigo-600 bg-indigo-50/5' : 'border-slate-100 bg-slate-50 hover:border-indigo-400 hover:bg-white'}
                            `}
                        >
                          <input type="file" ref={photoInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                          {formData.vehicleImageUrl ? (
                            <>
                              <img src={formData.vehicleImageUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm p-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      photoInputRef.current?.click();
                                    }}
                                    className="text-white text-xs font-black uppercase tracking-[0.15em] bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 transition-all active:scale-95 border border-indigo-400/30"
                                  >
                                    <Upload className="w-4 h-4" /> Alterar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleRemovePhoto}
                                    className="text-white text-xs font-black uppercase tracking-[0.15em] bg-rose-600 hover:bg-rose-500 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 transition-all active:scale-95 border border-rose-400/30"
                                  >
                                    <Trash2 className="w-4 h-4" /> Excluir
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="absolute top-3 right-3 p-2.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl shadow-xl backdrop-blur-md transition-all active:scale-90 z-10 border border-rose-400/40"
                                title="Excluir Foto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-4 text-slate-300 group-hover:text-indigo-400 transition-all">
                              <div className="p-8 bg-white rounded-[2rem] shadow-xl group-hover:shadow-indigo-500/10 border border-slate-100 transition-all group-hover:scale-110"><ImageIcon className="w-12 h-12" /></div>
                              <div className="text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Carregar Imagem</p>
                                <p className="text-[9px] font-bold mt-1 opacity-50">Resolução recomendada: 1200x900px</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 space-y-6">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5" /> Indicadores Operacionais
                        </h4>

                        <div className="space-y-4">
                          <div className="relative" ref={statusDropdownRef}>
                            <label className={labelClass}>Status de Disponibilidade</label>
                            <button
                              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                              className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm hover:border-indigo-400 transition-all group/sel"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg bg-${getStatusConfig(formData.status || 'operacional').color}-600 text-white shadow-md`}>
                                  {React.createElement(getStatusConfig(formData.status || 'operacional').icon, { className: "w-3.5 h-3.5" })}
                                </div>
                                <span className="text-xs font-bold text-slate-900">{getStatusConfig(formData.status || 'operacional').label}</span>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isStatusDropdownOpen && (
                              <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden animate-slide-up py-2 max-h-72 overflow-y-auto custom-scrollbar">
                                {STATUS_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => {
                                      setFormData({ ...formData, status: opt.value });
                                      setIsStatusDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group ${formData.status === opt.value ? 'bg-indigo-50/50' : ''}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg bg-${opt.color}-100 text-${opt.color}-600 group-hover:bg-${opt.color}-600 group-hover:text-white transition-all`}>
                                        <opt.icon className="w-4 h-4" />
                                      </div>
                                      <span className={`text-xs font-bold ${formData.status === opt.value ? 'text-indigo-900' : 'text-slate-700'}`}>{opt.label}</span>
                                    </div>
                                    {formData.status === opt.value && <Check className="w-4 h-4 text-indigo-600" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="relative" ref={maintDropdownRef}>
                            <label className={labelClass}>Condição de Manutenção</label>
                            <button
                              onClick={() => setIsMaintDropdownOpen(!isMaintDropdownOpen)}
                              className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm hover:border-indigo-400 transition-all group/sel"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg bg-${getMaintConfig(formData.maintenanceStatus || 'em_dia').color}-600 text-white shadow-md`}>
                                  <Gauge className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-bold text-slate-900">{getMaintConfig(formData.maintenanceStatus || 'em_dia').label}</span>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isMaintDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isMaintDropdownOpen && (
                              <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden animate-slide-up py-2">
                                {MAINTENANCE_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => {
                                      setFormData({ ...formData, maintenanceStatus: opt.value });
                                      setIsMaintDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group ${formData.maintenanceStatus === opt.value ? 'bg-indigo-50/50' : ''}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg bg-${opt.color}-100 text-${opt.color}-600 group-hover:bg-${opt.color}-600 group-hover:text-white transition-all`}>
                                        <Gauge className="w-4 h-4" />
                                      </div>
                                      <span className={`text-xs font-bold ${formData.maintenanceStatus === opt.value ? 'text-indigo-900' : 'text-slate-700'}`}>{opt.label}</span>
                                    </div>
                                    {formData.maintenanceStatus === opt.value && <Check className="w-4 h-4 text-indigo-600" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-7 p-8 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div className="md:col-span-2">
                          <label className={labelClass}><Layers className="w-4 h-4 inline mr-2 text-indigo-500" /> Identificação do Modelo</label>
                          <input value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value.toUpperCase() })} className={inputClass} placeholder="Ex: CRONOS" />
                        </div>

                        <div>
                          <label className={labelClass}><Hash className="w-4 h-4 inline mr-2 text-indigo-500" /> Placa de Identificação</label>
                          <input value={formData.plate} onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })} className={`${inputClass} font-mono uppercase tracking-[0.1em]`} placeholder="ABC-1234" />
                        </div>

                        <div className="relative" ref={brandDropdownRef}>
                          <label className={labelClass}><Tag className="w-4 h-4 inline mr-2 text-indigo-500" /> Marca / Fabricante</label>
                          <div
                            onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                            className={`${inputClass} flex items-center justify-between cursor-pointer group/select h-auto ${isBrandDropdownOpen ? 'border-indigo-500 ring-4 ring-indigo-500/5 bg-white' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl transition-colors shrink-0 ${formData.brand ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                <Tag className="w-4 h-4" />
                              </div>
                              <span className={`${formData.brand ? 'text-slate-900 font-bold' : 'text-slate-400'} leading-tight text-left`}>
                                {formData.brand || 'Selecione a Marca'}
                              </span>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0 ${isBrandDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>

                          {isBrandDropdownOpen && (
                            <div className="absolute z-50 left-0 right-0 mt-3 bg-white border border-slate-200 rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden animate-slide-up flex flex-col border-indigo-100">
                              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                                <Search className="w-4 h-4 text-indigo-400" />
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Pesquisar fabricante..."
                                  className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full"
                                  value={brandSearch}
                                  onChange={(e) => setBrandSearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setIsBrandModalOpen(true); setIsBrandDropdownOpen(false); }}
                                  className="w-full mb-2 p-3 bg-indigo-50 text-indigo-700 font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 border border-indigo-100"
                                >
                                  <Plus className="w-3 h-3" /> Nova Marca
                                </button>
                                {filteredBrands.length > 0 ? (
                                  filteredBrands.map((brand) => (
                                    <button
                                      key={brand.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFormData({ ...formData, brand: brand.name });
                                        setIsBrandDropdownOpen(false);
                                        setBrandSearch('');
                                      }}
                                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group/item ${formData.brand === brand.name ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                    >
                                      <span className="text-sm font-bold text-left">{brand.name}</span>
                                      {formData.brand === brand.name && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                                    </button>
                                  ))
                                ) : (
                                  <div className="p-8 text-center">
                                    <Tag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-xs text-slate-400 font-medium">Nenhuma marca localizada.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className={labelClass}><Calendar className="w-4 h-4 inline mr-2 text-indigo-500" /> Ano Fabricação/Modelo</label>
                          <input value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} className={inputClass} placeholder="2023/2024" />
                        </div>

                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className={labelClass}><Gauge className="w-4 h-4 inline mr-2 text-indigo-500" /> KM/L Mínimo (Referência)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={minKmlInput}
                              onChange={e => {
                                const val = e.target.value;
                                if (/^[\d.,]*$/.test(val)) {
                                  setMinKmlInput(val);
                                  const numVal = parseFloat(val.replace(',', '.'));
                                  setFormData({ ...formData, minKml: isNaN(numVal) ? undefined : numVal });
                                }
                              }}
                              className={inputClass}
                              placeholder="Ex: 8,0"
                            />
                          </div>
                          <div className="flex-1">
                            <label className={labelClass}><Gauge className="w-4 h-4 inline mr-2 text-indigo-500" /> KM/L Máximo (Teto)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={maxKmlInput}
                              onChange={e => {
                                const val = e.target.value;
                                if (/^[\d.,]*$/.test(val)) {
                                  setMaxKmlInput(val);
                                  const numVal = parseFloat(val.replace(',', '.'));
                                  setFormData({ ...formData, maxKml: isNaN(numVal) ? undefined : numVal });
                                }
                              }}
                              className={inputClass}
                              placeholder="Ex: 12,5"
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}><Palette className="w-4 h-4 inline mr-2 text-indigo-500" /> Cor Predominante</label>
                          <input value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value.toUpperCase() })} className={inputClass} placeholder="Ex: BRANCA" />
                        </div>

                        <div>
                          <label className={labelClass}><Car className="w-4 h-4 inline mr-2 text-indigo-500" /> Tipo de Veículo</label>
                          <div className="relative">
                            <select
                              value={formData.vehicleCategory || ''}
                              onChange={e => setFormData({ ...formData, vehicleCategory: e.target.value as any })}
                              className={`${inputClass} appearance-none pr-10`}
                            >
                              <option value="">Selecione...</option>
                              <option value="Carro">Carro</option>
                              <option value="Moto">Moto</option>
                              <option value="Van">Van</option>
                              <option value="Ônibus">Ônibus</option>
                              <option value="Máquina Pesada">Máquina Pesada</option>
                              <option value="Caminhão">Caminhão</option>
                              <option value="Acessórios">Acessórios</option>
                            </select>
                            <ChevronDown className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}><Calendar className="w-4 h-4 inline mr-2 text-indigo-500" /> Disponível para Agendamento?</label>
                          <div className="relative">
                            <select
                              value={formData.availableForScheduling || 'Não'}
                              onChange={e => setFormData({ ...formData, availableForScheduling: e.target.value as any })}
                              className={`${inputClass} appearance-none pr-10`}
                            >
                              <option value="Sim">Sim</option>
                              <option value="Não">Não</option>
                            </select>
                            <ChevronDown className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </div>

                        {/* CAMPO DE COMBUSTÍVEL - MULTISELEÇÃO MODERNA */}
                        <div className="md:col-span-2">
                          <label className={labelClass}><Flame className="w-4 h-4 inline mr-2 text-indigo-500" /> Combustível (Multiseleção)</label>
                          <div className="flex flex-wrap gap-2 p-4 bg-slate-50/50 border border-slate-200 rounded-[2rem]">
                            {FUEL_OPTIONS.map(fuel => {
                              const isSelected = formData.fuelTypes?.includes(fuel);
                              return (
                                <button
                                  key={fuel}
                                  type="button"
                                  onClick={() => toggleFuel(fuel)}
                                  className={`px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2 active:scale-95
                                      ${isSelected
                                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                      : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-600'}
                                    `}
                                >
                                  {isSelected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5 opacity-40" />}
                                  {fuel}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className={labelClass}><Network className="w-4 h-4 inline mr-2 text-indigo-500" /> Setor de Lotação / Atribuição</label>
                          <button
                            onClick={() => setIsSectorModalOpen(true)}
                            className={`${inputClass} flex items-center justify-between cursor-pointer group/select h-auto w-full`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl transition-colors shrink-0 ${formData.sectorId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                <Network className="w-4 h-4" />
                              </div>
                              <span className={`${formData.sectorId ? 'text-slate-900 font-bold' : 'text-slate-400'} leading-tight text-left`}>
                                {selectedSectorName}
                              </span>
                            </div>
                            <Search className="w-5 h-5 text-slate-400" />
                          </button>
                        </div>

                        <div className="md:col-span-2">
                          <label className={labelClass}><User className="w-4 h-4 inline mr-2 text-indigo-500" /> Responsável pelo Veículo (Condutor)</label>
                          <button
                            onClick={() => setIsResponsibleModalOpen(true)}
                            className={`${inputClass} flex items-center justify-between cursor-pointer group/select h-auto w-full`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl transition-colors shrink-0 ${formData.responsiblePersonId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                <User className="w-4 h-4" />
                              </div>
                              <span className={`${formData.responsiblePersonId ? 'text-slate-900 font-bold' : 'text-slate-400'} leading-tight text-left`}>
                                {selectedResponsibleName}
                              </span>
                            </div>
                            <Search className="w-5 h-5 text-slate-400" />
                          </button>
                        </div>

                        <div className="md:col-span-2">
                          <label className={labelClass}><ShieldCheck className="w-4 h-4 inline mr-2 text-indigo-500" /> Gestor de Solicitações (Pode aprovar saídas)</label>
                          <button
                            onClick={() => setIsRequestManagerModalOpen(true)}
                            className={`${inputClass} flex items-center justify-between cursor-pointer group/select h-auto w-full group/mgr`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`p-2 rounded-xl transition-colors shrink-0 ${formData.requestManagerIds?.length ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                <ShieldCheck className="w-4 h-4" />
                              </div>
                              <span className={`${formData.requestManagerIds?.length ? 'text-slate-900 font-bold' : 'text-slate-400'} leading-tight text-left truncate`}>
                                {selectedManagersNames}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {formData.requestManagerIds?.length ? (
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-lg whitespace-nowrap">{formData.requestManagerIds.length} selecionados</span>
                              ) : null}
                              <Plus className="w-5 h-5 text-slate-400 group-hover/mgr:text-indigo-600 transition-colors" />
                            </div>
                          </button>
                        </div>

                        <div className="md:col-span-2 bg-indigo-50/30 border border-indigo-100 rounded-[2rem] p-6 space-y-6">
                          <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                            <PenTool className="w-3.5 h-3.5" /> Controle de Troca de Óleo
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <label className={labelClass}>KM Atual</label>
                              <div className={`${inputClass} bg-slate-100/50 cursor-not-allowed flex items-center gap-2`}>
                                <Gauge className="w-4 h-4 text-slate-400" />
                                {formData.currentKm?.toLocaleString('pt-BR') || '---'} KM
                              </div>
                            </div>

                            <div className="relative" ref={oilBaseDropdownRef}>
                              <label className={labelClass}>Base de Cálculo (KM)</label>
                              <button
                                type="button"
                                onClick={() => setIsOilBaseDropdownOpen(!isOilBaseDropdownOpen)}
                                className={`${inputClass} flex items-center justify-between cursor-pointer active:scale-95`}
                              >
                                <span className="text-sm font-bold text-slate-900">
                                  {formData.oilCalculationBase ? `${formData.oilCalculationBase.toLocaleString('pt-BR')} KM` : '5.000 KM'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOilBaseDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isOilBaseDropdownOpen && (
                                <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-slide-up flex flex-col">
                                  {[500, 1000, 2000, 3000, 5000, 7000, 10000].map((base) => (
                                    <button
                                      key={base}
                                      type="button"
                                      onClick={() => {
                                        const next = (formData.oilLastChange || 0) + base;
                                        setFormData({ ...formData, oilCalculationBase: base as any, oilNextChange: next });
                                        setIsOilBaseDropdownOpen(false);
                                      }}
                                      className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group ${formData.oilCalculationBase === base ? 'bg-indigo-50/50' : ''}`}
                                    >
                                      <span className={`text-xs font-bold ${formData.oilCalculationBase === base ? 'text-indigo-900' : 'text-slate-700'}`}>
                                        {base.toLocaleString('pt-BR')} KM
                                      </span>
                                      {formData.oilCalculationBase === base && <Check className="w-4 h-4 text-indigo-600" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className={labelClass}>Próxima Troca (KM)</label>
                              <div className={`${inputClass} bg-indigo-100/50 font-black text-indigo-700 flex items-center`}>
                                {formData.oilNextChange?.toLocaleString('pt-BR') || '---'} KM
                              </div>
                            </div>

                            <div className="md:col-span-2">
                              <label className={labelClass}>Última Troca de Óleo (KM)</label>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={formData.oilLastChange || ''}
                                  readOnly
                                  className={`${inputClass} bg-slate-100/50 cursor-not-allowed`}
                                  placeholder="KM da última troca"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: "Confirmar Troca de Óleo",
                                      message: `Confirma a troca de óleo do veículo ${formData.model} (Placa: ${formData.plate}) no KM atual de ${formData.currentKm?.toLocaleString('pt-BR') || '0'}?`,
                                      type: 'positive',
                                      confirmLabel: 'Sim, Confirmar Troca',
                                      onConfirm: async () => {
                                        const last = formData.currentKm || 0;
                                        const next = last + (formData.oilCalculationBase || 5000);

                                        try {
                                          if (editingVehicle?.id) {
                                            await fleetService.addOilChangeRecord(editingVehicle.id, last, undefined, formData.oilCalculationBase);

                                            // Update Parent State to refresh Dashboard immediately
                                            const updatedVehicle: Vehicle = {
                                              ...editingVehicle,
                                              ...formData, // Merge current form state
                                              oilLastChange: last,
                                              oilNextChange: next,
                                              oilCalculationBase: formData.oilCalculationBase,
                                              currentKm: last // Sync KM
                                            } as Vehicle;
                                            onUpdateVehicle(updatedVehicle);
                                          }

                                          setFormData(prev => ({ ...prev, oilLastChange: last, oilNextChange: next }));
                                          setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                          alert("Troca de óleo registrada com sucesso!");
                                        } catch (error) {
                                          console.error("Erro ao registrar troca de óleo", error);
                                          alert("Erro ao registrar troca de óleo. Verifique o console.");
                                        }
                                      }
                                    });
                                  }}
                                  className="px-6 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shrink-0 shadow-lg shadow-indigo-600/20"
                                >
                                  Óleo Trocado
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-[2rem] p-6 space-y-6">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5" /> Controle de Correia Dentada
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <label className={labelClass}>KM Atual</label>
                              <div className={`${inputClass} bg-slate-100/50 cursor-not-allowed flex items-center gap-2`}>
                                <Gauge className="w-4 h-4 text-slate-400" />
                                {formData.currentKm?.toLocaleString('pt-BR') || '---'} KM
                              </div>
                            </div>

                            <div className="relative" ref={timingBeltBaseDropdownRef}>
                              <label className={labelClass}>Base de Cálculo (KM)</label>
                              <button
                                type="button"
                                onClick={() => setIsTimingBeltBaseDropdownOpen(!isTimingBeltBaseDropdownOpen)}
                                className={`${inputClass} flex items-center justify-between cursor-pointer active:scale-95`}
                              >
                                <span className="text-sm font-bold text-slate-900">
                                  {formData.timingBeltCalculationBase ? `${formData.timingBeltCalculationBase.toLocaleString('pt-BR')} KM` : '50.000 KM'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isTimingBeltBaseDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isTimingBeltBaseDropdownOpen && (
                                <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-60 overflow-y-auto custom-scrollbar">
                                  {[10000, 20000, 40000, 50000, 60000, 80000, 100000].map((base) => (
                                    <button
                                      key={base}
                                      type="button"
                                      onClick={() => {
                                        const next = (formData.timingBeltLastChange || 0) + base;
                                        setFormData({ ...formData, timingBeltCalculationBase: base as any, timingBeltNextChange: next });
                                        setIsTimingBeltBaseDropdownOpen(false);
                                      }}
                                      className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors group ${formData.timingBeltCalculationBase === base ? 'bg-indigo-50/50' : ''}`}
                                    >
                                      <span className={`text-xs font-bold ${formData.timingBeltCalculationBase === base ? 'text-indigo-900' : 'text-slate-700'}`}>
                                        {base.toLocaleString('pt-BR')} KM
                                      </span>
                                      {formData.timingBeltCalculationBase === base && <Check className="w-4 h-4 text-indigo-600" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className={labelClass}>Próxima Troca (KM)</label>
                              <div className={`${inputClass} bg-indigo-100/50 font-black text-indigo-700 flex items-center`}>
                                {formData.timingBeltNextChange?.toLocaleString('pt-BR') || '---'} KM
                              </div>
                            </div>

                            <div className="md:col-span-2">
                              <label className={labelClass}>Última Troca de Correia (KM)</label>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={formData.timingBeltLastChange || ''}
                                  readOnly
                                  className={`${inputClass} bg-slate-100/50 cursor-not-allowed`}
                                  placeholder="KM da última troca"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: "Confirmar Troca de Correia",
                                      message: `Confirma a troca de correia dentada do veículo ${formData.model} (Placa: ${formData.plate}) no KM atual de ${formData.currentKm?.toLocaleString('pt-BR') || '0'}?`,
                                      type: 'positive',
                                      confirmLabel: 'Sim, Confirmar Troca',
                                      onConfirm: async () => {
                                        const last = formData.currentKm || 0;
                                        const next = last + (formData.timingBeltCalculationBase || 50000);

                                        try {
                                          if (editingVehicle?.id) {
                                            await fleetService.addTimingBeltRecord(editingVehicle.id, last);

                                            // Update Parent State
                                            const updatedVehicle: Vehicle = {
                                              ...editingVehicle,
                                              ...formData, // Merge current form state
                                              timingBeltLastChange: last,
                                              timingBeltNextChange: next,
                                              timingBeltCalculationBase: formData.timingBeltCalculationBase,
                                              currentKm: last // Sync KM
                                            } as Vehicle;
                                            onUpdateVehicle(updatedVehicle);
                                          }

                                          setFormData(prev => ({ ...prev, timingBeltLastChange: last, timingBeltNextChange: next }));
                                          setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                          alert("Troca de correia registrada com sucesso!");
                                        } catch (error) {
                                          console.error("Erro ao registrar troca de correia", error);
                                          alert("Erro ao registrar troca de correia. Verifique o console.");
                                        }
                                      }
                                    });
                                  }}
                                  className="px-6 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shrink-0 shadow-lg"
                                >
                                  Correia Trocada
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}><Fuel className="w-4 h-4 inline mr-2 text-indigo-500" /> Código Renavam</label>
                          <input value={formData.renavam} onChange={e => setFormData({ ...formData, renavam: e.target.value })} className={`${inputClass} font-mono`} placeholder="01332550344" />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}><ShieldCheck className="w-4 h-4 inline mr-2 text-indigo-500" /> Número do Chassi (VIN)</label>
                        <input value={formData.chassis} onChange={e => setFormData({ ...formData, chassis: e.target.value.toUpperCase() })} className={`${inputClass} font-mono uppercase`} placeholder="8AP..." />
                      </div>

                      <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-[2rem] p-6 space-y-6">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5" /> Documentos do Veículo
                        </h4>

                        {/* Upload Section */}
                        <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-dashed border-slate-300">
                          <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                              <label className={labelClass}>Descrição do Documento</label>
                              <input
                                value={newDocumentDescription}
                                onChange={(e) => setNewDocumentDescription(e.target.value)}
                                className={inputClass}
                                placeholder="Ex: CRLV 2024, Seguro, Manual..."
                              />
                            </div>
                            <div className="flex-1 w-full">
                              <label className={labelClass}>Arquivo</label>
                              <div className="relative">
                                <input
                                  type="file"
                                  ref={documentInputRef}
                                  onChange={(e) => setNewDocumentFile(e.target.files?.[0] || null)}
                                  className="hidden"
                                  id="doc-upload"
                                />
                                <label htmlFor="doc-upload" className={`${inputClass} cursor-pointer flex items-center gap-2 text-slate-500 hover:bg-slate-50`}>
                                  <Upload className="w-4 h-4" />
                                  <span className="truncate">{newDocumentFile ? newDocumentFile.name : 'Selectionar arquivo...'}</span>
                                </label>
                              </div>
                            </div>
                            <button
                              onClick={handleDocumentUpload}
                              disabled={isUploadingDocument || !newDocumentFile || !newDocumentDescription}
                              className="h-[50px] px-6 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                              {isUploadingDocument ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                              Anexar
                            </button>
                          </div>
                        </div>

                        {/* Documents List */}
                        <div className="space-y-2">
                          {vehicleDocuments.length > 0 ? (
                            vehicleDocuments.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-700 truncate">{doc.description || doc.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{doc.name} • {new Date(doc.created_at || '').toLocaleDateString('pt-BR')}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    download
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Baixar"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                  <button
                                    onClick={() => handleDocumentDelete(doc)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-100/50 rounded-xl border border-dashed border-slate-200">
                              Nenhum documento anexado.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
                  <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-black text-slate-400 hover:text-rose-600 transition-all uppercase text-[10px] tracking-[0.2em]">Descartar</button>
                  <button onClick={handleSave} className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-indigo-600 shadow-xl flex items-center gap-3 transition-all uppercase text-[10px] tracking-[0.2em] active:scale-95">
                    <Save className="w-4 h-4" /> Salvar Veículo
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        }

        {/* MODAL PARA ADICIONAR NOVA MARCA */}
        {
          isBrandModalOpen && createPortal(
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                      <Tag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight uppercase leading-none">Nova Marca</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Categoria: {activeTab === 'leve' ? 'Leves' : activeTab === 'pesado' ? 'Pesados' : 'Acessórios'}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsBrandModalOpen(false)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-400 transition-all"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-8">
                  <label className={labelClass}>Nome do Fabricante / Marca</label>
                  <input
                    autoFocus
                    value={newBrandName}
                    onChange={e => setNewBrandName(e.target.value)}
                    className={inputClass}
                    placeholder="Digite o nome da marca..."
                    onKeyDown={e => e.key === 'Enter' && handleSaveBrand()}
                  />
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                  <button onClick={() => setIsBrandModalOpen(false)} className="flex-1 py-4 bg-white text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl border border-slate-200 hover:bg-slate-50 transition-all">Cancelar</button>
                  <button
                    onClick={handleSaveBrand}
                    disabled={!newBrandName.trim()}
                    className="flex-2 px-8 py-4 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Salvar Marca
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        }

        {/* MODAL DE SELEÇÃO DE SETOR */}
        {
          isSectorModalOpen && createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                      <Network className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight uppercase leading-none">Selecionar Setor</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Atribuição do Veículo</p>
                    </div>
                  </div>
                  <button onClick={() => setIsSectorModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-4 bg-slate-50 border-b border-slate-100 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar setor..."
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={sectorSearch}
                      onChange={(e) => setSectorSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-4 flex-1">
                  {filteredSectors.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredSectors.map((sector) => (
                        <button
                          key={sector.id}
                          onClick={() => {
                            setFormData({ ...formData, sectorId: sector.id });
                            setIsSectorModalOpen(false);
                            setSectorSearch('');
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-xl transition-all group ${formData.sectorId === sector.id ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.sectorId === sector.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                              <Network className="w-4 h-4" />
                            </div>
                            <span className={`text-sm font-bold ${formData.sectorId === sector.id ? 'text-indigo-900' : 'text-slate-700 group-hover:text-indigo-900'}`}>{sector.name}</span>
                          </div>
                          {formData.sectorId === sector.id && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 p-8">
                      <Search className="w-12 h-12 mb-2" />
                      <p className="text-sm font-bold">Nenhum setor encontrado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        }

        {/* MODAL DE SELEÇÃO DE RESPONSÁVEL */}
        {
          isResponsibleModalOpen && createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight uppercase leading-none">Selecionar Responsável</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Condutor Principal</p>
                    </div>
                  </div>
                  <button onClick={() => setIsResponsibleModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-4 bg-slate-50 border-b border-slate-100 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar nome ou cargo..."
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={responsibleSearch}
                      onChange={(e) => setResponsibleSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-4 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, responsiblePersonId: '' });
                      setIsResponsibleModalOpen(false);
                    }}
                    className="w-full mb-3 p-3 bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center gap-2 border border-slate-100 hover:border-rose-100"
                  >
                    <X className="w-3.5 h-3.5" /> Remover Responsável
                  </button>

                  {filteredPersons.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredPersons.map((person) => (
                        <button
                          key={person.id}
                          onClick={() => {
                            setFormData({ ...formData, responsiblePersonId: person.id });
                            setIsResponsibleModalOpen(false);
                            setResponsibleSearch('');
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-xl transition-all group ${formData.responsiblePersonId === person.id ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}
                        >
                          <div className="flex items-center gap-3 text-left">
                            <div className={`p-2 rounded-lg ${formData.responsiblePersonId === person.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <span className={`text-sm font-bold block ${formData.responsiblePersonId === person.id ? 'text-indigo-900' : 'text-slate-700 group-hover:text-indigo-900'}`}>{person.name}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400">{jobs.find(j => j.id === person.jobId)?.name || 'Sem Cargo'}</span>
                            </div>
                          </div>
                          {formData.responsiblePersonId === person.id && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 p-8">
                      <Search className="w-12 h-12 mb-2" />
                      <p className="text-sm font-bold">Nenhum responsável encontrado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        }

        {/* MODAL DE SELEÇÃO DE GESTORES DE SOLICITAÇÕES */}
        {
          isRequestManagerModalOpen && createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight uppercase leading-none">Gestores de Solicitações</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Quem pode aprovar este veículo</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsRequestManagerModalOpen(false)}
                    className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-indigo-600 transition-all active:scale-95"
                  >
                    Concluído
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border-b border-slate-100 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar gestor..."
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={requestManagerSearch}
                      onChange={(e) => setRequestManagerSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-4 flex-1">
                  <div className="mb-4 flex items-center justify-between px-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lista de Colaboradores</span>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{formData.requestManagerIds?.length || 0} Selecionados</span>
                  </div>

                  {filteredRequestManagers.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredRequestManagers.map((person) => {
                        const isSelected = formData.requestManagerIds?.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            onClick={() => toggleRequestManager(person.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all group ${isSelected ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}
                          >
                            <div className="flex items-center gap-3 text-left">
                              <div className={`p-2 rounded-lg transition-all ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <span className={`text-sm font-bold block ${isSelected ? 'text-indigo-900' : 'text-slate-700 group-hover:text-indigo-900'}`}>{person.name}</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400">{jobs.find(j => j.id === person.jobId)?.name || 'Sem Cargo'}</span>
                              </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white scale-110' : 'border-slate-200 group-hover:border-indigo-400'}`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 p-8">
                      <Search className="w-12 h-12 mb-2" />
                      <p className="text-sm font-bold">Nenhum colaborador encontrado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        }

        {/* MODAL DE VISUALIZAÇÃO */}
        {
          viewingDocumentUrl && createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl animate-fade-in">
              <div className={`w-full flex flex-col bg-white rounded-[4rem] shadow-2xl overflow-hidden animate-scale-in ${viewingDocumentUrl.type === 'photo' ? 'max-w-4xl h-fit' : 'h-full max-w-6xl'}`}>
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-xl ${viewingDocumentUrl.type === 'photo' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                      {viewingDocumentUrl.type === 'photo' ? <ImageIcon className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                        {viewingDocumentUrl.type === 'photo' ? 'Visualização da Foto' : 'Visualização de Documento'}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{viewingDocumentUrl.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={viewingDocumentUrl.url} download={viewingDocumentUrl.name} className="p-4 bg-slate-50 text-slate-600 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"><Download className="w-7 h-7" /></a>
                    <button onClick={() => setViewingDocumentUrl(null)} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-rose-600 transition-all active:scale-95 shadow-lg"><X className="w-7 h-7" /></button>
                  </div>
                </div>
                <div className={`overflow-auto flex items-center justify-center p-12 bg-slate-100/50 ${viewingDocumentUrl.type === 'photo' ? 'max-h-[70vh]' : 'flex-1'}`}>
                  {viewingDocumentUrl.url.startsWith('data:application/pdf') ? (
                    <iframe src={viewingDocumentUrl.url} className="w-full h-full rounded-[2.5rem] border-8 border-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] min-h-[60vh]" />
                  ) : (
                    <img src={viewingDocumentUrl.url} alt="Visualização" className="max-w-full max-h-full object-contain rounded-[2.5rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] border-8 border-white" />
                  )}
                </div>
                <div className="p-8 bg-white border-t border-slate-100 text-center shrink-0">
                  <button onClick={() => setViewingDocumentUrl(null)} className="px-16 py-5 bg-slate-900 text-white font-black uppercase text-xs tracking-[0.3em] rounded-3xl transition-all shadow-2xl active:scale-95">Fechar Visualização</button>
                </div>
              </div>
            </div>,
            document.body
          )
        }

        {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
        {/* MODAL DE CONFIRMAÇÃO DE AÇÃO */}
        {
          confirmModal.isOpen && createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20">
                <div className="p-12 text-center">
                  <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3 ${confirmModal.type === 'positive' ? 'bg-indigo-50 text-indigo-600 shadow-indigo-500/10' : 'bg-rose-50 text-rose-600 shadow-rose-500/10'}`}>
                    {confirmModal.type === 'positive' ? <CheckCircle2 className="w-12 h-12" /> : <Trash className="w-12 h-12" />}
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">{confirmModal.title}</h3>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">{confirmModal.message}</p>
                </div>
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
                  <button
                    onClick={confirmModal.onConfirm}
                    className={`w-full py-5 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] shadow-2xl transition-all active:scale-95 ${confirmModal.type === 'positive' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'}`}
                  >
                    {confirmModal.confirmLabel || 'Confirmar'}
                  </button>
                  <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="w-full py-5 bg-white text-slate-400 font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] border border-slate-200 hover:bg-white hover:text-slate-600 transition-all shadow-sm">
                    {confirmModal.cancelLabel || 'Voltar / Cancelar'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        }
      </div >

      {/* MODAL DE STATUS DO VEÍCULO */}
      {
        viewingVehicleStatus && createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/10`}>
                    <Car className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{viewingVehicleStatus.model}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">{viewingVehicleStatus.plate}</p>
                  </div>
                </div>
                <button onClick={() => setViewingVehicleStatus(null)} className="p-3 bg-white text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Status Geral */}
                <div className="flex items-center justify-between bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Gauge className="w-6 h-6 text-slate-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KM Atual</p>
                      <p className="text-2xl font-black text-slate-900">{viewingVehicleStatus.currentKm?.toLocaleString('pt-BR') || '---'} KM</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bloco Óleo */}
                  <div className="bg-amber-50/50 p-6 rounded-[2.5rem] border border-amber-100 relative overflow-hidden group hover:border-amber-200 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Droplets className="w-24 h-24 text-amber-500" />
                    </div>

                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 relative z-10">
                      <Droplets className="w-3.5 h-3.5" /> Troca de Óleo
                    </h4>

                    <div className="space-y-4 relative z-10">
                      <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-amber-100/50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Última Troca</p>
                        <p className="text-sm font-black text-slate-700">{viewingVehicleStatus.oilLastChange?.toLocaleString('pt-BR') || '---'} KM</p>
                      </div>

                      <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-amber-100/50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Próxima Troca</p>
                        {(() => {
                          const diff = (viewingVehicleStatus.oilNextChange || 0) - (viewingVehicleStatus.currentKm || 0);
                          let statusColor = 'text-emerald-600';
                          let statusText = 'EM DIA';
                          if (diff <= 0) { statusColor = 'text-rose-600'; statusText = 'VENCIDO'; }
                          else if (diff <= 500) { statusColor = 'text-amber-600'; statusText = 'PRÓXIMO'; }

                          return (
                            <div className="flex justify-between items-end">
                              <p className={`text-lg font-black ${statusColor}`}>
                                {viewingVehicleStatus.oilNextChange?.toLocaleString('pt-BR') || '---'} KM
                              </p>
                              <span className={`text-[9px] font-black px-2 py-1 rounded-lg bg-white ${statusColor} border border-current opacity-80`}>
                                {statusText}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex justify-between items-center px-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base de Cálculo</span>
                        <span className="text-[10px] font-black text-slate-600">{viewingVehicleStatus.oilCalculationBase?.toLocaleString('pt-BR') || 5000} KM</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco Correia */}
                  <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100 relative overflow-hidden group hover:border-indigo-200 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Activity className="w-24 h-24 text-indigo-500" />
                    </div>

                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 relative z-10">
                      <Activity className="w-3.5 h-3.5" /> Correia Dentada
                    </h4>

                    <div className="space-y-4 relative z-10">
                      <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-indigo-100/50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Última Troca</p>
                        <p className="text-sm font-black text-slate-700">{viewingVehicleStatus.timingBeltLastChange?.toLocaleString('pt-BR') || '---'} KM</p>
                      </div>

                      <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-indigo-100/50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Próxima Troca</p>
                        {(() => {
                          const diff = (viewingVehicleStatus.timingBeltNextChange || 0) - (viewingVehicleStatus.currentKm || 0);
                          let statusColor = 'text-emerald-600';
                          let statusText = 'EM DIA';
                          if (diff <= 0) { statusColor = 'text-rose-600'; statusText = 'VENCIDO'; }
                          else if (diff <= 1000) { statusColor = 'text-amber-600'; statusText = 'PRÓXIMO'; }

                          return (
                            <div className="flex justify-between items-end">
                              <p className={`text-lg font-black ${statusColor}`}>
                                {viewingVehicleStatus.timingBeltNextChange?.toLocaleString('pt-BR') || '---'} KM
                              </p>
                              <span className={`text-[9px] font-black px-2 py-1 rounded-lg bg-white ${statusColor} border border-current opacity-80`}>
                                {statusText}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex justify-between items-center px-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base de Cálculo</span>
                        <span className="text-[10px] font-black text-slate-600">{viewingVehicleStatus.timingBeltCalculationBase?.toLocaleString('pt-BR') || 50000} KM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }

    </>
  );
};
