import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Wallet, Banknote, CheckCircle2, FileText, PenTool, ClipboardList,
  User, Briefcase, MapPin, Calendar, Clock, Bed, ShieldCheck, Route,
  DollarSign, MessageSquare, CreditCard, Eye, EyeOff, PlusCircle, Columns,
  Plus, Trash2, Camera, Image as ImageIcon, Search, ChevronDown, Loader2, X, Check,
  UserCheck
} from 'lucide-react';
import { AppState, ContentData, Signature, EvidenceItem, Person, Sector, Job, BlockType } from '../../types';
import { getDiariasProtocolCount, incrementDiariasProtocolCount } from '../../services/counterService';

interface DiariaFormProps {
  state: AppState;
  content: ContentData;
  allowedSignatures: Signature[];
  handleUpdate: (section: keyof AppState, key: string, value: any) => void;
  onUpdate: React.Dispatch<React.SetStateAction<AppState>>;
  persons: Person[];
  sectors: Sector[];
  jobs: Job[];
  activeBlock: BlockType | null;
  currentStep?: number;
  onFinish?: () => Promise<boolean | void> | void;
  canFinish?: boolean;
  isLoading?: boolean;
}

interface IBGECity {
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string;
      }
    }
  }
}

// Fallback de cidades caso a API do IBGE falhe
const FALLBACK_CITIES = [
  'SÃO JOSÉ DO GOIABAL - MG', 'JOÃO MONLEVADE - MG', 'BELO HORIZONTE - MG',
  'IPATINGA - MG', 'ITABIRA - MG', 'ALVINÓPOLIS - MG', 'RIO PIRACICABA - MG',
  'PONTE NOVA - MG', 'DOM SILVÉRIO - MG', 'DIONÍSIO - MG', 'SÃO DOMINGOS DO PRATA - MG',
  'RAUL SOARES - MG', 'NOVA ERA - MG', 'CARATINGA - MG', 'TIMÓTEO - MG'
];

export const DiariaForm: React.FC<DiariaFormProps> = ({
  state,
  content,
  allowedSignatures,
  handleUpdate,
  onUpdate,
  persons,
  sectors,
  jobs,
  activeBlock,
  currentStep = 1,
  onFinish,
  canFinish,
  isLoading
}) => {
  const [cities, setCities] = useState<string[]>([]);
  const [isCityLoading, setIsCityLoading] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [isCityOpen, setIsCityOpen] = useState(false);

  const [isAuthorizerOpen, setIsAuthorizerOpen] = useState(false);
  const [authorizerSearch, setAuthorizerSearch] = useState('');

  const [isRequesterOpen, setIsRequesterOpen] = useState(false);
  const [requesterSearch, setRequesterSearch] = useState('');

  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const authorizerDropdownRef = useRef<HTMLDivElement>(null);
  const requesterDropdownRef = useRef<HTMLDivElement>(null);

  // Carregar cidades do IBGE com Tratamento de Erro e Fallback
  useEffect(() => {
    const fetchCities = async () => {
      setIsCityLoading(true);
      try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
        if (!response.ok) throw new Error("Erro na resposta da API");

        const data: IBGECity[] = await response.json();

        const formattedCities = data
          .map(city => {
            const uf = city.microrregiao?.mesorregiao?.UF?.sigla;
            if (city.nome && uf) {
              return `${city.nome.toUpperCase()} - ${uf}`;
            }
            return null;
          })
          .filter((city): city is string => city !== null);

        setCities(formattedCities);
      } catch (error) {
        console.warn("Usando fallback de cidades devido a erro na API IBGE:", error);
        setCities(FALLBACK_CITIES);
      } finally {
        setIsCityLoading(false);
      }
    };
    fetchCities();
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityOpen(false);
      }
      if (authorizerDropdownRef.current && !authorizerDropdownRef.current.contains(event.target as Node)) {
        setIsAuthorizerOpen(false);
      }
      if (requesterDropdownRef.current && !requesterDropdownRef.current.contains(event.target as Node)) {
        setIsRequesterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Função de normalização de texto (remove acentos, pontuação e lowercase)
  const normalizeText = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^\w\s]|_/g, "") // Remove pontuação
      .toLowerCase();
  };

  const filteredCities = useMemo(() => {
    let list = [...cities];
    if (citySearch) {
      const term = normalizeText(citySearch);
      list = list.filter(city => normalizeText(city).includes(term));
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [cities, citySearch]);

  const filteredAuthors = useMemo(() => {
    const term = authorizerSearch.toLowerCase();
    return persons
      .filter(p => p.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, authorizerSearch]);

  const filteredRequesters = useMemo(() => {
    const term = requesterSearch.toLowerCase();
    return persons
      .filter(p => p.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, requesterSearch]);

  const calculatePaymentForecast = () => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 2;
    if (month > 12) {
      month = 1;
      year++;
    }
    return `10/${month.toString().padStart(2, '0')}/${year}`;
  };

  useEffect(() => {
    if (content.subType && activeBlock === 'diarias') {
      if (!content.paymentForecast) {
        handleUpdate('content', 'paymentForecast', calculatePaymentForecast());
      }
      if (state.document.showSignature) {
        handleUpdate('document', 'showSignature', false);
      }
      if (content.showDiariaSignatures === undefined) {
        handleUpdate('content', 'showDiariaSignatures', true);
      }
      if (content.showExtraField === undefined) {
        handleUpdate('content', 'showExtraField', true);
      }
      if (content.evidenceItems === undefined) {
        handleUpdate('content', 'evidenceItems', []);
      }
      if (!state.document.showLeftBlock) {
        handleUpdate('document', 'showLeftBlock', true);
      }
    }
  }, [content.subType, activeBlock, handleUpdate, state.document.showSignature, content.showDiariaSignatures, content.showExtraField]);

  // Auto-reparo do Cargo (requesterRole) com base no Nome (requesterName)
  useEffect(() => {
    if (content.requesterName && persons.length > 0) {
      const person = persons.find(p => p.name === content.requesterName);
      if (person) {
        const job = jobs.find(j => j.id === person.jobId)?.name || '';
        if (job && content.requesterRole !== job) {
          handleUpdate('content', 'requesterRole', job);
        }
      }
    }
  }, [content.requesterName, content.requesterRole, persons, jobs, handleUpdate]);

  const formatCurrency = (value: string) => {
    const cleanValue = value.replace(/\D/g, "");
    const numericValue = (Number(cleanValue) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return numericValue;
  };

  const handleCurrencyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    handleUpdate('content', 'requestedValue', formatted);
  };

  const handleDiariaSubTypeChange = async (type: 'diaria' | 'custeio') => {
    const newTitle = type === 'diaria' ? 'Requisição de Diária' : 'Requisição de Custeio';
    const currentYear = new Date().getFullYear();

    let protocolString = content.protocol;

    // Increment only if not already assigned
    if (!protocolString) {
      const count = await incrementDiariasProtocolCount(currentYear);
      const formattedNum = (count || 1).toString().padStart(3, '0');
      protocolString = `DIA-${formattedNum}/${currentYear}`;
    }

    const protocolText = `Solicitação Nº: ${protocolString}`;

    onUpdate(prev => ({
      ...prev,
      content: {
        ...prev.content,
        subType: type,
        title: newTitle,
        protocol: protocolString, // Persist the assigned protocol
        leftBlockText: protocolText,
        paymentForecast: calculatePaymentForecast(),
        showDiariaSignatures: true,
        showExtraField: true,
        evidenceItems: [],
        body: ''
      },
      document: {
        ...prev.document,
        showSignature: false,
        showLeftBlock: true
      }
    }));
  };

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
    } else {
      onUpdate(prev => ({
        ...prev,
        content: {
          ...prev.content,
          requesterName: '',
          requesterRole: '',
          requesterSector: ''
        }
      }));
    }
    setIsRequesterOpen(false);
    setRequesterSearch('');
  };

  const addEvidence = () => {
    const items = [...(content.evidenceItems || [])];
    items.push({ title: '', imageUrl: '' });
    handleUpdate('content', 'evidenceItems', items);
  };

  const removeEvidence = (index: number) => {
    const items = [...(content.evidenceItems || [])];
    items.splice(index, 1);
    handleUpdate('content', 'evidenceItems', items);
  };

  const updateEvidence = (index: number, key: keyof EvidenceItem, value: string) => {
    const items = [...(content.evidenceItems || [])];
    items[index] = { ...items[index], [key]: value };
    handleUpdate('content', 'evidenceItems', items);
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateEvidence(index, 'imageUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const inputGroupClass = "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4";
  const labelClass = "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5";
  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all";

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {currentStep === 1 && (
        <>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-600" /> Modalidade de Requisição
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleDiariaSubTypeChange('diaria')}
            className={`group p-6 rounded-3xl border-2 text-left transition-all duration-300 ${content.subType === 'diaria' ? 'bg-indigo-50 border-indigo-600 shadow-lg shadow-indigo-600/10' : 'bg-white border-slate-100 hover:border-indigo-300'
              }`}
          >
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl transition-colors ${content.subType === 'diaria' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                <Wallet className="w-6 h-6" />
              </div>
              {content.subType === 'diaria' && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
            </div>
            <h4 className="mt-4 font-black text-lg text-slate-900">Diária</h4>
            <p className="text-xs text-slate-500 font-medium">Viagens e estadias.</p>
          </button>

          <button
            onClick={() => handleDiariaSubTypeChange('custeio')}
            className={`group p-6 rounded-3xl border-2 text-left transition-all duration-300 ${content.subType === 'custeio' ? 'bg-indigo-50 border-indigo-600 shadow-lg shadow-indigo-600/10' : 'bg-white border-slate-100 hover:border-indigo-300'
              }`}
          >
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl transition-colors ${content.subType === 'custeio' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                <Banknote className="w-6 h-6" />
              </div>
              {content.subType === 'custeio' && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
            </div>
            <h4 className="mt-4 font-black text-lg text-slate-900">Custeio</h4>
            <p className="text-xs text-slate-500 font-medium">Reembolsos diversos.</p>
          </button>
        </div>
      </div>

      {currentStep === 1 && content.subType && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" /> Dados do Solicitante
            </h3>
            <div className={inputGroupClass}>
              <div className="grid grid-cols-1 gap-4">
                <div className="relative" ref={requesterDropdownRef}>
                  <label className={labelClass}><User className="w-3 h-3" /> NOME COMPLETO</label>
                  <div
                    onClick={() => setIsRequesterOpen(!isRequesterOpen)}
                    className={`${inputClass} flex items-center justify-between cursor-pointer ${isRequesterOpen ? 'border-indigo-500 ring-4 ring-indigo-500/5 bg-white' : ''}`}
                  >
                    <span className={content.requesterName ? 'text-slate-900' : 'text-slate-400'}>
                      {content.requesterName || 'Selecione o Solicitante...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isRequesterOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isRequesterOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                      <div className="p-3 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                          <input
                            type="text"
                            value={requesterSearch}
                            onChange={(e) => setRequesterSearch(e.target.value)}
                            placeholder="Pesquisar pessoa..."
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all"
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
                              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-indigo-50 text-left text-sm font-medium text-slate-700 transition-colors group"
                            >
                              <div className="flex flex-col">
                                <span className="group-hover:text-indigo-700">{person.name}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {jobs.find(j => j.id === person.jobId)?.name || 'N/A'} • {sectors.find(s => s.id === person.sectorId)?.name || 'N/A'}
                                </span>
                              </div>
                              {content.requesterName === person.name && <Check className="w-4 h-4 text-indigo-600" />}
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
                    <label className={labelClass}><Briefcase className="w-3 h-3" /> Cargo</label>
                    <input
                      type="text" value={content.requesterRole || ''}
                      readOnly
                      className={`${inputClass} bg-slate-100/50 cursor-not-allowed text-slate-500`}
                      placeholder="Cargo automático"
                    />
                  </div>
                  <div>
                    <label className={labelClass}><ShieldCheck className="w-3 h-3" /> Setor de Atendimento</label>
                    <input
                      type="text"
                      value={content.requesterSector || ''}
                      onChange={(e) => handleUpdate('content', 'requesterSector', e.target.value)}
                      className={inputClass}
                      placeholder="Setor de atendimento do solicitante"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {currentStep === 2 && (
        <>
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" /> Logística e Período
            </h3>
            <div className={inputGroupClass}>
              <div className="relative" ref={cityDropdownRef}>
                <label className={labelClass}><MapPin className="w-3 h-3" /> Cidade / UF (Destino)</label>
                <div
                  onClick={() => setIsCityOpen(!isCityOpen)}
                  className={`${inputClass} flex items-center justify-between cursor-pointer ${isCityOpen ? 'border-indigo-500 ring-4 ring-indigo-500/5 bg-white' : ''}`}
                >
                  <span className={content.destination ? 'text-slate-900' : 'text-slate-400'}>
                    {content.destination || 'Selecione a cidade de destino...'}
                  </span>
                  {isCityLoading ? (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  ) : (
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCityOpen ? 'rotate-180' : ''}`} />
                  )}
                </div>

                {isCityOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                    <div className="p-3 border-b border-slate-100 bg-slate-50">
                      <div className="relative">
                        <input
                          type="text"
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          placeholder="Pesquisar cidade..."
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        {citySearch && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setCitySearch(''); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                      {filteredCities.length > 0 ? (
                        filteredCities.map((city, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdate('content', 'destination', city);
                              setIsCityOpen(false);
                              setCitySearch('');
                            }}
                            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-indigo-50 text-left text-sm font-medium text-slate-700 transition-colors group"
                          >
                            <span className="group-hover:text-indigo-700">{city}</span>
                            {content.destination === city && <Check className="w-4 h-4 text-indigo-600" />}
                          </button>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <MapPin className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-xs text-slate-400 font-medium">Nenhuma cidade encontrada.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}><Calendar className="w-3 h-3" /> Saída</label>
                  <input
                    type="datetime-local" value={content.departureDateTime || ''}
                    onChange={(e) => handleUpdate('content', 'departureDateTime', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}><Clock className="w-3 h-3" /> Retorno</label>
                  <input
                    type="datetime-local" value={content.returnDateTime || ''}
                    onChange={(e) => handleUpdate('content', 'returnDateTime', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-600" /> Custos e Prazos
            </h3>
            <div className={inputGroupClass}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}><Bed className="w-3 h-3" /> Hospedagens</label>
                  <input
                    type="number" min="0" value={content.lodgingCount || 0}
                    onChange={(e) => handleUpdate('content', 'lodgingCount', Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}><Route className="w-3 h-3" /> Distância (KM)</label>
                  <input
                    type="number" min="0" value={content.distanceKm || 0}
                    onChange={(e) => handleUpdate('content', 'distanceKm', Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}><DollarSign className="w-3 h-3" /> Valor Requerido</label>
                  <input
                    type="text" value={content.requestedValue || ''}
                    onChange={handleCurrencyInput}
                    className={`${inputClass} font-bold text-indigo-700`} placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <label className={labelClass}><CreditCard className="w-3 h-3" /> Previsão de Pagamento</label>
                  <input
                    type="text" value={content.paymentForecast || ''}
                    readOnly
                    className={`${inputClass} bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed`}
                  />
                </div>
              </div>

              {/* CAMPO AUTORIZADO POR - AGORA DINÂMICO E ORDENADO */}
              <div className="relative" ref={authorizerDropdownRef}>
                <label className={labelClass}><UserCheck className="w-3 h-3" /> Autorizado Por</label>
                <div
                  onClick={() => setIsAuthorizerOpen(!isAuthorizerOpen)}
                  className={`${inputClass} flex items-center justify-between cursor-pointer ${isAuthorizerOpen ? 'border-indigo-500 ring-4 ring-indigo-500/5 bg-white' : ''}`}
                >
                  <span className={content.authorizedBy ? 'text-slate-900' : 'text-slate-400'}>
                    {content.authorizedBy || 'Selecione o autorizador...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAuthorizerOpen ? 'rotate-180' : ''}`} />
                </div>

                {isAuthorizerOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                    <div className="p-3 border-b border-slate-100 bg-slate-50">
                      <div className="relative">
                        <input
                          type="text"
                          value={authorizerSearch}
                          onChange={(e) => setAuthorizerSearch(e.target.value)}
                          placeholder="Pesquisar pessoa..."
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                      {filteredAuthors.length > 0 ? (
                        filteredAuthors.map((person, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdate('content', 'authorizedBy', person.name);
                              setIsAuthorizerOpen(false);
                              setAuthorizerSearch('');
                            }}
                            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-indigo-50 text-left text-sm font-medium text-slate-700 transition-colors group"
                          >
                            <div className="flex flex-col">
                              <span className="group-hover:text-indigo-700">{person.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">{jobs.find(j => j.id === person.jobId)?.name || 'N/A'}</span>
                            </div>
                            {content.authorizedBy === person.name && <Check className="w-4 h-4 text-indigo-600" />}
                          </button>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <User className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-xs text-slate-400 font-medium">Pessoa não cadastrada.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {currentStep === 3 && (
        <>
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" /> Justificativa da Viagem
            </h3>
            <div className={inputGroupClass}>
              <div className="flex justify-between items-center mb-1.5">
                <label className={labelClass}><FileText className="w-3 h-3" /> Justificativa Resumida</label>
                <span className={`text-[9px] font-bold ${(content.descriptionReason?.length || 0) >= 365 ? 'text-red-500' : 'text-slate-400'}`}>
                  {(content.descriptionReason?.length || 0)}/365
                </span>
              </div>
              <textarea
                value={content.descriptionReason || ''}
                onChange={(e) => handleUpdate('content', 'descriptionReason', e.target.value)}
                maxLength={365}
                className={`${inputClass} min-h-[120px] resize-none leading-relaxed`}
                placeholder="Descreva o objetivo da viagem (máximo 365 caracteres)..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-slate-600" /> Informações Adicionais
              </h3>
              <button
                onClick={() => handleUpdate('content', 'showExtraField', !content.showExtraField)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${content.showExtraField === true
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
              >
                {content.showExtraField === true ? <><Eye className="w-3 h-3" /> Ativado</> : <><EyeOff className="w-3 h-3" /> Desativado</>}
              </button>
            </div>

            {content.showExtraField && (
              <div className={`${inputGroupClass} animate-fade-in`}>
                <label className={labelClass}><FileText className="w-3 h-3" /> Detalhamento</label>
                <textarea
                  value={content.extraFieldText || ''}
                  onChange={(e) => handleUpdate('content', 'extraFieldText', e.target.value)}
                  className={`${inputClass} min-h-[200px] resize-none leading-relaxed bg-indigo-50/10`}
                  placeholder="Este conteúdo fluirá automaticamente para as páginas seguintes se for muito extenso..."
                />
                <p className="text-[9px] text-slate-400 font-medium italic">O conteúdo acima será paginado automaticamente a partir da Página 2.</p>
              </div>
            )}
          </div>
        </>
      )}

      {currentStep === 4 && (
        <>
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600" /> Comprovantes
              </h3>
              <button
                onClick={addEvidence}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all"
              >
                <Plus className="w-3 h-3" /> Adicionar Evidência
              </button>
            </div>

            <div className="space-y-4">
              {(content.evidenceItems || []).map((item, index) => (
                <div key={index} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className={labelClass}>Título da Evidência</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateEvidence(index, 'title', e.target.value)}
                          className={inputClass}
                          placeholder="Ex: Foto do Evento, Recibo de Pedágio..."
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative group">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="Evidência" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-300" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => handleImageUpload(index, e)}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-slate-400 font-medium mb-2 leading-tight">Clique no ícone ao lado para carregar uma imagem comprobatória.</p>
                          <button
                            onClick={() => removeEvidence(index)}
                            className="text-red-500 hover:text-red-700 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Remover Item
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {(!content.evidenceItems || content.evidenceItems.length === 0) && (
                <div className="p-8 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                  <p className="text-xs text-slate-400 font-medium italic">Nenhuma evidência adicionada. Use o botão "+" para anexar fotos.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {currentStep === 5 && (
        <>
          <div className="space-y-4 pt-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2"><PenTool className="w-4 h-4" /> Autorização Final</h3>
              <button
                onClick={() => handleUpdate('content', 'showDiariaSignatures', !content.showDiariaSignatures)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${content.showDiariaSignatures !== false
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
              >
                {content.showDiariaSignatures !== false ? <><Eye className="w-3 h-3" /> Assinaturas Visíveis</> : <><EyeOff className="w-3 h-3" /> Assinaturas Ocultas</>}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {allowedSignatures.sort((a, b) => a.name.localeCompare(b.name)).map((sig) => {
                const isSelected = content.signatureName === sig.name;
                return (
                  <button
                    key={sig.id}
                    onClick={() => onUpdate(prev => ({ ...prev, content: { ...prev.content, signatureName: sig.name, signatureRole: sig.role, signatureSector: sig.sector } }))}
                    className={`text-left p-4 rounded-2xl border transition-all duration-300 ${isSelected ? 'bg-indigo-50 border-indigo-500 shadow-md' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{sig.name}</p>
                        <p className="text-[10px] uppercase font-medium text-slate-500 tracking-wider">{sig.role}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Opção de Assinatura Digital */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Assinar Digitalmente</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={content.useDigitalSignature || false}
                  onChange={(e) => handleUpdate('content', 'useDigitalSignature', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            
            {/* Show local Finalizar button in case they need to click it here, like ComprasForm has */}
            <div className="pt-8">
              <button
                onClick={onFinish}
                disabled={isLoading || !canFinish}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Finalizando...</> : <><CheckCircle2 className="w-5 h-5" /> Finalizar Pedido de {content.subType === 'diaria' ? 'Diária' : 'Custeio'}</>}
              </button>
            </div>
          </div>
        </>
      )}

      {!content.subType && currentStep !== 1 && (
        <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4 bg-white/50">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300"><ClipboardList className="w-8 h-8" /></div>
          <p className="font-bold text-slate-600">Selecione a Modalidade no Passo 1 para continuar.</p>
        </div>
      )}
    </div>
  );
};

const HashIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>
);