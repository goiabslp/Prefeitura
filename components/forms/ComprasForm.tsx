
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ShoppingCart, FileText, PenTool, CheckCircle2, Columns,
  Plus, Trash2, Hash, Layers, MessageSquare, AlignLeft,
  Minus, ChevronDown, Package, Archive, Scale, Briefcase, Box, Lock, Key,
  AlertTriangle, ShieldAlert, Zap, Info, User, Search, Check, UserCheck, Paperclip, Upload, ShieldCheck, QrCode, CreditCard, Loader2, Sparkles
} from 'lucide-react';
import { AppState, ContentData, DocumentConfig, Signature, PurchaseItem, Person, Sector, Job, Attachment } from '../../types';
import { uploadFile } from '../../services/storageService';
import { User as UserType } from '../../types';
import { ItemSelectionModal } from '../compras/ItemSelectionModal';
import { SelectionModal } from '../SelectionModal';
import { normalizeText } from '../../utils/stringUtils';
import { X } from 'lucide-react';
import { polishMotivoWithAI } from '../../services/geminiService';
import { recordAuthSuccess, isAuthSessionValid, isAuthPromoDismissedToday } from '../../services/authTimeService';
import { AuthTimePromoModal } from '../modals/AuthTimePromoModal';

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
  isMobile?: boolean;
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
  currentUser,
  isMobile = false
}) => {
  // ORDENAÇÃO ALFABÉTICA DAS ASSINATURAS
  const sortedSignatures = useMemo(() => {
    return [...allowedSignatures].sort((a, b) => a.name.localeCompare(b.name));
  }, [allowedSignatures]);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isRequesterOpen, setIsRequesterOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const signaturesGridRef = useRef<HTMLDivElement>(null);
  const signButtonRef = useRef<HTMLButtonElement>(null);
  const [password, setPassword] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showAuthTimePromo, setShowAuthTimePromo] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSigned, setIsSigned] = useState(!!content.digitalSignature?.enabled);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isItemSelectionOpen, setIsItemSelectionOpen] = useState(false);

  const [isPolishingTitle, setIsPolishingTitle] = useState(false);
  const [isPolishingBody, setIsPolishingBody] = useState(false);

  const handlePolishTitle = async () => {
    if (!content.title || !content.title.trim()) return;
    setIsPolishingTitle(true);
    try {
      const polishedText = await polishMotivoWithAI(content.title);
      if (polishedText) {
        handleUpdate('content', 'title', polishedText);
      }
    } catch (e) {
      console.warn('Erro ao lapidar finalidade do pedido:', e);
    } finally {
      setIsPolishingTitle(false);
    }
  };

  const handlePolishBody = async () => {
    if (!content.body || content.body.trim().length < 100) return;
    setIsPolishingBody(true);
    try {
      const polishedText = await polishMotivoWithAI(content.body);
      if (polishedText) {
        handleUpdate('content', 'body', polishedText);
      }
    } catch (e) {
      console.warn('Erro ao lapidar justificativa do pedido:', e);
    } finally {
      setIsPolishingBody(false);
    }
  };

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

  // AUTO-POPULATE REQUESTER WITH LOGGED IN USER
  useEffect(() => {
    if (currentUser && !content.requesterName) {
      onUpdate(prev => {
        if (prev.content.requesterName) return prev;
        return {
          ...prev,
          content: {
            ...prev.content,
            requesterName: currentUser.name || '',
            requesterRole: currentUser.jobTitle || '',
            requesterSector: currentUser.sector || ''
          }
        };
      });
    }
  }, [currentUser, content.requesterName, onUpdate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Dropdown logic
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
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

  const handlePersonSelect = (personId: string) => {
    const person = persons.find(p => p.id === personId);
    if (person) {
      const job = jobs.find(j => j.id === person.jobId)?.name || '';
      const sector = sectors.find(s => s.id === person.sectorId)?.name || '';

      onUpdate(prev => ({
        ...prev,
        content: {
          ...prev.content,
          requesterName: person.name,
          requesterRole: job,
          requesterSector: sector
        }
      }));
    }
    setIsRequesterOpen(false);
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

      {/* END OF HEAD      {/* STEP 1 (Desktop): DETALHES (Solicitante, Requisição, Justificativa) */}
      {/* STEP 1 (Desktop): DETALHES (Solicitante, Requisição, Prioridade) */}
      {!isMobile && currentStep === 1 && (
        <div className="space-y-5">
          {/* Card 1: Identificação do Solicitante */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" /> Dados do Solicitante
              </h3>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/60">
                Identificação Automática
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {/* Solicitante */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nome Completo</label>
                <div
                  onClick={() => setIsRequesterOpen(true)}
                  className="w-full h-11 bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-500 rounded-xl px-3.5 flex items-center justify-between cursor-pointer transition-all shadow-xs"
                >
                  <span className={content.requesterName ? 'text-xs font-bold text-slate-900 truncate' : 'text-xs font-medium text-slate-400'}>
                    {content.requesterName || 'Selecione o Solicitante...'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                </div>

                <SelectionModal<Person>
                  isOpen={isRequesterOpen}
                  onClose={() => setIsRequesterOpen(false)}
                  title="Selecionar Solicitante"
                  subtitle="Escolha a pessoa que está realizando a solicitação"
                  options={persons}
                  searchPlaceholder="Buscar por nome..."
                  filterFunction={(person, query) => normalizeText(person.name).includes(normalizeText(query))}
                  getInternalId={(person) => person.id}
                  selectedItem={persons.find(p => p.name === content.requesterName)}
                  onSelect={(person) => handlePersonSelect(person.id)}
                  renderItem={(person, isSelected) => (
                    <div className="flex items-center gap-4 px-4 py-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold text-sm ${isSelected ? 'text-emerald-950' : 'text-slate-700'}`}>{person.name}</p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {jobs.find(j => j.id === person.jobId)?.name || 'Sem cargo'} • {sectors.find(s => s.id === person.sectorId)?.name || 'Sem setor'}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>

              {/* Cargo */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Cargo</label>
                <input
                  type="text" value={content.requesterRole || ''}
                  readOnly
                  className="w-full h-11 bg-slate-100/70 border border-slate-200/80 rounded-xl px-3.5 text-xs font-semibold text-slate-700 cursor-not-allowed outline-none truncate"
                  placeholder="Cargo automático"
                />
              </div>

              {/* Setor */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Setor</label>
                <input
                  type="text" value={content.requesterSector || ''}
                  readOnly
                  className="w-full h-11 bg-slate-100/70 border border-slate-200/80 rounded-xl px-3.5 text-xs font-semibold text-slate-700 cursor-not-allowed outline-none truncate"
                  placeholder="Setor automático"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Finalidade e Prioridade do Pedido */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            {/* Header com Finalidade do Pedido à esquerda e Nível de Prioridade à direita na mesma linha */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-600" /> Finalidade do Pedido
              </h3>

              {/* Nível de Prioridade alinhado na mesma linha */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hidden lg:inline">
                  Nível de Prioridade:
                </span>
                <div className="flex bg-slate-100/90 p-1 rounded-xl gap-1 border border-slate-200/60 shrink-0">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = content.priority === opt.value;
                    const selectedColors = {
                      slate: 'bg-slate-900 text-white shadow-xs font-extrabold',
                      indigo: 'bg-indigo-600 text-white shadow-xs font-extrabold',
                      amber: 'bg-amber-500 text-white shadow-xs font-extrabold',
                      rose: 'bg-rose-500 text-white shadow-xs font-extrabold',
                    };

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleUpdate('content', 'priority', opt.value)}
                        className={`
                          flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[10px] uppercase tracking-wider transition-all
                          ${isSelected
                            ? selectedColors[opt.color as keyof typeof selectedColors]
                            : 'text-slate-500 hover:bg-white hover:text-slate-800 font-semibold'}
                        `}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? '' : 'opacity-70'}`} />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Finalidade do Pedido com Label Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Descrição da Finalidade
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePolishTitle}
                    disabled={isPolishingTitle || !content.title?.trim()}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0"
                    title="Melhorar finalidade com IA Gemini"
                  >
                    {isPolishingTitle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Lapidando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Lapidar com IA</span>
                      </>
                    )}
                  </button>

                  <span className={`text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1 border transition-all ${
                    (content.title?.length || 0) >= 100 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {(content.title?.length || 0) >= 100 ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                    )}
                    <span>{content.title?.length || 0} / 100 MÍN.</span>
                  </span>
                </div>
              </div>

              <textarea
                value={content.title || ''}
                onChange={(e) => handleUpdate('content', 'title', e.target.value)}
                disabled={isPolishingTitle}
                rows={3}
                className="w-full min-h-[90px] bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none leading-relaxed disabled:opacity-60"
                placeholder="Descreva de forma detalhada e clara a finalidade deste pedido de compras (mínimo de 100 caracteres)..."
              />
            </div>

            {/* Justificativa de Prioridade (Condicional) */}
            {showPriorityJustification && (
              <div className="p-3.5 bg-rose-50/50 border border-rose-200/80 rounded-xl space-y-2 animate-fade-in">
                <label className="block text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-rose-600" />
                  Justificativa da Prioridade ({content.priority})
                </label>
                <textarea
                  value={content.priorityJustification || ''}
                  onChange={(e) => handleUpdate('content', 'priorityJustification', e.target.value)}
                  rows={2}
                  className="w-full min-h-[70px] bg-white border border-rose-200 rounded-lg p-3 text-xs font-semibold text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all resize-none leading-relaxed"
                  placeholder={`Explique o motivo do pedido ter prioridade ${content.priority}...`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* MOBILE STEP 1: Solicitante */}
      {isMobile && currentStep === 1 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-600" /> Dados do Solicitante
          </h3>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className={labelClass}>NOME COMPLETO</label>
              <div
                onClick={() => setIsRequesterOpen(true)}
                className={`${inputClass} flex items-center justify-between cursor-pointer py-3 hover:border-emerald-500 transition-colors bg-white`}
              >
                <span className={content.requesterName ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                  {content.requesterName || 'Selecione o Solicitante...'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>

              <SelectionModal<Person>
                isOpen={isRequesterOpen}
                onClose={() => setIsRequesterOpen(false)}
                title="Selecionar Solicitante"
                subtitle="Escolha a pessoa que está realizando a solicitação"
                options={persons}
                searchPlaceholder="Buscar por nome..."
                filterFunction={(person, query) => normalizeText(person.name).includes(normalizeText(query))}
                getInternalId={(person) => person.id}
                selectedItem={persons.find(p => p.name === content.requesterName)}
                onSelect={(person) => handlePersonSelect(person.id)}
                renderItem={(person, isSelected) => (
                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${isSelected ? 'text-emerald-950' : 'text-slate-700'}`}>{person.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {jobs.find(j => j.id === person.jobId)?.name || 'Sem cargo'} • {sectors.find(s => s.id === person.sectorId)?.name || 'Sem setor'}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                    )}
                  </div>
                )}
              />
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
      )}

      {/* MOBILE STEP 2: Finalidade */}
      {isMobile && currentStep === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600" /> Finalidade do Pedido
          </h3>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <label className={labelClass}>Finalidade</label>
                  <button
                    type="button"
                    onClick={handlePolishTitle}
                    disabled={isPolishingTitle || !content.title?.trim()}
                    className="px-2 py-0.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1 shadow-xs active:scale-95 shrink-0"
                    title="Melhorar finalidade com IA Gemini"
                  >
                    {isPolishingTitle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Lapidando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Lapidar IA</span>
                      </>
                    )}
                  </button>
                </div>
                <span className={`text-xs font-black tracking-wider uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all duration-300 ${
                  (content.title?.length || 0) >= 100 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm' 
                    : 'bg-rose-100 text-rose-800 border-rose-200 shadow-sm animate-pulse'
                }`}>
                  {(content.title?.length || 0) >= 100 ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  )}
                  <span>{content.title?.length || 0} / 100</span>
                </span>
              </div>
              <div className="relative group">
                <textarea
                  value={content.title || ''}
                  onChange={(e) => handleUpdate('content', 'title', e.target.value)}
                  disabled={isPolishingTitle}
                  className="w-full min-h-[220px] bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all resize-none leading-relaxed disabled:opacity-60"
                  placeholder="Descreva detalhadamente a finalidade do pedido (mínimo de 100 caracteres)..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE STEP 3: Prioridade */}
      {isMobile && currentStep === 3 && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600" /> Nível de Urgência
          </h3>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelClass}>Prioridade</label>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Selecione o nível de urgência</p>
              </div>
              <div className="flex bg-slate-100/80 p-1 rounded-full gap-1 w-full border border-slate-200/50">
                {PRIORITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = content.priority === opt.value;
                  const selectedColors = {
                    slate: 'bg-white text-slate-700 shadow-sm ring-1 ring-black/5',
                    indigo: 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30',
                    amber: 'bg-amber-500 text-white shadow-md shadow-amber-500/30',
                    rose: 'bg-rose-500 text-white shadow-md shadow-rose-500/30',
                  };

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdate('content', 'priority', opt.value)}
                      className={`
                        flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300
                        ${isSelected
                          ? selectedColors[opt.color as keyof typeof selectedColors]
                          : 'text-slate-400 hover:bg-white/50 hover:text-slate-600'}
                      `}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? '' : 'opacity-70'}`} />
                      <span>{opt.label.slice(0, 3)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {showPriorityJustification && (
              <div className="pt-4 animate-slide-up">
                <label className={labelClass}>Justificativa da {content.priority}</label>
                <div className="relative">
                  <textarea
                    value={content.priorityJustification || ''}
                    onChange={(e) => handleUpdate('content', 'priorityJustification', e.target.value)}
                    className={`${inputClass} min-h-[120px] resize-none leading-relaxed p-4 border-rose-100 bg-rose-50/20`}
                    placeholder={`Por que este pedido tem prioridade ${content.priority}?`}
                  />
                  <MessageSquare className="absolute right-3 top-3 w-4 h-4 text-rose-300 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: ITENS DA REQUISIÇÃO */}
      {((!isMobile && currentStep === 2) || (isMobile && currentStep === 4)) && (
        <div className={isMobile ? "w-full bg-white border border-slate-200/80 rounded-3xl shadow-xl p-6 space-y-5 flex flex-col" : "space-y-4 border-t border-slate-200 pt-6"}>
          {isMobile ? (
            <div className="text-center flex flex-col items-center space-y-4 mb-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner border border-emerald-100">
                <ShoppingCart className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Itens do Pedido</h3>
                <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                  Adicione os produtos ou serviços que deseja solicitar.
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-xs rounded-full shadow-2xs">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    {(content.purchaseItems || []).length} {(content.purchaseItems || []).length === 1 ? 'item adicionado' : 'itens adicionados'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-200 flex-wrap gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" /> Itens da Requisição
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total de itens:
                </span>
                <span className="px-3 py-1 bg-emerald-600 text-white font-black text-xs rounded-full shadow-xs flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  {(content.purchaseItems || []).length} {(content.purchaseItems || []).length === 1 ? 'item adicionado' : 'itens adicionados'}
                </span>
              </div>
            </div>
          )}

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
      {((!isMobile && currentStep === 3) || (isMobile && currentStep === 5)) && (
        <div className={isMobile ? "w-full bg-white border border-slate-200/80 rounded-3xl shadow-xl p-6 space-y-5 flex flex-col animate-fade-in" : "space-y-4 border-t border-slate-200 pt-6"}>
          {isMobile ? (
            <div className="text-center flex flex-col items-center space-y-4 mb-2">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                <MessageSquare className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Justificativa da Compra</h3>
                <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                  Forneça o embasamento legal e justificativa pública da necessidade.
                </p>
              </div>
            </div>
          ) : (
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" /> Justificativa do Pedido
            </h3>
          )}
          <div className={isMobile ? "space-y-4 text-left w-full" : "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"}>
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <label className={labelClass}>Descrição da Necessidade</label>
                <button
                  type="button"
                  onClick={handlePolishBody}
                  disabled={isPolishingBody || (content.body?.trim()?.length || 0) < 100}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0 ${
                    (content.body?.trim()?.length || 0) >= 100 && !isPolishingBody
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white cursor-pointer active:scale-95 shadow-emerald-600/20 ring-2 ring-emerald-500/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                  title={(content.body?.trim()?.length || 0) < 100 ? "Digite no mínimo 100 caracteres para desbloquear o acionamento da IA" : "Melhorar justificativa com IA Gemini"}
                >
                  {isPolishingBody ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Lapidando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className={`w-3.5 h-3.5 ${ (content.body?.trim()?.length || 0) >= 100 ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`} />
                      <span>Lapidar IA</span>
                    </>
                  )}
                </button>
              </div>
              <span className={`text-xs font-black tracking-wider uppercase px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all duration-300 ${
                (content.body?.length || 0) >= 400 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm' 
                  : 'bg-rose-100 text-rose-800 border-rose-200 shadow-sm animate-pulse'
              }`}>
                {(content.body?.length || 0) >= 400 ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span>{(content.body?.length || 0)} / 400 caracteres no mínimo</span>
              </span>
            </div>
            <div className="relative">
              <textarea
                value={content.body || ''}
                onChange={(e) => handleUpdate('content', 'body', e.target.value)}
                disabled={isPolishingBody}
                className={`${inputClass} min-h-[300px] resize-none leading-relaxed p-6 text-base disabled:opacity-60`}
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
      {((!isMobile && currentStep === 4) || (isMobile && currentStep === 6)) && (
        <div className={isMobile ? "w-full bg-white border border-slate-200/80 rounded-3xl shadow-xl p-6 space-y-5 flex flex-col animate-fade-in" : "space-y-4 border-t border-slate-200 pt-6"}>
          {isMobile ? (
            <div className="text-center flex flex-col items-center space-y-4 mb-2">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                <Paperclip className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Arquivos Anexos</h3>
                <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                  Adicione orçamentos, cotações ou outros arquivos relevantes (opcional).
                </p>
              </div>
            </div>
          ) : (
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-emerald-600" /> Anexos e Cotações
            </h3>
          )}
          <div className={isMobile ? "space-y-4 text-left w-full" : "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"}>

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

      {/* STEP 5: FICHA */}
      {((!isMobile && currentStep === 5) || (isMobile && currentStep === 7)) && (
        <div className={isMobile ? "w-full bg-white border border-slate-200/80 rounded-3xl shadow-xl p-6 space-y-5 flex flex-col items-center animate-fade-in" : "space-y-8 animate-fade-in pt-6 flex flex-col items-center justify-center min-h-[40vh]"}>
          <div className={isMobile ? "w-full space-y-6" : "w-full max-w-md text-center space-y-6"}>
            <div className="space-y-2 text-center flex flex-col items-center">
              {isMobile ? (
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner mb-2">
                  <CreditCard className="w-7 h-7" />
                </div>
              ) : null}
              <h3 className={isMobile ? "text-xl font-black text-slate-900 tracking-tight" : "text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-3"}>
                {!isMobile && <CreditCard className="w-8 h-8 text-emerald-600" />} Ficha Orçamentária
              </h3>
              <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                Informe a Ficha Orçamentária para a destinação do recurso.
              </p>
            </div>
            
            <div className="space-y-4 w-full">
              <div className={isMobile ? "bg-slate-50 p-6 rounded-2xl border-2 border-slate-200 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/20 shadow-xs transition-all text-left" : "bg-white p-6 rounded-2xl border-2 border-slate-200 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/20 shadow-sm transition-all text-left"}>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  Número da Ficha (Obrigatório)
                </label>
                <input
                  type="text"
                  value={content.fichaOrcamentaria === 'N/A' ? '' : (content.fichaOrcamentaria || '')}
                  onChange={(e) => handleUpdate('content', 'fichaOrcamentaria', e.target.value)}
                  placeholder="Ex: 12345-6"
                  className="w-full text-xl font-bold text-slate-900 placeholder:text-slate-300 border-none p-0 focus:ring-0 bg-transparent outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: ORIGEM */}
      {((!isMobile && currentStep === 6) || (isMobile && currentStep === 8)) && (
        <div className={isMobile ? "w-full bg-white border border-slate-200/80 rounded-3xl shadow-xl p-6 space-y-5 flex flex-col items-center animate-fade-in" : "space-y-8 animate-fade-in pt-6 flex flex-col items-center justify-center min-h-[40vh]"}>
          <div className={isMobile ? "w-full space-y-6" : "w-full max-w-lg text-center space-y-6"}>
            <div className="space-y-2 text-center flex flex-col items-center">
              {isMobile ? (
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner mb-2">
                  <FileText className="w-7 h-7" />
                </div>
              ) : null}
              <h3 className={isMobile ? "text-xl font-black text-slate-900 tracking-tight" : "text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-3"}>
                {!isMobile && <FileText className="w-8 h-8 text-indigo-600" />} Origem do Pedido
              </h3>
              <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                Selecione a origem e informe o número correspondente.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdate('content', 'resolucaoDescricao', 'Emenda');
                    if (content.resolucaoDescricao === 'N/A') handleUpdate('content', 'resolucaoNumero', '');
                  }}
                  className={`py-3 px-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 border-2 ${content.resolucaoDescricao === 'Emenda' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <FileText className="w-4 h-4" /> Emenda
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdate('content', 'resolucaoDescricao', 'Resolução');
                    if (content.resolucaoDescricao === 'N/A') handleUpdate('content', 'resolucaoNumero', '');
                  }}
                  className={`py-3 px-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 border-2 ${content.resolucaoDescricao === 'Resolução' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <FileText className="w-4 h-4" /> Resolução
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdate('content', 'resolucaoDescricao', 'N/A');
                    handleUpdate('content', 'resolucaoNumero', '');
                  }}
                  className={`py-3 px-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 border-2 ${content.resolucaoDescricao === 'N/A' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <Minus className="w-4 h-4" /> N/A
                </button>
              </div>

              {content.resolucaoDescricao && content.resolucaoDescricao !== 'N/A' && (
                <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all text-left animate-in fade-in slide-in-from-top-4">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Número da {content.resolucaoDescricao}
                  </label>
                  <input
                    type="number"
                    value={content.resolucaoNumero || ''}
                    onChange={(e) => handleUpdate('content', 'resolucaoNumero', e.target.value)}
                    placeholder={`Número da ${content.resolucaoDescricao}`}
                    className="w-full text-xl font-bold text-slate-900 placeholder:text-slate-300 border-none p-0 focus:ring-0 bg-transparent outline-none"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 7: ASSINAR (Formerly Conclusão) */}
      {((!isMobile && currentStep === 7) || (isMobile && currentStep === 9)) && (
        <div className={isMobile ? "w-full bg-white border border-slate-200/80 rounded-3xl shadow-xl p-6 space-y-5 flex flex-col animate-fade-in" : "space-y-4 border-t border-slate-200 pt-6"}>
          {isMobile ? (
            <div className="text-center flex flex-col items-center space-y-4 mb-2">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Assinatura Digital</h3>
                <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                  Revise os dados e assine digitalmente para finalizar o pedido.
                </p>
              </div>
            </div>
          ) : (
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Assinatura Digital
            </h3>
          )}

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
                      onClick={() => {
                        if (isAuthSessionValid()) {
                          const sigId = Math.random().toString(36).substr(2, 9);
                          setIsSigned(true);
                          onUpdate({
                            ...state,
                            content: {
                              ...state.content,
                              digitalSignature: {
                                enabled: true,
                                method: '2FA_SESSION_TIME',
                                ip: '192.168.1.100',
                                date: new Date().toISOString(),
                                id: sigId,
                                signerName: content.signatureName,
                                signerRole: content.signatureRole
                              }
                            }
                          });
                        } else if (!isAuthPromoDismissedToday()) {
                          setShowAuthTimePromo(true);
                        } else {
                          setShowTwoFactor(true);
                        }
                      }}
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
                            recordAuthSuccess();
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

          {/* AuthTimePromoModal para sugestão de tempo antes de assinar */}
          {showAuthTimePromo && (
            <AuthTimePromoModal
              isOpen={showAuthTimePromo}
              onClose={() => {
                setShowAuthTimePromo(false);
                setShowTwoFactor(true);
              }}
              onSuccessAuthorized={() => {
                setShowAuthTimePromo(false);
                const sigId = Math.random().toString(36).substr(2, 9);
                setIsSigned(true);
                onUpdate({
                  ...state,
                  content: {
                    ...state.content,
                    digitalSignature: {
                      enabled: true,
                      method: '2FA_SESSION_TIME',
                      ip: '192.168.1.100',
                      date: new Date().toISOString(),
                      id: sigId,
                      signerName: content.signatureName,
                      signerRole: content.signatureRole
                    }
                  }
                });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
