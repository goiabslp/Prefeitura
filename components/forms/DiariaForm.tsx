import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Wallet, Banknote, CheckCircle2, FileText, PenTool, ClipboardList,
  User, Briefcase, MapPin, Calendar, Clock, Bed, ShieldCheck, Route,
  DollarSign, MessageSquare, CreditCard, Eye, EyeOff, PlusCircle, Columns,
  Plus, Trash2, Camera, Image as ImageIcon, Search, ChevronDown, Loader2, X, Check,
  UserCheck, Sparkles, Wand2
} from 'lucide-react';
import { AppState, ContentData, Signature, EvidenceItem, Person, Sector, Job, BlockType } from '../../types';
import { getDiariasProtocolCount, incrementDiariasProtocolCount } from '../../services/counterService';
import { SelectionModal } from '../SelectionModal';
import { DateTimePickerModal } from '../DateTimePickerModal';

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

const defaultPromptText = `Instruções para elaboração de parecer de viagem a serviço
Perguntar e registrar:

Nome Completo do Funcionário?
Setor em que está atendendo?
Qual a data de saída?
Qual a data de retorno?
Qual o destino?
Quantos km de distância?
Hora de saída?
Hora de retorno?
Motivo da viagem? (Reservar espaço exclusivo)
Quem autorizou a viagem?
Houve adiantamento?
Quantas noites de hotel?

Analisar a viagem com base na Lei nº 1.084/2017 e Decreto nº 0064/2017:

Verificar período de afastamento (Art. 6º e 7º) para cálculo da diária (integral ou parcial).
Conferir valor da diária conforme Anexo I, considerando cargo, distância e hospedagem.
Para os dias com hospedagem (conforme número de noites), aplicar valor com hospedagem.
Para os dias sem hospedagem, aplicar valor sem hospedagem.
Somar valores separados para obter valor total.
Para motoristas e demais cargos, aplicar Anexo II - Valor Custeio Alimentação e/ou Hospedagem (art.17):

Anexo I — Valores Diárias (Lei 1084/2017, Art. 4º, §1º):
1 – Prefeito e Vice-Prefeito:
Diária Integral (sem hospedagem) = R$350,00
Diária Integral (com hospedagem) = R$600,00
Diária Integral Fora Estado (sem hospedagem) = R$700,00
Diária Integral Fora Estado (com hospedagem) = R$950,00

2 – Secretário Municipal, Órgão Jurídico e Chefes de Departamento:
Diária Integral (sem hospedagem) = R$200,00
Diária Integral (com hospedagem) = R$350,00
Diária Integral Fora Estado (sem hospedagem) = R$400,00
Diária Integral Fora Estado (com hospedagem) = R$550,00

3 – Demais Servidores Públicos Efetivos, Comissionados Contratados, Funções Públicas e Conselheiros Municipais:
Diária Integral (sem hospedagem) = R$80,00
Diária Integral (com hospedagem) = R$120,00
Diária Integral Fora Estado (sem hospedagem) = R$300,00
Diária Integral Fora Estado (com hospedagem) = R$400,00

Anexo II — Valor Custeio Alimentação e/ou Hospedagem (art.17):
1 - Motorista e demais cargos, mínimo de 06 horas e de 30 a 99 km (*)
Custeio Integral (sem hospedagem) = R$40,00
Custeio Integral (com hospedagem) = R$180,00
Custeio Integral fora Estado (sem hospedagem) = NÃO APLICÁVEL
Custeio Integral fora Estado (com hospedagem) = NÃO APLICÁVEL

2 - Motorista e demais cargos acima de 06 horas e acima de 100 km
Custeio Integral (sem hospedagem) = R$80,00
Custeio Integral (com hospedagem) = R$180,00
Custeio Integral fora Estado (sem hospedagem) = NÃO APLICÁVEL
Custeio Integral fora Estado (com hospedagem) = NÃO APLICÁVEL

3 - Motorista e demais cargos em viagem fora do estado
Custeio Integral (sem hospedagem) = NÃO APLICÁVEL
Custeio Integral (com hospedagem) = NÃO APLICÁVEL
Custeio Integral fora Estado (sem hospedagem) = R$300,00
Custeio Integral fora Estado (com hospedagem) = R$450,00

Justificar o valor da diária ou custeio conforme o anexo aplicável.
Confirmar necessidade e oficialidade da viagem com base na solicitação.

Estruturar o parecer com:
Dados da viagem (respostas às perguntas).
Espaço exclusivo para o motivo da viagem.
Análise e justificativa do valor da diária ou custeio.
Referência ao pedido oficial
Informação sobre adiantamento, se houve.
Espaço exclusivo para concluir sobre o valor devido
Espaço exclusivo para o valor devido..

Analise os dados acima e guarde as informações.
Deve montar um relatório de viagem baseado nas respostas e nos dados salvos.
Quero um relatório detalhado e forte.`;

const normalizeText = (text: string) => {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

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
  const [isCityOpen, setIsCityOpen] = useState(false);

  const [isDepartureOpen, setIsDepartureOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);

  const [isAuthorizerOpen, setIsAuthorizerOpen] = useState(false);

  const [isRequesterOpen, setIsRequesterOpen] = useState(false);

  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const authorizerDropdownRef = useRef<HTMLDivElement>(null);
  const requesterDropdownRef = useRef<HTMLDivElement>(null);

  const [isGeneratingIA, setIsGeneratingIA] = useState<{ justificativa: boolean; detalhamento: boolean }>({
    justificativa: false,
    detalhamento: false
  });

  const [isIAPromptModalOpen, setIsIAPromptModalOpen] = useState<{ isOpen: boolean; type: 'justificativa' | 'detalhamento' | null }>({
    isOpen: false,
    type: null
  });

  const [isIADetalhamentoModalOpen, setIsIADetalhamentoModalOpen] = useState(false);
  const [detalhamentoIAState, setDetalhamentoIAState] = useState({
    adiantamento: 'nao' as 'sim' | 'nao',
    valorAdiantamento: '',
    reembolso: 'nao' as 'sim' | 'nao',
    reembolsos: [] as { descricao: string, valor: string }[],
    novaDescricaoReembolso: '',
    novoValorReembolso: ''
  });

  const handleGenerateDetalhamento = () => {
    let detalhamentoContext = content.promptText ? `Motivo/Contexto Base: ${content.promptText}\n\n` : '';
    
    detalhamentoContext += `Houve adiantamento? ${detalhamentoIAState.adiantamento === 'sim' ? `Sim, no valor de R$ ${detalhamentoIAState.valorAdiantamento}` : 'Não'}.\n`;
    
    if (detalhamentoIAState.reembolso === 'sim' && detalhamentoIAState.reembolsos.length > 0) {
      detalhamentoContext += `Houve reembolso? Sim. Itens para reembolso:\n`;
      detalhamentoIAState.reembolsos.forEach(r => {
        detalhamentoContext += `- ${r.descricao}: R$ ${r.valor}\n`;
      });
      // Adiciona um em edição, caso o usuário tenha esquecido de clicar no botão "Mais"
      if (detalhamentoIAState.novaDescricaoReembolso && detalhamentoIAState.novoValorReembolso) {
        detalhamentoContext += `- ${detalhamentoIAState.novaDescricaoReembolso}: R$ ${detalhamentoIAState.novoValorReembolso}\n`;
      }
    } else if (detalhamentoIAState.reembolso === 'sim' && detalhamentoIAState.novaDescricaoReembolso && detalhamentoIAState.novoValorReembolso) {
      detalhamentoContext += `Houve reembolso? Sim. Itens para reembolso:\n- ${detalhamentoIAState.novaDescricaoReembolso}: R$ ${detalhamentoIAState.novoValorReembolso}\n`;
    } else {
      detalhamentoContext += `Houve reembolso? Não.\n`;
    }

    generateAI('detalhamento', detalhamentoContext);
    setIsIADetalhamentoModalOpen(false);
  };

  const generateAI = async (type: 'justificativa' | 'detalhamento', customPromptText?: string) => {
    const textToUse = customPromptText || content.promptText;

    if (!textToUse || textToUse.trim().length === 0) {
      alert("Preencha as informações necessárias antes de utilizar a Inteligência Artificial.");
      return;
    }
    
    setIsGeneratingIA(prev => ({ ...prev, [type]: true }));
    try {
      const payload = {
        tipo: type,
        dados: {
          promptText: textToUse,
          requesterName: content.requesterName || 'Não informado',
          cargo: content.requesterRole || 'Não informado',
          setor: content.requesterSector || 'Não informado',
          modalidade: content.subType || 'Não informado',
          destino: content.destination || 'Não informado',
          saida: content.departureDateTime || 'Não informado',
          retorno: content.returnDateTime || 'Não informado',
          hospedagens: content.lodgingCount || 0,
          distancia: content.distanceKm || 0,
          pagamento: content.paymentForecast || 'Não informado',
          autorizador: content.authorizedBy || 'Não informado',
          justificativa: content.descriptionReason || 'Não informada'
        }
      };
      
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Erro ao gerar conteúdo.");
      const data = await res.json();
      
      if (type === 'justificativa') {
        handleUpdate('content', 'descriptionReason', data.text);
      } else {
        handleUpdate('content', 'extraFieldText', data.text);
        if (!content.showExtraField) {
          handleUpdate('content', 'showExtraField', true);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar conteúdo com IA. Tente novamente.");
    } finally {
      setIsGeneratingIA(prev => ({ ...prev, [type]: false }));
    }
  };

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

  const calculateDistance = async (destinationCity: string) => {
    try {
      if (!destinationCity) return;
      
      const destName = destinationCity.split(' - ')[0].toUpperCase();
      const originName = "SÃO JOSÉ DO GOIABAL";
      
      if (destName === originName) {
         handleUpdate('content', 'distanceKm', 0);
         return;
      }
      
      const predefined: Record<string, number> = {
        'JOÃO MONLEVADE': 45,
        'BELO HORIZONTE': 160,
        'IPATINGA': 110,
        'ITABIRA': 85,
        'ALVINÓPOLIS': 40,
        'RIO PIRACICABA': 25,
        'PONTE NOVA': 75,
        'DOM SILVÉRIO': 35,
        'DIONÍSIO': 15,
        'SÃO DOMINGOS DO PRATA': 30,
        'RAUL SOARES': 45,
        'NOVA ERA': 60,
        'CARATINGA': 130,
        'TIMÓTEO': 90
      };

      if (predefined[destName]) {
         handleUpdate('content', 'distanceKm', predefined[destName]);
         return;
      }

      const fetchCoords = async (cityStr: string) => {
         const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityStr + ', Minas Gerais, Brazil')}`);
         const data = await res.json();
         if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
         }
         return null;
      };

      const originCoords = await fetchCoords(originName);
      const destCoords = await fetchCoords(destName);

      if (originCoords && destCoords) {
         const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`);
         const osrmData = await osrmRes.json();
         if (osrmData.routes && osrmData.routes.length > 0) {
            const distanceMeters = osrmData.routes[0].distance;
            const distanceKm = Math.round(distanceMeters / 1000);
            handleUpdate('content', 'distanceKm', distanceKm);
         }
      }
    } catch (e) {
      console.warn('Failed to calculate distance automatically:', e);
    }
  };

  useEffect(() => {
    if (!content.subType) {
      handleUpdate('content', 'subType', 'diaria');
    }
    if (!content.promptText) {
      handleUpdate('content', 'promptText', defaultPromptText);
    }
  }, []);

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
              <Sparkles className="w-4 h-4 text-indigo-600" /> Contexto para Inteligência Artificial
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Descreva em linguagem natural os detalhes da viagem, motivo, atividades e justificativas. Este texto será utilizado pela IA para gerar automaticamente a Justificativa e o Detalhamento Técnico nos próximos passos.
            </p>
            <div className={inputGroupClass}>
              <textarea
                value={content.promptText || ''}
                onChange={(e) => handleUpdate('content', 'promptText', e.target.value)}
                className={`${inputClass} min-h-[250px] resize-y leading-relaxed`}
                placeholder="Exemplo: Preciso viajar para Belo Horizonte no dia 15/10 às 08h e retorno dia 17/10 às 18h. O motivo é participar do Congresso de Educação, onde apresentarei um projeto sobre inovação tecnológica nas escolas municipais..."
              />
            </div>
          </div>
        </>
      )}

      {currentStep === 2 && (
        <>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-600" /> Modalidade de Requisição
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleDiariaSubTypeChange('diaria')}
            className={`group p-4 rounded-2xl border-2 text-left flex items-center gap-4 transition-all duration-300 ${content.subType === 'diaria' ? 'bg-indigo-50 border-indigo-600 shadow-sm shadow-indigo-600/10' : 'bg-white border-slate-200 hover:border-indigo-300'
              }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${content.subType === 'diaria' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-base text-slate-900 leading-tight">Diária</h4>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Viagens e estadias.</p>
            </div>
            {content.subType === 'diaria' && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
          </button>

          <button
            onClick={() => handleDiariaSubTypeChange('custeio')}
            className={`group p-4 rounded-2xl border-2 text-left flex items-center gap-4 transition-all duration-300 ${content.subType === 'custeio' ? 'bg-indigo-50 border-indigo-600 shadow-sm shadow-indigo-600/10' : 'bg-white border-slate-200 hover:border-indigo-300'
              }`}
          >
            <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${content.subType === 'custeio' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
              <Banknote className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-black text-base text-slate-900 leading-tight">Custeio</h4>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Reembolsos diversos.</p>
            </div>
            {content.subType === 'custeio' && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
          </button>
        </div>
      </div>

      {currentStep === 2 && content.subType && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" /> Dados do Solicitante
            </h3>
            <div className={inputGroupClass}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelClass}><User className="w-3 h-3" /> NOME COMPLETO</label>
                  <div
                    onClick={() => setIsRequesterOpen(true)}
                    className={`${inputClass} flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors bg-white`}
                  >
                    <span className={content.requesterName ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {content.requesterName || 'Clique para selecionar o solicitante...'}
                    </span>
                    <Search className="w-4 h-4 text-indigo-500" />
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{person.name}</p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {jobs.find(j => j.id === person.jobId)?.name || 'Sem cargo'} • {sectors.find(s => s.id === person.sectorId)?.name || 'Sem setor'}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
                      </div>
                    )}
                  />
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

      {currentStep === 3 && (
        <>
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" /> Logística e Período
            </h3>
            <div className={inputGroupClass}>
              <div>
                <label className={labelClass}><MapPin className="w-3 h-3" /> Cidade / UF (Destino)</label>
                <div
                  onClick={() => setIsCityOpen(true)}
                  className={`${inputClass} flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors bg-white`}
                >
                  <span className={content.destination ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                    {content.destination || 'Clique para selecionar o destino...'}
                  </span>
                  {isCityLoading ? (
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 text-indigo-500" />
                  )}
                </div>

                <SelectionModal<string>
                  isOpen={isCityOpen}
                  onClose={() => setIsCityOpen(false)}
                  title="Selecionar Destino"
                  subtitle="Escolha a cidade e estado de destino"
                  options={cities}
                  searchPlaceholder="Buscar cidade..."
                  filterFunction={(city, query) => normalizeText(city).includes(normalizeText(query))}
                  getInternalId={(city) => city}
                  selectedItem={content.destination}
                  onSelect={(city) => {
                    handleUpdate('content', 'destination', city);
                    setIsCityOpen(false);
                    calculateDistance(city);
                  }}
                  renderItem={(city, isSelected) => (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className={`font-medium text-sm ${isSelected ? 'text-indigo-900 font-bold' : 'text-slate-700'}`}>{city}</span>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
                    </div>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}><Calendar className="w-3 h-3" /> Saída</label>
                  <div
                    onClick={() => setIsDepartureOpen(true)}
                    className={`${inputClass} flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors bg-white`}
                  >
                    <span className={content.departureDateTime ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {content.departureDateTime ? new Date(content.departureDateTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Selecionar saída...'}
                    </span>
                    <Calendar className="w-4 h-4 text-indigo-500" />
                  </div>
                  <DateTimePickerModal
                    isOpen={isDepartureOpen}
                    onClose={() => setIsDepartureOpen(false)}
                    title="Data e Hora de Saída"
                    initialDate={content.departureDateTime ? new Date(content.departureDateTime) : undefined}
                    onSelect={(date) => {
                      const tzOffset = date.getTimezoneOffset() * 60000;
                      const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
                      handleUpdate('content', 'departureDateTime', localISOTime);
                    }}
                  />
                </div>
                <div>
                  <label className={labelClass}><Clock className="w-3 h-3" /> Retorno</label>
                  <div
                    onClick={() => setIsReturnOpen(true)}
                    className={`${inputClass} flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors bg-white`}
                  >
                    <span className={content.returnDateTime ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                      {content.returnDateTime ? new Date(content.returnDateTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Selecionar retorno...'}
                    </span>
                    <Clock className="w-4 h-4 text-indigo-500" />
                  </div>
                  <DateTimePickerModal
                    isOpen={isReturnOpen}
                    onClose={() => setIsReturnOpen(false)}
                    title="Data e Hora de Retorno"
                    initialDate={content.returnDateTime ? new Date(content.returnDateTime) : undefined}
                    onSelect={(date) => {
                      const tzOffset = date.getTimezoneOffset() * 60000;
                      const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
                      handleUpdate('content', 'returnDateTime', localISOTime);
                    }}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}><Bed className="w-3 h-3" /> Hospedagens</label>
                  <input
                    type="number" min="0" value={content.lodgingCount || 0}
                    onChange={(e) => handleUpdate('content', 'lodgingCount', Number(e.target.value))}
                    className={`${inputClass} !py-2.5 !px-3`}
                  />
                </div>
                <div>
                  <label className={labelClass}><Route className="w-3 h-3" /> Distância (KM)</label>
                  <input
                    type="number" min="0" value={content.distanceKm || 0}
                    onChange={(e) => handleUpdate('content', 'distanceKm', Number(e.target.value))}
                    className={`${inputClass} !py-2.5 !px-3`}
                  />
                </div>
                <div>
                  <label className={labelClass}><DollarSign className="w-3 h-3" /> Requerido</label>
                  <input
                    type="text" value={content.requestedValue || ''}
                    onChange={handleCurrencyInput}
                    className={`${inputClass} !py-2.5 !px-3 font-bold text-indigo-700`} placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <label className={labelClass}><CreditCard className="w-3 h-3" /> Pagamento</label>
                  <input
                    type="text" value={content.paymentForecast || ''}
                    readOnly
                    className={`${inputClass} !py-2.5 !px-3 bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed`}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}><UserCheck className="w-3 h-3" /> Autorizado Por</label>
                <div
                  onClick={() => setIsAuthorizerOpen(true)}
                  className={`${inputClass} flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-colors bg-white`}
                >
                  <span className={content.authorizedBy ? 'text-slate-900 font-bold' : 'text-slate-400'}>
                    {content.authorizedBy || 'Clique para selecionar o autorizador...'}
                  </span>
                  <Search className="w-4 h-4 text-indigo-500" />
                </div>

                <SelectionModal<Person>
                  isOpen={isAuthorizerOpen}
                  onClose={() => setIsAuthorizerOpen(false)}
                  title="Selecionar Autorizador"
                  subtitle="Escolha quem está autorizando esta solicitação"
                  options={persons}
                  searchPlaceholder="Buscar por nome..."
                  filterFunction={(person, query) => normalizeText(person.name).includes(normalizeText(query))}
                  getInternalId={(person) => person.id}
                  selectedItem={persons.find(p => p.name === content.authorizedBy)}
                  onSelect={(person) => {
                    handleUpdate('content', 'authorizedBy', person.name);
                  }}
                  renderItem={(person, isSelected) => (
                    <div className="flex items-center gap-4 px-4 py-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{person.name}</p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {jobs.find(j => j.id === person.jobId)?.name || 'Sem cargo'}
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {currentStep === 4 && (
        <>
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" /> Justificativa da Viagem
            </h3>
            <div className={inputGroupClass}>
              <div className="flex justify-between items-center mb-1.5">
                <label className={labelClass}><FileText className="w-3 h-3" /> Justificativa Resumida</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsIAPromptModalOpen({ isOpen: true, type: 'justificativa' })}
                    disabled={isGeneratingIA.justificativa}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Gerar Justificativa com IA"
                  >
                    {isGeneratingIA.justificativa ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Gerar com IA
                  </button>
                  <span className={`text-[9px] font-bold ${(content.descriptionReason?.length || 0) >= 500 ? 'text-red-500' : 'text-slate-400'}`}>
                    {(content.descriptionReason?.length || 0)}/500
                  </span>
                </div>
              </div>
              <textarea
                value={content.descriptionReason || ''}
                onChange={(e) => handleUpdate('content', 'descriptionReason', e.target.value)}
                maxLength={500}
                className={`${inputClass} min-h-[120px] resize-none leading-relaxed`}
                placeholder="Descreva o objetivo da viagem (máximo 500 caracteres)..."
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
                <div className="flex justify-between items-center mb-1.5">
                  <label className={labelClass}><FileText className="w-3 h-3" /> Detalhamento</label>
                  <button
                    onClick={() => setIsIADetalhamentoModalOpen(true)}
                    disabled={isGeneratingIA.detalhamento}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Gerar Detalhamento com IA"
                  >
                    {isGeneratingIA.detalhamento ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Gerar com IA
                  </button>
                </div>
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

      {currentStep === 5 && (
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

      {currentStep === 6 && (
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

      {!content.subType && currentStep !== 2 && (
        <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4 bg-white/50">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300"><ClipboardList className="w-8 h-8" /></div>
          <p className="font-bold text-slate-600">Selecione a Modalidade no Passo 1 para continuar.</p>
        </div>
      )}

      {/* IA Prompt Modal */}
      {isIAPromptModalOpen.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsIAPromptModalOpen({ isOpen: false, type: null })} />
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Motivo da Viagem
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Informe detalhadamente o motivo, atividades e justificativas da sua viagem. A Inteligência Artificial usará essas informações para redigir o documento no formato correto.
              </p>
              
              <textarea
                value={content.promptText || ''}
                onChange={(e) => handleUpdate('content', 'promptText', e.target.value)}
                className={`${inputClass} min-h-[150px] resize-y mb-6`}
                placeholder="Exemplo: Viagem para Belo Horizonte no dia 15/10 às 08h e retorno dia 17/10 às 18h. O motivo é participar do Congresso de Educação, onde apresentarei um projeto sobre inovação tecnológica..."
                autoFocus
              />
              
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setIsIAPromptModalOpen({ isOpen: false, type: null })}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (isIAPromptModalOpen.type) {
                      generateAI(isIAPromptModalOpen.type);
                      setIsIAPromptModalOpen({ isOpen: false, type: null });
                    }
                  }}
                  disabled={!content.promptText || content.promptText.trim().length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  <Wand2 className="w-4 h-4" />
                  Gerar Texto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IA Detalhamento Modal */}
      {isIADetalhamentoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsIADetalhamentoModalOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Dados do Detalhamento
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                A Inteligência Artificial precisa de algumas informações adicionais para criar um detalhamento administrativo completo.
              </p>
              
              <div className="space-y-6">
                {/* Adiantamento */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Houve Adiantamento?</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDetalhamentoIAState(prev => ({ ...prev, adiantamento: 'sim' }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${detalhamentoIAState.adiantamento === 'sim' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setDetalhamentoIAState(prev => ({ ...prev, adiantamento: 'nao' }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${detalhamentoIAState.adiantamento === 'nao' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      Não
                    </button>
                  </div>
                  {detalhamentoIAState.adiantamento === 'sim' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <input
                        type="text"
                        placeholder="Valor do Adiantamento (R$)"
                        value={detalhamentoIAState.valorAdiantamento}
                        onChange={(e) => setDetalhamentoIAState(prev => ({ ...prev, valorAdiantamento: e.target.value }))}
                        className={`${inputClass}`}
                      />
                    </div>
                  )}
                </div>

                {/* Reembolso */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Houve Reembolso?</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDetalhamentoIAState(prev => ({ ...prev, reembolso: 'sim' }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${detalhamentoIAState.reembolso === 'sim' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setDetalhamentoIAState(prev => ({ ...prev, reembolso: 'nao' }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${detalhamentoIAState.reembolso === 'nao' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      Não
                    </button>
                  </div>
                  {detalhamentoIAState.reembolso === 'sim' && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      {detalhamentoIAState.reembolsos.map((r, idx) => (
                        <div key={idx} className="flex gap-2 items-center text-sm p-2 bg-white rounded-lg border border-slate-200">
                          <div className="flex-1 font-medium text-slate-700">{r.descricao}</div>
                          <div className="font-bold text-slate-900">R$ {r.valor}</div>
                          <button 
                            onClick={() => {
                              const newR = [...detalhamentoIAState.reembolsos];
                              newR.splice(idx, 1);
                              setDetalhamentoIAState(prev => ({ ...prev, reembolsos: newR }));
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      <div className="flex gap-2 items-start">
                        <input
                          type="text"
                          placeholder="Descrição (Ex: Uber)"
                          value={detalhamentoIAState.novaDescricaoReembolso}
                          onChange={(e) => setDetalhamentoIAState(prev => ({ ...prev, novaDescricaoReembolso: e.target.value }))}
                          className={`${inputClass} flex-1`}
                        />
                        <input
                          type="text"
                          placeholder="Valor R$"
                          value={detalhamentoIAState.novoValorReembolso}
                          onChange={(e) => setDetalhamentoIAState(prev => ({ ...prev, novoValorReembolso: e.target.value }))}
                          className={`${inputClass} w-28`}
                        />
                        <button
                          disabled={!detalhamentoIAState.novaDescricaoReembolso || !detalhamentoIAState.novoValorReembolso}
                          onClick={() => {
                            setDetalhamentoIAState(prev => ({
                              ...prev,
                              reembolsos: [...prev.reembolsos, { descricao: prev.novaDescricaoReembolso, valor: prev.novoValorReembolso }],
                              novaDescricaoReembolso: '',
                              novoValorReembolso: ''
                            }));
                          }}
                          className="p-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl disabled:opacity-50 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 justify-end mt-8">
                <button 
                  onClick={() => setIsIADetalhamentoModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleGenerateDetalhamento}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md hover:shadow-lg"
                >
                  <Wand2 className="w-4 h-4" />
                  Gerar Texto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const HashIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>
);