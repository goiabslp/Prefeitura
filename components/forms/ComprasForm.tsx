
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ShoppingCart, FileText, PenTool, CheckCircle2, Columns,
  Plus, Trash2, Hash, Layers, MessageSquare, AlignLeft,
  Minus, ChevronDown, Package, Archive, Scale, Briefcase, Box, Lock, Key,
  AlertTriangle, ShieldAlert, Zap, Info, User, Search, Check, UserCheck, Paperclip, Upload, ShieldCheck, QrCode, CreditCard, Loader2
} from 'lucide-react';
import { AppState, ContentData, DocumentConfig, Signature, PurchaseItem, Person, Sector, Job, Attachment } from '../../types';
import { uploadFile } from '../../services/storageService';
import { purchaseAccountService } from '../../services/purchaseAccountService';
import { PurchaseAccount, User as UserType } from '../../types';
import { AccountManagementTab } from '../compras/AccountManagementTab';
import { ItemSelectionModal } from '../compras/ItemSelectionModal';
import { Landmark, X } from 'lucide-react';

interface ComprasFormProps {
  state: AppState;
  content: ContentData;
  docConfig: DocumentConfig;
  allowedSignatures: Signature[];
  handleUpdate: (section: keyof AppState, key: string, value: any) => void;
  onUpdate: React.Dispatch<React.SetStateAction<AppState>>;
  persons: Person[];
  sectors: Sector[];
  jobs: Job[];
  currentStep?: number; // Added for Stepper Control
  onFinish?: () => Promise<boolean | void>; // Updated to handle loading/interception flow
  canFinish?: boolean; // Added to validate mandatory steps before finishing
  isLoading?: boolean;
  currentUser: UserType;
}

const UNIT_OPTIONS = [
  { value: 'Unidade', label: 'Unidade', icon: Box },
  { value: 'Pacote', label: 'Pacote', icon: Package },
  { value: 'Caixa', label: 'Caixa', icon: Archive },
  { value: 'Kg', label: 'Kg', icon: Scale },
  { value: 'Serviço', label: 'Serviço', icon: Briefcase },
  { value: 'Metro Cúbico (m³)', label: 'Metro Cúbico (m³)', icon: Box },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'Normal', label: 'Normal', icon: Info, color: 'slate' },
  { value: 'Média', label: 'Média', icon: Zap, color: 'indigo' },
  { value: 'Alta', label: 'Alta', icon: AlertTriangle, color: 'amber' },
  { value: 'Urgência', label: 'Urgência', icon: ShieldAlert, color: 'rose' },
] as const;


const AccountSelectionEmbedded: React.FC<{
  selectedAccount: string;
  onSelect: (account: string) => void;
}> = ({ selectedAccount, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<PurchaseAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    const data = await purchaseAccountService.getAccounts();
    setAccounts(data.filter(acc => acc.status === 'Ativa'));
    setLoading(false);
  };

  const filtered = accounts.filter(acc => {
    const label = `${acc.account_number} – ${acc.description}`;
    return label.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[380px]">
      <div className="p-4 border-b border-slate-100 bg-slate-50/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar conta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-300"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carregando...</p>
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((acc) => {
            const label = `${acc.account_number} – ${acc.description}`;
            const isSelected = selectedAccount === label;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onSelect('');
                  } else {
                    onSelect(label);
                  }
                }}
                className={`
                  w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all group
                  ${isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-50 bg-slate-50/30 hover:border-emerald-200 hover:bg-white'
                  }
                `}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {acc.account_number}
                  </span>
                  <span className={`text-[13px] font-bold tracking-tight text-left leading-tight ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {acc.description}
                  </span>
                </div>
                <div className={`
                  w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0
                  ${isSelected ? 'bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/20' : 'bg-white text-slate-200 border border-slate-100'}
                `}>
                  <Check className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })
        ) : (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-400">Nenhuma conta encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const ComprasForm: React.FC<ComprasFormProps> = ({
  state,
  content,
  docConfig,
  allowedSignatures,
  handleUpdate,
  onUpdate,
  persons,
  sectors,
  jobs,
  currentStep = 1,
  onFinish,
  canFinish = true,
  isLoading = false,
  currentUser
}) => {
  // ORDENAÇÃO ALFABÉTICA DAS ASSINATURAS
  const sortedSignatures = useMemo(() => {
    return [...allowedSignatures].sort((a, b) => a.name.localeCompare(b.name));
  }, [allowedSignatures]);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isRequesterOpen, setIsRequesterOpen] = useState(false);
  const [requesterSearch, setRequesterSearch] = useState('');
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const requesterDropdownRef = useRef<HTMLDivElement>(null);
  const signaturesGridRef = useRef<HTMLDivElement>(null);
  const signButtonRef = useRef<HTMLButtonElement>(null);
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [isSigned, setIsSigned] = useState(!!content.digitalSignature?.enabled);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isItemSelectionOpen, setIsItemSelectionOpen] = useState(false);

  // Effects to enforce initial state empty values have been removed to prevent 
  // unintended state resets during user interaction.

  // ENFORCEMENT EFFECT
  useEffect(() => {
    // ENFORCE DIGITAL SIGNATURE ALWAYS
    if (!content.useDigitalSignature) {
      onUpdate(prev => ({
        ...prev,
        content: {
          ...prev.content,
          useDigitalSignature: true
        }
      }));
    }
  }, [content.useDigitalSignature, onUpdate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Dropdown logic
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
      if (requesterDropdownRef.current && !requesterDropdownRef.current.contains(event.target as Node)) {
        setIsRequesterOpen(false);
      }

      // DESELECT SIGNATURE LOGIC
      // Use functional update to check latest state without dependency
      onUpdate(prev => {
        if (!prev.content.signatureName) return prev;

        const isOutsideGrid = signaturesGridRef.current && !signaturesGridRef.current.contains(event.target as Node);
        const isOutsideButton = signButtonRef.current && !signButtonRef.current.contains(event.target as Node);

        if (isOutsideGrid && isOutsideButton) {
          return {
            ...prev,
            content: {
              ...prev.content,
              signatureName: '',
              signatureRole: ''
            }
          };
        }
        return prev;
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onUpdate]); // Removed state dependency as it's not needed for this logic

  // DETECT SPACE FOR REQUESTER DROPDOWN (UP OR DOWN)
  useEffect(() => {
    if (isRequesterOpen && requesterDropdownRef.current) {
      const rect = requesterDropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 280px below, open upwards
      setDropdownDirection(spaceBelow < 280 ? 'up' : 'down');
    }
  }, [isRequesterOpen]);

  // FILTRO E ORDENAÇÃO ALFABÉTICA DOS SOLICITANTES
  const filteredRequesters = useMemo(() => {
    const term = requesterSearch.toLowerCase();
    return persons
      .filter(p => p.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, requesterSearch]);



  const handlePersonSelect = (personId: string) => {
    const person = persons.find(p => p.id === personId);
    if (person) {
      const job = jobs.find(j => j.id === person.jobId)?.name || '';
      const sector = sectors.find(s => s.id === person.sectorId)?.name || '';

      onUpdate({
        ...state,
        content: {
          ...state.content,
          requesterName: person.name,
          requesterRole: job,
          requesterSector: sector
        }
      });
    }
    setIsRequesterOpen(false);
    setRequesterSearch('');
  };

  const handleAddItem = () => {
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
      unit: 'Unidade'
    };
    handleUpdate('content', 'purchaseItems', [...(content.purchaseItems || []), newItem]);
  };

  const handleRemoveItem = (id: string) => {
    handleUpdate('content', 'purchaseItems', (content.purchaseItems || []).filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, key: keyof PurchaseItem, value: any) => {
    handleUpdate('content', 'purchaseItems', (content.purchaseItems || []).map(item =>
      item.id === id ? { ...item, [key]: value } : item
    ));
  };

  const adjustQuantity = (id: string, delta: number) => {
    const items = content.purchaseItems || [];
    const item = items.find(i => i.id === id);
    if (item) {
      const newQty = Math.max(1, (item.quantity || 0) + delta);
      handleUpdateItem(id, 'quantity', newQty);
    }
  };

  // Force blocks to be visible in preview for Compras, even if UI is hidden
  useEffect(() => {
    if (!docConfig.showLeftBlock) handleUpdate('document', 'showLeftBlock', true);
    if (!docConfig.showRightBlock) handleUpdate('document', 'showRightBlock', true);
  }, [docConfig.showLeftBlock, docConfig.showRightBlock, handleUpdate]);

  const inputClass = "bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all w-full";
  const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5";

  const showPriorityJustification = content.priority === 'Alta' || content.priority === 'Urgência';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Endereçamento - HIDDEN FROM UI BUT ACTIVE IN PREVIEW */}
      {/* 
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Columns className="w-4 h-4 text-emerald-600" /> Blocos de Endereçamento
        </h3>
        ... removed UI ...
      </div> 
      */}

      {/* END OF HEADER BLOCK */}

      {/* STEP 1: DETALHES (Solicitante, Requisição, Justificativa) */}
      {currentStep === 1 && (
        <>
          {/* Requisição (Reordenado - Primeiro Bloco) */}
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-600" /> Requisição
            </h3>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <label className={labelClass}>Finalidade do Pedido</label>
                <input
                  value={content.title}
                  onChange={(e) => handleUpdate('content', 'title', e.target.value)}
                  className={`${inputClass} font-bold text-slate-900 text-base`}
                  placeholder="Novo Pedido"
                />
              </div>

              {/* Bloco de Prioridade Compacto e Moderno */}
              <div className="pt-2 border-t border-slate-100">
                <label className={labelClass}>Prioridade</label>
                <div className="flex bg-slate-100 p-1 rounded-full gap-1">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = content.priority === opt.value;
                    // Colors for selected state
                    const selectedColors = {
                      slate: 'bg-white text-slate-700 shadow-sm ring-1 ring-black/5',
                      indigo: 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30',
                      amber: 'bg-amber-500 text-white shadow-md shadow-amber-500/30',
                      rose: 'bg-rose-500 text-white shadow-md shadow-rose-500/30',
                    };

                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleUpdate('content', 'priority', opt.value)}
                        className={`
                          flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all duration-300
                          ${isSelected
                            ? selectedColors[opt.color as keyof typeof selectedColors]
                            : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'}
                        `}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? '' : 'opacity-70'}`} />
                        <span className="hidden sm:inline">{opt.label}</span>
                        <span className="sm:hidden">{opt.label.slice(0, 3)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Justificativa de Prioridade (Condicional) */}
              {showPriorityJustification && (
                <div className="pt-4 animate-slide-up">
                  <label className={labelClass}>Justificativa da {content.priority}</label>
                  <div className="relative">
                    <textarea
                      value={content.priorityJustification || ''}
                      onChange={(e) => handleUpdate('content', 'priorityJustification', e.target.value)}
                      className={`${inputClass} min-h-[100px] resize-none leading-relaxed p-4 border-rose-100 bg-rose-50/20`}
                      placeholder={`Por que este pedido tem prioridade ${content.priority}?`}
                    />
                    <MessageSquare className="absolute right-3 top-3 w-4 h-4 text-rose-300 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dados do Solicitante (Reordenado - Segundo Bloco) */}
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" /> Dados do Solicitante
            </h3>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="relative" ref={requesterDropdownRef}>
                <label className={labelClass}>NOME COMPLETO</label>
                <div
                  onClick={() => setIsRequesterOpen(!isRequesterOpen)}
                  className={`${inputClass} flex items-center justify-between cursor-pointer py-3 ${isRequesterOpen ? 'border-emerald-500 ring-4 ring-emerald-500/5 bg-white' : ''}`}
                >
                  <span className={content.requesterName ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                    {content.requesterName || 'Selecione o Solicitante...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isRequesterOpen ? 'rotate-180' : ''}`} />
                </div>

                {isRequesterOpen && (
                  <div className={`
                    absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden
                    ${dropdownDirection === 'up'
                      ? 'bottom-full mb-2 animate-slide-up'
                      : 'mt-2 animate-slide-up'}
                  `}>
                    <div className="p-3 border-b border-slate-100 bg-slate-50">
                      <div className="relative">
                        <input
                          type="text"
                          value={requesterSearch}
                          onChange={(e) => setRequesterSearch(e.target.value)}
                          placeholder="Pesquisar pessoa na lista..."
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                      {filteredRequesters.length > 0 ? (
                        filteredRequesters.map((person, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePersonSelect(person.id);
                            }}
                            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-emerald-50 text-left text-sm font-medium text-slate-700 transition-colors group"
                          >
                            <div className="flex flex-col">
                              <span className="group-hover:text-emerald-700">{person.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {jobs.find(j => j.id === person.jobId)?.name || 'N/A'} • {sectors.find(s => s.id === person.sectorId)?.name || 'N/A'}
                              </span>
                            </div>
                            {content.requesterName === person.name && <Check className="w-4 h-4 text-emerald-600" />}
                          </button>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <User className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-xs text-slate-400 font-medium">Nenhuma pessoa encontrada.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cargo</label>
                  <input
                    type="text" value={content.requesterRole || ''}
                    readOnly
                    className={`${inputClass} bg-slate-100/50 cursor-not-allowed text-slate-500`}
                    placeholder="Cargo automático"
                  />
                </div>
                <div>
                  <label className={labelClass}>Setor</label>
                  <input
                    type="text" value={content.requesterSector || ''}
                    readOnly
                    className={`${inputClass} bg-slate-100/50 cursor-not-allowed text-slate-500`}
                    placeholder="Setor automático"
                  />
                </div>
              </div>
            </div>
          </div>


        </>
      )}

      {/* STEP 2: ITENS DA REQUISIÇÃO */}
      {currentStep === 2 && (
        <div className="space-y-4 border-t border-slate-200 pt-6">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" /> Itens da Requisição
            </h3>
          </div>

          <div className="space-y-4" ref={dropdownRef}>
            {/* SORTABLE / LIST LIST */}
            {(content.purchaseItems || []).map((item, index) => {
              const isDropdownOpen = openDropdownId === item.id;

              return (
                <div
                  key={item.id}
                  className={`flex gap-4 sm:gap-6 items-stretch transition-all duration-300 ${isDropdownOpen ? 'z-50 relative' : 'z-0 relative'}`}
                >
                  {/* EXTERNAL COUNTER */}
                  <div className="flex flex-col items-center pt-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm sm:text-base shadow-lg shadow-slate-900/20 z-10">
                      {index + 1}
                    </div>
                    {/* Connecting Line (except for last item) */}
                    {index < (content.purchaseItems?.length || 0) - 1 && (
                      <div className="w-0.5 flex-1 bg-slate-200 mt-2 mb-2 rounded-full" />
                    )}
                  </div>

                  {/* ITEM CARD */}
                  <div className={`
                    flex-1 bg-white rounded-2xl p-5 border transition-all duration-300 ease-out group
                    ${isDropdownOpen
                      ? 'border-emerald-400 ring-4 ring-emerald-500/10 shadow-xl'
                      : 'border-slate-100 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5'
                    }
                  `}>
                    <div className="flex flex-col md:flex-row md:items-center gap-4 sm:gap-6">

                      {/* 1. Description Input (Grows) */}
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-2">
                          Descrição do Item
                          {item.code && (
                             <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[9px] border border-emerald-100">
                               Cód: {item.code}
                             </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                          placeholder="Ex: Caneta Esferográfica Azul (Cx. 50 un)..."
                          className="w-full text-base sm:text-lg font-medium text-slate-800 bg-transparent border-b-2 border-slate-100 hover:border-slate-300 focus:border-emerald-500 focus:bg-slate-50/50 outline-none transition-all placeholder:text-slate-300 py-2 sm:py-1"
                        />
                      </div>

                      {/* 2. Controls Group (Qty, Unit, Delete) */}
                      <div className="flex items-end md:items-center gap-3 sm:gap-4">

                        {/* Quantity */}
                        <div className="w-28 sm:w-32">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">
                            Quantidade
                          </label>
                          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 group-hover:border-slate-300 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all h-[42px]">
                            <button
                              type="button"
                              onClick={() => adjustQuantity(item.id, -1)}
                              className="w-10 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-l-xl transition-colors active:scale-95"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                              className="flex-1 w-full min-w-0 bg-transparent border-none text-center text-sm font-bold text-slate-700 outline-none h-full appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => adjustQuantity(item.id, 1)}
                              className="w-10 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-r-xl transition-colors active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Unit */}
                        <div className="w-40 sm:w-48 relative flex-shrink-0">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">
                            Unidade
                          </label>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === item.id ? null : item.id);
                              }}
                              className={`
                                w-full flex items-center justify-between text-left bg-slate-50 border text-slate-700 text-sm font-semibold rounded-xl px-3 h-[42px] transition-all outline-none
                                ${isDropdownOpen ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/10' : 'border-slate-200 hover:bg-white hover:border-emerald-300'}
                              `}
                            >
                              <span className="truncate whitespace-nowrap">{item.unit}</span>
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-emerald-500' : ''}`} />
                            </button>

                            {/* Dropdown */}
                            {isDropdownOpen && (
                              <div className="absolute z-[100] right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-slide-up py-1 min-w-[200px]">
                                {UNIT_OPTIONS.map((opt) => {
                                  const Icon = opt.icon;
                                  const isSelected = item.unit === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      onClick={() => {
                                        handleUpdateItem(item.id, 'unit', opt.value);
                                        setOpenDropdownId(null);
                                      }}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-600'
                                        }`}
                                    >
                                      <Icon className="w-3.5 h-3.5" />
                                      {opt.label}
                                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-600" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Delete */}
                        <div className="h-[42px] flex items-end">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="w-[42px] h-[42px] flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
                            title="Remover Item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!content.purchaseItems || content.purchaseItems.length === 0) && (
              <div className="p-10 sm:p-16 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center bg-white/50 backdrop-blur-sm">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6 shadow-inner">
                  <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <p className="font-black text-slate-700 text-lg">Sua lista está vazia</p>
                <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">Adicione produtos ou serviços para compor sua requisição.</p>
              </div>
            )}
          </div>

          {/* Spacer to prevent overlapping with fixed button */}
          <div className="h-28 sm:h-32" />

          {/* Fixed Floating Add Button */}
          <button
            onClick={() => setIsItemSelectionOpen(true)}
            className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-[60] group flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl shadow-emerald-600/40 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all outline-none animate-bounce-in"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span className="hidden sm:inline">Adicionar Itens</span>
            <span className="inline sm:hidden">Add</span>
          </button>

          {/* Item Selection Modal */}
          {isItemSelectionOpen && (
              <ItemSelectionModal
                  onClose={() => setIsItemSelectionOpen(false)}
                  userRole={currentUser.role}
                  onAddManual={() => {
                      handleAddItem();
                      setIsItemSelectionOpen(false);
                  }}
                  onConfirm={(items) => {
                      handleUpdate('content', 'purchaseItems', [...(content.purchaseItems || []), ...items]);
                      setIsItemSelectionOpen(false);
                  }}
              />
          )}
        </div>
      )}

      {/* STEP 3: JUSTIFICATIVA (Moved from Step 1) */}
      {currentStep === 3 && (
        <div className="space-y-4 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" /> Justificativa do Pedido
          </h3>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <label className={labelClass}>Descrição da Necessidade</label>
            <div className="relative">
              <textarea
                value={content.body}
                onChange={(e) => handleUpdate('content', 'body', e.target.value)}
                className={`${inputClass} min-h-[300px] resize-none leading-relaxed p-6 text-base`}
                placeholder="Descreva aqui o motivo da solicitação e a justificativa para a aquisição dos itens..."
                autoFocus
              />
              <AlignLeft className="absolute right-4 top-4 w-5 h-5 text-slate-300 pointer-events-none" />
            </div>
            <p className="text-xs text-slate-400 mt-3 italic">
              Este texto aparecerá antes da lista de itens no documento final. Seja claro e detalhado.
            </p>
          </div>
        </div>
      )}

      {/* STEP 4: ANEXOS (Formerly Cotação) */}
      {currentStep === 4 && (
        <div className="space-y-4 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-emerald-600" /> Anexos e Cotações
          </h3>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">

            {/* Upload Area */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
              <input
                type="file"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []) as File[];
                  if (files.length === 0) return;

                  setIsUploading(true);
                  try {
                    const uploadedAttachments: Attachment[] = [];
                    for (const file of files) {
                      const publicUrl = await uploadFile(file, 'attachments', `purchase_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
                      if (publicUrl) {
                        uploadedAttachments.push({
                          id: Math.random().toString(36).substr(2, 9),
                          name: file.name,
                          url: publicUrl,
                          type: file.type,
                          date: new Date().toISOString()
                        });
                      }
                    }

                    if (uploadedAttachments.length > 0) {
                      handleUpdate('content', 'attachments', [...(content.attachments || []), ...uploadedAttachments]);
                    }
                  } catch (error) {
                    console.error("Upload error:", error);
                    alert("Erro ao enviar um ou mais arquivos.");
                  } finally {
                    setIsUploading(false);
                    // Reset input
                    e.target.value = '';
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className={`w-12 h-12 ${isUploading ? 'bg-slate-100' : 'bg-emerald-100'} rounded-full flex items-center justify-center transition-colors`}>
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {isUploading ? 'Enviando arquivos...' : 'Clique para selecionar arquivos'}
                  </p>
                  <p className="text-xs text-slate-500">Imagens, PDFs ou Planilhas (máx. 10MB)</p>
                </div>
              </div>
            </div>

            {/* File List */}
            {content.attachments && content.attachments.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Arquivos Anexados ({content.attachments.length})</h4>
                <div className="grid grid-cols-1 gap-2">
                  {content.attachments.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 group hover:border-emerald-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[200px] sm:max-w-md">{file.name}</span>
                          <span className="text-[10px] text-slate-400">{new Date(file.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newAttachments = content.attachments?.filter(a => a.id !== file.id);
                          handleUpdate('content', 'attachments', newAttachments);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!content.attachments || content.attachments.length === 0) && (
              <div className="mt-6 text-center py-8 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                <p className="text-sm text-slate-400 italic">Nenhum arquivo anexado ainda.</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* STEP 5: CONTA */}
      {currentStep === 5 && (
        <div className="space-y-8 animate-fade-in pt-6">
          {/* HEADER LINE */}
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" /> Destinação do Recurso
            </h3>

            <button
              type="button"
              onClick={() => setIsManagementModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-bold text-[10px] uppercase tracking-widest border border-transparent hover:border-indigo-100"
            >
              <Landmark className="w-3.5 h-3.5" />
              Gerenciar Contas
            </button>
          </div>

          {/* MAIN 50/50 GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

            {/* LEFT SIDE: Information & Current Selection */}
            <div className="space-y-6 py-2">
              <div>
                <h4 className="text-2xl font-black text-slate-800 mb-2 tracking-tight leading-none">Conta do Pedido</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm">
                  O valor desta compra será debitado da conta selecionada ao lado para fins de controle orçamentário.
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Conta Selecionada</span>
                <div className="bg-white p-6 rounded-[1.5rem] border-2 border-emerald-500 shadow-xl shadow-emerald-500/5 flex flex-col items-start gap-4">
                  <div className="flex items-center gap-4 w-full">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <CreditCard className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className={`space-y-0.5 ${!content.selectedAccount ? 'opacity-60 grayscale' : ''}`}>
                      <span className="text-[16px] sm:text-lg font-black text-slate-900 tracking-tight leading-tight block max-w-full truncate">
                        {content.selectedAccount || 'Nenhuma Conta Selecionada'}
                      </span>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">Vinculação Orçamentária (Opcional)</p>
                    </div>
                  </div>
                  {content.selectedAccount ? (
                    <div className="px-2.5 sm:px-3 py-1 bg-emerald-500 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-full shadow-md shadow-emerald-500/10 flex items-center gap-1.5 self-start sm:self-center shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Confirmada
                    </div>
                  ) : (
                    <div className="px-2.5 sm:px-3 py-1 bg-slate-100 text-slate-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-full border border-slate-200 flex items-center gap-1.5 self-start sm:self-center shrink-0">
                      Vazio
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Embedded Selection List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {content.selectedAccount ? 'Clique para Alterar ou Desmarcar' : 'Clique para Selecionar'}
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-1">
                  <Layers className="w-2.5 h-2.5" /> Contas Ativas
                </span>
              </div>
              <AccountSelectionEmbedded
                selectedAccount={content.selectedAccount || ''}
                onSelect={(acc) => handleUpdate('content', 'selectedAccount', acc)}
              />
            </div>
          </div>

          {/* ACCOUNT MANAGEMENT MODAL - Kept here but logic is same */}
          {isManagementModalOpen && (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in cursor-pointer"
              onClick={() => setIsManagementModalOpen(false)}
            >
              <div
                className="bg-slate-50 w-full max-w-6xl h-[85vh] rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden animate-scale-in flex flex-col cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-8 py-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-2xl">
                      <Landmark className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Gestão de Contas</h3>
                      <p className="text-xs font-medium text-slate-400">Visualize, solicite e aprove cadastros de contas</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsManagementModalOpen(false)}
                    className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <AccountManagementTab
                    sectors={sectors}
                    currentUser={currentUser}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 6: ASSINAR (Formerly Conclusão) */}
      {currentStep === 6 && (
        <div className="space-y-4 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Assinatura Digital
          </h3>

          {/* STEP 5 LOGIC: 2FA & Certificate */}
          {/* If Signed, show ONLY the Certificate */}
          {isSigned ? (
            <div className="bg-white p-8 rounded-2xl border-2 border-emerald-500 shadow-xl animate-scale-in relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <ShieldCheck className="w-32 h-32 text-emerald-900" />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                <div className="w-24 h-24 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center p-2">
                  <QrCode className="w-full h-full text-emerald-800 opacity-80" />
                </div>
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <h4 className="text-xl font-bold text-slate-800 flex items-center justify-center sm:justify-start gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    Documento Assinado Digitalmente
                  </h4>
                  <div className="text-sm text-slate-500 space-y-1">
                    <p><strong className="text-slate-700">Assinado por:</strong> {content.digitalSignature?.signerName || content.signatureName}</p>
                    <p><strong className="text-slate-700">Cargo:</strong> {content.digitalSignature?.signerRole || content.signatureRole}</p>
                    <p><strong className="text-slate-700">Data/Hora:</strong> {content.digitalSignature?.date ? new Date(content.digitalSignature.date).toLocaleString() : new Date().toLocaleString()}</p>
                    <p><strong className="text-slate-700">Autenticação:</strong> 2FA (Verificado)</p>
                    <p className="text-xs font-mono text-slate-400 mt-2 pt-2 border-t border-slate-100">
                      ID: {content.digitalSignature?.id || 'PENDING'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 bg-emerald-50/50 p-3 rounded-lg text-center">
                <p className="text-xs text-emerald-700 font-medium flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3" />
                  Este documento está protegido e pronto para processamento.
                </p>
              </div>

              {/* FINALIZATION BUTTON - Only visible after signing */}
              <div className="mt-8 flex justify-center">
                <button
                  disabled={isSubmitting || isLoading || !canFinish}
                  onClick={async () => {
                    if (!isSubmitting && canFinish && onFinish) {
                      setIsSubmitting(true);
                      try {
                        await onFinish();
                      } catch (error) {
                        console.error("Finalização falhou:", error);
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                  }}
                  className={`
                     flex items-center gap-3 px-8 py-4 font-bold rounded-2xl shadow-xl transition-all w-full sm:w-auto justify-center
                     ${isSubmitting || !canFinish ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20 active:scale-95 animate-bounce-short'}
                   `}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm uppercase tracking-widest">Processando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm uppercase tracking-widest">
                        {canFinish ? 'Concluir Pedido' : 'Preencha os campos obrigatórios'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Not Signed Yet - Unified Ready View */
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 text-center animate-fade-in relative overflow-hidden">
              {/* Background Decor */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

              {!showTwoFactor ? (
                <div className="space-y-8 py-2">
                  {/* Title Removed as per user request */}
                  {/* SIGNATURE SELECTION GRID */}

                  {/* SIGNATURE SELECTION GRID */}
                  {allowedSignatures.length > 0 && (
                    <div ref={signaturesGridRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      {sortedSignatures.map((sig) => {
                        const isSelected = content.signatureName === sig.name && content.signatureRole === sig.role;
                        return (
                          <button
                            type="button"
                            key={sig.id}
                            onClick={() => {
                              onUpdate({
                                ...state,
                                content: {
                                  ...state.content,
                                  signatureName: sig.name,
                                  signatureRole: sig.role
                                }
                              });
                            }}
                            className={`
                              relative group flex flex-col items-start p-5 rounded-2xl border-2 transition-all duration-200 text-left
                              ${isSelected
                                ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-500/10 scale-[1.02] z-10'
                                : 'border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-white hover:shadow-md'
                              }
                            `}
                          >
                            <div className={`p-2.5 rounded-xl mb-3 transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 group-hover:text-indigo-600 shadow-sm'}`}>
                              <UserCheck className="w-6 h-6" />
                            </div>

                            <span className={`text-sm font-bold block mb-0.5 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                              {sig.name}
                            </span>
                            <span className={`text-xs font-medium ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                              {sig.role}
                            </span>

                            {isSelected && (
                              <div className="absolute top-4 right-4 text-indigo-600 animate-scale-in">
                                <CheckCircle2 className="w-5 h-5 fill-indigo-600 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(!allowedSignatures || allowedSignatures.length === 0) && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-700 text-sm flex items-center justify-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Nenhuma assinatura disponível para seu usuário.</span>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      ref={signButtonRef}
                      disabled={!content.signatureName}
                      onClick={() => setShowTwoFactor(true)}
                      className={`
                        group relative inline-flex items-center justify-center gap-3 px-10 py-4 font-bold rounded-2xl shadow-xl transition-all duration-300 overflow-hidden
                        ${!content.signatureName
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 text-white shadow-slate-900/30 hover:bg-slate-800 hover:scale-[1.02] active:scale-95'
                        }
                      `}
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      <ShieldCheck className="w-5 h-5" />
                      <span className="text-sm uppercase tracking-widest">Assinar Pedido</span>
                    </button>
                    <p className="text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 opacity-70">
                      <Lock className="w-3 h-3" /> Ambiente Seguro e Criptografado
                    </p>
                  </div>
                </div>
              ) : (
                /* 2FA UI - Centered */
                /* 2FA UI - Centered & Responsive */
                <div className="animate-slide-up w-full max-w-sm mx-auto flex flex-col justify-center min-h-[300px] h-full">
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4 sm:space-y-6 p-2">

                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                      <Key className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                    </div>

                    <div className="text-center">
                      <h4 className="text-base sm:text-lg font-bold text-slate-800">Autenticação 2FA</h4>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1">Digite o código de 6 dígitos</p>
                    </div>

                    <div className="relative w-full max-w-[200px] sm:max-w-[240px]">
                      <input
                        type="text"
                        maxLength={6}
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000 000"
                        autoFocus
                        className="w-full text-center text-2xl sm:text-3xl font-mono font-bold tracking-[0.3em] sm:tracking-[0.5em] py-2 sm:py-3 border-b-4 border-slate-200 focus:border-indigo-600 outline-none bg-transparent transition-colors text-slate-800 placeholder-slate-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full pt-2">
                      <button
                        type="button"
                        onClick={() => setShowTwoFactor(false)}
                        className="px-4 py-3 rounded-xl border-2 border-slate-100 text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-all text-[10px] sm:text-xs uppercase tracking-wide"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={twoFactorCode.length !== 6}
                        onClick={() => {
                          if (twoFactorCode.length === 6) {
                            const sigId = Math.random().toString(36).substr(2, 9);
                            setIsSigned(true);
                            onUpdate({
                              ...state,
                              content: {
                                ...state.content,
                                digitalSignature: {
                                  enabled: true,
                                  method: '2FA_APP',
                                  ip: '192.168.1.100', // Mock
                                  date: new Date().toISOString(),
                                  id: sigId,
                                  signerName: content.signatureName,
                                  signerRole: content.signatureRole
                                }
                              }
                            });

                            // DO NOT TRIGGER FINISH YET - Wait for "Concluir Pedido" click
                            // Logic moved to separate button in Certificate view.
                          }
                        }}
                        className={`
                                    flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wide transition-all shadow-lg
                                    ${twoFactorCode.length === 6
                            ? 'bg-emerald-600 text-white shadow-emerald-500/30 hover:bg-emerald-700 hover:scale-105 active:scale-95'
                            : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}
                                `}
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )
      }
    </div >
  );
};
