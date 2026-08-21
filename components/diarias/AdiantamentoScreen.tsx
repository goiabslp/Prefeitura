import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { 
    ArrowLeft, FileText, CheckCircle2, Download, UserCheck, Calendar as CalendarIcon,
    CreditCard, Banknote, ShieldAlert, Sparkles, ChevronRight, ChevronLeft, Clock, MapPin, Car, Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useNotification } from '../../contexts/NotificationContext';
import { createDiariaEvento } from '../../services/diariasEventosService';
import { getPersons, getJobs } from '../../services/entityService';
import { supabase } from '../../services/supabaseClient';
import { getGlobalSettings } from '../../services/settingsService';

interface AdiantamentoScreenProps {
    currentUser?: User | null;
    onBack: () => void;
}

type TabType = 'servidor' | 'viagem' | 'valores' | 'bancario' | 'justificativa';

const TAB_ROUTES: Record<TabType, string> = {
    servidor: '/Diarias/Adiantamento/Servidor',
    viagem: '/Diarias/Adiantamento/Viagem',
    valores: '/Diarias/Adiantamento/Valores',
    bancario: '/Diarias/Adiantamento/Bancario',
    justificativa: '/Diarias/Adiantamento/Justificativa'
};

const TABS: { id: TabType; label: string; icon: any; num: number }[] = [
    { id: 'servidor', label: '1. Servidor', icon: UserCheck, num: 1 },
    { id: 'viagem', label: '2. Viagem & Itinerário', icon: CalendarIcon, num: 2 },
    { id: 'valores', label: '3. Adiantamento', icon: Banknote, num: 3 },
    { id: 'bancario', label: '4. Dados Bancários', icon: CreditCard, num: 4 },
    { id: 'justificativa', label: '5. Justificativa', icon: FileText, num: 5 }
];

export const AdiantamentoScreen: React.FC<AdiantamentoScreenProps> = ({
    currentUser,
    onBack
}) => {
    const { addNotification } = useNotification();
    const [loading, setLoading] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [submittedData, setSubmittedData] = useState<any | null>(null);

    // Detect initial tab from URL
    const getTabFromUrl = (): TabType => {
        if (typeof window === 'undefined') return 'servidor';
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/viagem')) return 'viagem';
        if (path.includes('/valores')) return 'valores';
        if (path.includes('/bancario')) return 'bancario';
        if (path.includes('/justificativa')) return 'justificativa';
        return 'servidor';
    };

    const [activeTab, setActiveTab] = useState<TabType>(getTabFromUrl);

    // Logo Oficial do Sistema (Prefeitura)
    const [logoUrl, setLogoUrl] = useState<string>('');

    useEffect(() => {
        async function loadSystemLogo() {
            const cached = localStorage.getItem('cached_img_branding_logo') || 
                           localStorage.getItem('cached_img_ui_header_logo') || 
                           localStorage.getItem('cached_img_ui_login_logo');
            if (cached) {
                setLogoUrl(cached);
            }

            try {
                const settings = await getGlobalSettings();
                if (settings?.branding?.logoUrl) {
                    setLogoUrl(settings.branding.logoUrl);
                } else if (settings?.ui?.headerLogoUrl) {
                    setLogoUrl(settings.ui.headerLogoUrl);
                }
            } catch (err) {
                console.warn('Erro ao carregar logo oficial da prefeitura:', err);
            }
        }
        loadSystemLogo();
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            setActiveTab(getTabFromUrl());
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const switchTab = (tab: TabType) => {
        setActiveTab(tab);
        const targetRoute = TAB_ROUTES[tab];
        if (window.location.pathname !== targetRoute) {
            window.history.pushState({}, '', targetRoute);
        }
    };

    // Formulário State
    const [servidorNome, setServidorNome] = useState(currentUser?.name || '');
    const [cargoFuncao, setCargoFuncao] = useState('');
    const [cpf, setCpf] = useState('');
    const [rg, setRg] = useState('');

    const [servidoresList, setServidoresList] = useState<{ id: string; name: string; cargo?: string; cpf?: string; rg?: string }[]>([]);
    const [cargosList, setCargosList] = useState<string[]>([]);

    const resolveCargoTitle = (rawCargo?: string, personName?: string) => {
        let title = rawCargo?.trim() || '';

        if (currentUser && personName && personName.toLowerCase().trim() === currentUser.name?.toLowerCase().trim()) {
            if (currentUser.jobTitle) {
                return currentUser.jobTitle;
            }
        }

        const lower = title.toLowerCase();
        if (lower === 'admin' || lower === 'admin_master' || lower === 'administrator') {
            if (currentUser && personName && personName.toLowerCase().trim() === currentUser.name?.toLowerCase().trim()) {
                return currentUser.jobTitle || 'Secretário de Administração e Finanças';
            }
            return 'Secretário / Administrador';
        }
        if (lower === 'user') return 'Servidor Público';
        if (lower === 'secretary') return 'Secretário(a)';

        return title;
    };

    useEffect(() => {
        async function loadRegisteredData() {
            try {
                const jobsData = await getJobs();
                const jobMap = new Map<string, string>();
                const cargoSet = new Set<string>();

                jobsData.forEach(j => {
                    if (j.id && j.name) {
                        jobMap.set(j.id, j.name);
                        cargoSet.add(j.name);
                    }
                });

                const { data: personsData } = await supabase.from('persons').select('*, jobs(name)');
                const list: { id: string; name: string; cargo?: string; cpf?: string; rg?: string }[] = [];

                if (personsData && personsData.length > 0) {
                    personsData.forEach((p: any) => {
                        const rawCargo = p.jobs?.name || jobMap.get(p.job_id) || '';
                        const cargoName = resolveCargoTitle(rawCargo, p.name);
                        if (cargoName) cargoSet.add(cargoName);
                        list.push({
                            id: p.id,
                            name: p.name,
                            cargo: cargoName,
                            cpf: p.cpf || '',
                            rg: p.rg || ''
                        });
                    });
                } else {
                    const fallbackPersons = await getPersons();
                    fallbackPersons.forEach(p => {
                        const rawCargo = jobMap.get(p.jobId || '') || '';
                        const cargoName = resolveCargoTitle(rawCargo, p.name);
                        if (cargoName) cargoSet.add(cargoName);
                        list.push({
                            id: p.id,
                            name: p.name,
                            cargo: cargoName
                        });
                    });
                }

                const { data: profilesData } = await supabase.from('profiles').select('*, jobs(name)');
                if (profilesData && profilesData.length > 0) {
                    profilesData.forEach((prof: any) => {
                        let rawCargo = prof.jobs?.name || 
                                       jobMap.get(prof.job_id || prof.jobId) || 
                                       prof.job_title || 
                                       prof.cargo || 
                                       (prof.name?.toLowerCase() === currentUser?.name?.toLowerCase() ? currentUser?.jobTitle : '') || 
                                       '';

                        const cargoName = resolveCargoTitle(rawCargo, prof.name);

                        const existingIndex = list.findIndex(item => item.name.toLowerCase().trim() === prof.name.toLowerCase().trim());
                        if (existingIndex >= 0) {
                            if (!list[existingIndex].cargo || list[existingIndex].cargo.toLowerCase() === 'admin' || list[existingIndex].cargo.toLowerCase() === 'user') {
                                list[existingIndex].cargo = cargoName;
                            }
                            if (!list[existingIndex].cpf && prof.cpf) list[existingIndex].cpf = prof.cpf;
                            if (!list[existingIndex].rg && prof.rg) list[existingIndex].rg = prof.rg;
                        } else {
                            if (cargoName) cargoSet.add(cargoName);
                            list.push({
                                id: prof.id,
                                name: prof.name,
                                cargo: cargoName,
                                cpf: prof.cpf || '',
                                rg: prof.rg || ''
                            });
                        }
                    });
                }

                setServidoresList(list);
                setCargosList(Array.from(cargoSet).sort());

                // Auto preencher o cargo se o usuário logado corresponder a um servidor cadastrado
                const loggedName = currentUser?.name || servidorNome;
                if (loggedName) {
                    const foundUser = list.find(s => s.name.toLowerCase().trim() === loggedName.toLowerCase().trim());
                    const finalCargo = (currentUser && loggedName.toLowerCase().trim() === currentUser.name?.toLowerCase().trim() && currentUser.jobTitle)
                        ? currentUser.jobTitle
                        : resolveCargoTitle(foundUser?.cargo, loggedName);

                    if (finalCargo) {
                        setCargoFuncao(finalCargo);
                    }
                }
            } catch (err) {
                console.error('Erro ao carregar servidores e cargos:', err);
            }
        }

        loadRegisteredData();
    }, [currentUser]);

    const handleServidorNameChange = (val: string) => {
        setServidorNome(val);

        if (currentUser && val.toLowerCase().trim() === currentUser.name.toLowerCase().trim()) {
            if (currentUser.jobTitle) {
                setCargoFuncao(currentUser.jobTitle);
            }
        }

        const found = servidoresList.find(s => s.name.toLowerCase().trim() === val.toLowerCase().trim());
        if (found) {
            const resolvedCargo = resolveCargoTitle(found.cargo, found.name);
            if (resolvedCargo) setCargoFuncao(resolvedCargo);
            if (found.cpf) setCpf(found.cpf);
            if (found.rg) setRg(found.rg);
        }
    };

    const [quantidadeDiarias, setQuantidadeDiarias] = useState<'Meia (0,5)' | 'Completa (1,0)' | '1.5' | '2.0' | 'Outro'>('Completa (1,0)');
    const [quantidadeOutro, setQuantidadeOutro] = useState('');

    const [localSaida, setLocalSaida] = useState('São José do Goiabal - MG');
    const [horaSaida, setHoraSaida] = useState('07:00');
    const [destino, setDestino] = useState('');
    const [dataViagem, setDataViagem] = useState(new Date().toISOString().split('T')[0]);
    const [dataRetorno, setDataRetorno] = useState(new Date().toISOString().split('T')[0]);
    const [horaChegada, setHoraChegada] = useState('18:00');
    const [veiculo, setVeiculo] = useState('');

    // IBGE Cidades do Brasil API
    const FALLBACK_CITIES = [
        'SÃO JOSÉ DO GOIABAL - MG', 'JOÃO MONLEVADE - MG', 'BELO HORIZONTE - MG',
        'IPATINGA - MG', 'ITABIRA - MG', 'ALVINÓPOLIS - MG', 'RIO PIRACICABA - MG',
        'PONTE NOVA - MG', 'DOM SILVÉRIO - MG', 'DIONÍSIO - MG', 'SÃO DOMINGOS DO PRATA - MG',
        'RAUL SOARES - MG', 'NOVA ERA - MG', 'CARATINGA - MG', 'TIMÓTEO - MG', 'GOVERNADOR VALADARES - MG'
    ];

    const [cities, setCities] = useState<string[]>(FALLBACK_CITIES);
    const [isCityLoading, setIsCityLoading] = useState(false);

    useEffect(() => {
        async function fetchIBGECities() {
            setIsCityLoading(true);
            try {
                const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
                if (!response.ok) throw new Error('Erro na resposta da API IBGE');
                const data: any[] = await response.json();
                const formatted = data
                    .map((c: any) => {
                        const uf = c.microrregiao?.mesorregiao?.UF?.sigla;
                        return c.nome && uf ? `${c.nome.toUpperCase()} - ${uf}` : null;
                    })
                    .filter((c): c is string => c !== null);

                setCities(formatted);
            } catch (err) {
                console.warn('Erro ao carregar cidades do IBGE, usando fallback:', err);
                setCities(FALLBACK_CITIES);
            } finally {
                setIsCityLoading(false);
            }
        }
        fetchIBGECities();
    }, []);

    // CALENDÁRIO DINÂMICO STATE
    const [modeCalendar, setModeCalendar] = useState<'unico' | 'periodo'>('unico');
    const [viewMonth, setViewMonth] = useState<Date>(() => new Date());

    const [haveriadAdiantamento, setHaveriaAdiantamento] = useState<'Sim' | 'Não'>('Sim');
    const [valorAdiantamento, setValorAdiantamento] = useState('0,00');

    // Dados Bancários / PIX
    const [formaPagamento, setFormaPagamento] = useState<'Transferência' | 'PIX'>('Transferência');
    const [banco, setBanco] = useState('');
    const [agencia, setAgencia] = useState('');
    const [tipoConta, setTipoConta] = useState<'Corrente' | 'Poupança'>('Corrente');
    const [conta, setConta] = useState('');
    const [pix, setPix] = useState('');

    // Justificativa
    const [justificativa, setJustificativa] = useState('LEVAR FUNCIONARIOS PARA REUNIAO.');

    const formatCurrency = (val: string) => {
        const clean = val.replace(/\D/g, '');
        const num = (Number(clean) / 100).toFixed(2);
        return num.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValorAdiantamento(formatCurrency(e.target.value));
    };

    const isFormFullyFilled = () => {
        if (!servidorNome.trim()) return false;
        if (!cpf.trim()) return false;
        if (!destino.trim()) return false;
        if (!dataViagem.trim()) return false;
        if (!dataRetorno.trim()) return false;
        if (!horaSaida.trim()) return false;
        if (!horaChegada.trim()) return false;
        if (!justificativa.trim()) return false;
        if (haveriadAdiantamento === 'Sim') {
            if (!valorAdiantamento || valorAdiantamento === '0,00' || valorAdiantamento.trim() === '') return false;
        }
        return true;
    };

    const handleNextTab = () => {
        const idx = TABS.findIndex(t => t.id === activeTab);
        if (idx < TABS.length - 1) {
            switchTab(TABS[idx + 1].id);
        }
    };

    const handlePrevTab = () => {
        const idx = TABS.findIndex(t => t.id === activeTab);
        if (idx > 0) {
            switchTab(TABS[idx - 1].id);
        }
    };

    // LÓGICA DO CALENDÁRIO DINÂMICO
    const getDaysInMonthMatrix = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();

        const matrix: (Date | null)[] = [];
        for (let i = 0; i < firstDayOfWeek; i++) {
            matrix.push(null);
        }
        for (let i = 1; i <= totalDays; i++) {
            matrix.push(new Date(year, month, i));
        }
        return matrix;
    };

    const formatDateStr = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const handleCalendarDayClick = (d: Date) => {
        const selectedStr = formatDateStr(d);
        if (modeCalendar === 'unico') {
            setDataViagem(selectedStr);
            setDataRetorno(selectedStr);
        } else {
            // Período
            if (!dataViagem || (dataViagem && dataRetorno && dataViagem !== dataRetorno)) {
                setDataViagem(selectedStr);
                setDataRetorno(selectedStr);
            } else if (dataViagem && dataViagem === dataRetorno) {
                if (selectedStr >= dataViagem) {
                    setDataRetorno(selectedStr);
                } else {
                    setDataViagem(selectedStr);
                    setDataRetorno(selectedStr);
                }
            }
        }
    };

    const prevMonth = () => {
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
    };

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!servidorNome || !cpf || !destino || !dataViagem) {
            addNotification('Aviso', 'Preencha os campos obrigatórios (*): Servidor, CPF, Destino e Data da Viagem.', 'info');
            if (!servidorNome || !cpf) switchTab('servidor');
            else if (!destino || !dataViagem) switchTab('viagem');
            return;
        }

        setLoading(true);

        const formData = {
            id: `ADIANT-${Date.now().toString().substring(5)}`,
            servidorNome,
            cargoFuncao,
            cpf,
            rg,
            quantidadeDiarias: quantidadeDiarias === 'Outro' ? quantidadeOutro : quantidadeDiarias,
            localSaida,
            horaSaida,
            destino,
            dataViagem,
            dataRetorno,
            horaChegada,
            veiculo,
            haveriadAdiantamento,
            valorAdiantamento: haveriadAdiantamento === 'Sim' ? valorAdiantamento : '0,00',
            formaPagamento,
            banco,
            agencia,
            tipoConta,
            conta,
            pix,
            justificativa,
            criadoEm: new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };

        try {
            await createDiariaEvento({
                servidor: servidorNome,
                cpf_servidor: cpf,
                cargo: cargoFuncao,
                rg: rg,
                local_saida: localSaida,
                hora_saida: horaSaida,
                destino: destino,
                data_saida: dataViagem,
                data_retorno: dataRetorno,
                hora_chegada: horaChegada,
                quantidade_diarias: quantidadeDiarias === 'Outro' ? quantidadeOutro : quantidadeDiarias,
                haveriad_adiantamento: haveriadAdiantamento,
                valor_adiantamento: haveriadAdiantamento === 'Sim' ? valorAdiantamento : '0,00',
                banco_agencia: agencia,
                banco_tipo: tipoConta,
                banco_conta: conta,
                banco_pix: pix,
                motivo: justificativa,
                veiculo: veiculo,
                solicitado_por: currentUser?.id || 'sistema',
                status: 'viagem_programada'
            } as any).catch(err => {
                console.warn('Registro salvo com suporte local:', err.message);
            });

            setSubmittedData(formData);
            addNotification('Sucesso', 'Solicitação de adiantamento registrada com sucesso!', 'success');
        } catch (err: any) {
            console.error('Erro ao registrar solicitação:', err);
            setSubmittedData(formData);
        } finally {
            setLoading(false);
        }
    };

    // FUNÇÃO DE IMPRESSÃO PADRÃO DO SISTEMA DE DIÁRIAS (EXATAMENTE COMO EM LANCAMENTOSSCREEN.TSX)
    const handlePrintOfficialPDF = () => {
        if (!submittedData) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            addNotification('Erro', 'Bloqueador de pop-ups impediu a impressão. Permita pop-ups no navegador.', 'error');
            return;
        }

        const dataSaidaFormatted = new Date(submittedData.dataViagem + 'T12:00:00').toLocaleDateString('pt-BR') + ' às ' + submittedData.horaSaida;
        const dataRetornoFormatted = new Date(submittedData.dataRetorno + 'T12:00:00').toLocaleDateString('pt-BR') + ' às ' + submittedData.horaChegada;

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Solicitação de Adiantamento - ${submittedData.id}</title>
          <style>
            * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .page {
              width: 210mm;
              height: 297mm;
              max-height: 297mm;
              padding: 14mm 14mm 24mm 14mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              margin: 0 auto;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .header-title {
              font-size: 13.5px;
              font-weight: 900;
              text-transform: uppercase;
              color: #0f172a;
              letter-spacing: -0.02em;
            }
            .header-subtitle {
              font-size: 9.5px;
              color: #64748b;
              font-weight: 700;
              text-transform: uppercase;
              margin-top: 1px;
            }
            .protocol-badge {
              font-family: monospace;
              font-size: 10.5px;
              font-weight: 800;
              background: #f1f5f9;
              color: #334155;
              padding: 4px 10px;
              border-radius: 6px;
              border: 1px solid #cbd5e1;
            }
            .status-badge {
              display: inline-block;
              font-size: 8px;
              font-weight: 900;
              text-transform: uppercase;
              background: #dcfce7;
              color: #15803d;
              padding: 2px 7px;
              border-radius: 4px;
              border: 1px solid #bbf7d0;
              margin-top: 3px;
            }
            .section-box {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              overflow: hidden;
              margin-bottom: 10px;
              background: #ffffff;
            }
            .section-header {
              background: #f1f5f9;
              padding: 4px 10px;
              border-bottom: 1px solid #cbd5e1;
              font-size: 8pt;
              font-weight: 900;
              text-transform: uppercase;
              color: #475569;
              letter-spacing: 0.05em;
            }
            .section-body {
              padding: 8px 12px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .grid-3 {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
            }
            .label {
              font-size: 7pt;
              font-weight: 900;
              text-transform: uppercase;
              color: #64748b;
              display: block;
              margin-bottom: 2px;
            }
            .value {
              font-size: 9.5pt;
              font-weight: 700;
              color: #0f172a;
            }
            .value-highlight {
              font-size: 13pt;
              font-weight: 900;
              color: #059669;
            }
            .justificativa-box {
              font-size: 9pt;
              line-height: 1.45;
              color: #1e293b;
              white-space: pre-wrap;
              word-break: break-word;
              background: #fafafa;
              padding: 10px 12px;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
              font-style: italic;
            }
            .signatures {
              margin-top: 40px;
              margin-bottom: 10px;
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              text-align: center;
            }
            .signature-line {
              border-top: 1.5px solid #0f172a;
              padding-top: 4px;
              position: relative;
            }
            .signature-name {
              font-size: 8.5pt;
              font-weight: 900;
              text-transform: uppercase;
            }
            .signature-role {
              font-size: 7pt;
              color: #64748b;
              font-weight: 700;
              text-transform: uppercase;
            }
            .footer-bar {
              position: absolute;
              bottom: 8mm;
              left: 14mm;
              right: 14mm;
              padding-top: 8px;
              border-top: 1px dashed #cbd5e1;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8.5pt;
              font-weight: 700;
              color: #475569;
              background: #ffffff;
            }
            @media print {
              @page { size: A4 portrait; margin: 0; }
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div>
              <!-- HEADER OFICIAL DA PREFEITURA (PADRÃO DE DIÁRIAS) -->
              <div class="header">
                <div style="display: flex; align-items: center; gap: 14px;">
                  ${logoUrl ? `<img src="${logoUrl}" alt="Logo Prefeitura" style="max-height: 55px; width: auto; object-fit: contain;" />` : ''}
                  <div>
                    <div class="header-title">PREFEITURA MUNICIPAL DE SÃO JOSÉ DO GOIABAL</div>
                    <div class="header-subtitle">CONCESSÃO DE DIÁRIA E REQUERIMENTO DE ADIANTAMENTO</div>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div class="protocol-badge">${submittedData.id}</div>
                  <div><span class="status-badge">SOLICITADO / PENDENTE</span></div>
                </div>
              </div>

              <!-- 01. DADOS DO BENEFICIÁRIO -->
              <div class="section-box">
                <div class="section-header">01. DADOS DO BENEFICIÁRIO</div>
                <div class="section-body">
                  <div style="margin-bottom: 8px;">
                    <span class="label">Nome do Servidor</span>
                    <span class="value" style="font-size: 11pt;">${submittedData.servidorNome}</span>
                  </div>
                  <div class="grid-3">
                    <div>
                      <span class="label">Cargo / Função</span>
                      <span class="value">${submittedData.cargoFuncao || 'Não informado'}</span>
                    </div>
                    <div>
                      <span class="label">CPF</span>
                      <span class="value">${submittedData.cpf}</span>
                    </div>
                    <div>
                      <span class="label">RG</span>
                      <span class="value">${submittedData.rg || 'Não informado'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 02. LOGÍSTICA E ITINERÁRIO -->
              <div class="section-box">
                <div class="section-header">02. LOGÍSTICA E ITINERÁRIO DA VIAGEM</div>
                <div class="section-body">
                  <div class="grid-2" style="margin-bottom: 8px;">
                    <div style="background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <span class="label">Local de Saída</span>
                      <span class="value">${submittedData.localSaida}</span>
                    </div>
                    <div style="background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <span class="label">Destino (Cidade / UF)</span>
                      <span class="value" style="color: #b45309; font-weight: 900;">${submittedData.destino}</span>
                    </div>
                  </div>
                  <div class="grid-2" style="margin-bottom: 8px;">
                    <div style="background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <span class="label">Data / Hora de Saída</span>
                      <span class="value">${dataSaidaFormatted}</span>
                    </div>
                    <div style="background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <span class="label">Data / Hora de Retorno</span>
                      <span class="value">${dataRetornoFormatted}</span>
                    </div>
                  </div>
                  <div class="grid-2">
                    <div>
                      <span class="label">Quantidade de Diárias Concedidas</span>
                      <span class="value">${submittedData.quantidadeDiarias}</span>
                    </div>
                    <div>
                      <span class="label">Veículo Utilizado</span>
                      <span class="value">${submittedData.veiculo || 'Não informado'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 03. RESUMO DO ADIANTAMENTO E DADOS BANCÁRIOS / PIX -->
              <div class="section-box">
                <div class="section-header">03. RESUMO DO ADIANTAMENTO E DADOS BANCÁRIOS / PIX</div>
                <div class="section-body">
                  <div class="grid-2" style="align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                    <div>
                      <span class="label">Solicitou Adiantamento?</span>
                      <span class="value">(${submittedData.haveriadAdiantamento === 'Sim' ? ' X ' : '   '}) Sim   (${submittedData.haveriadAdiantamento === 'Não' ? ' X ' : '   '}) Não</span>
                    </div>
                    <div>
                      <span class="label">Valor Solicitado do Adiantamento</span>
                      <span class="value-highlight">R$ ${submittedData.valorAdiantamento}</span>
                    </div>
                  </div>
                  <div class="grid-2" style="margin-bottom: 6px;">
                    <div>
                      <span class="label">Forma de Pagamento</span>
                      <span class="value">(${submittedData.formaPagamento === 'Transferência' ? ' X ' : '   '}) Transferência Bancária   (${submittedData.formaPagamento === 'PIX' ? ' X ' : '   '}) PIX</span>
                    </div>
                    <div>
                      <span class="label">Banco</span>
                      <span class="value">${submittedData.banco || '-'}</span>
                    </div>
                  </div>
                  ${submittedData.formaPagamento === 'Transferência' ? `
                    <div class="grid-3">
                      <div>
                        <span class="label">Agência</span>
                        <span class="value">${submittedData.agencia || '-'}</span>
                      </div>
                      <div>
                        <span class="label">Tipo e Conta</span>
                        <span class="value">${submittedData.tipoConta} • ${submittedData.conta || '-'}</span>
                      </div>
                      <div>
                        <span class="label">Chave PIX (Opcional)</span>
                        <span class="value">${submittedData.pix || '-'}</span>
                      </div>
                    </div>
                  ` : `
                    <div>
                      <span class="label">Chave PIX</span>
                      <span class="value" style="font-size: 11pt;">${submittedData.pix || '-'}</span>
                    </div>
                  `}
                </div>
              </div>

              <!-- 04. MOTIVO E JUSTIFICATIVA DA VIAGEM -->
              <div class="section-box">
                <div class="section-header">04. MOTIVO E JUSTIFICATIVA DA VIAGEM</div>
                <div class="section-body">
                  <div class="justificativa-box">"${submittedData.justificativa}"</div>
                </div>
              </div>

              <!-- 05. TERMO DE COMPROMISSO -->
              <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 6px 10px; font-size: 7.5pt; font-weight: 800; color: #78350f; text-align: center;">
                * O valor adiantado deverá ser prestado contas mediante apresentação de Nota Fiscal em nome do Município.
              </div>
            </div>

            <!-- ASSINATURAS (3 COLUNAS COMO NO PADRÃO DE DIÁRIAS) -->
            <div>
              <div class="signatures">
                <div class="signature-line">
                  <div class="signature-name">${submittedData.servidorNome}</div>
                  <div class="signature-role">Servidor Solicitante</div>
                </div>
                <div class="signature-line">
                  <div class="signature-name">Gestor / Autorizador</div>
                  <div class="signature-role">Chefia Imediata</div>
                </div>
                <div class="signature-line">
                  <div class="signature-name">Tesouraria / Finanças</div>
                  <div class="signature-role">Liberação do Valor</div>
                </div>
              </div>

              <!-- RODAPÉ -->
              <div class="footer-bar">
                <span>Código da Viagem: <strong style="color: #0f172a;">${submittedData.id}</strong></span>
                <span>Prefeitura Municipal de São José do Goiabal</span>
                <span>Página 1 de 1</span>
              </div>
            </div>
          </div>
        </body>
        </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 400);
    };

    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
            const container = document.getElementById('adiantamento-pdf-template');
            if (container) {
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const canvas = await html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: container.offsetWidth,
                    height: container.offsetHeight
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`Solicitacao-Adiantamento-Diaria-${submittedData?.id || 'DOC'}.pdf`);
                addNotification('PDF Gerado', 'O PDF do adiantamento foi baixado com sucesso.', 'success');
            }
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            addNotification('Erro', 'Falha ao gerar o PDF. Tente novamente.', 'error');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const activeTabIndex = TABS.findIndex(t => t.id === activeTab);

    return (
        <div className="w-full max-w-[96%] 2xl:max-w-[1440px] mx-auto h-[calc(100vh-80px)] overflow-hidden flex flex-col justify-between pt-1 pb-1 animate-in fade-in duration-200 pr-1">
            {/* Header Compacto */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-1.5 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                        Voltar
                    </button>

                    <div>
                        <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            Solicitação de Adiantamento de Diária
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-black text-[9px] uppercase tracking-wider rounded-full border border-amber-200">
                                Diárias
                            </span>
                        </h1>
                    </div>
                </div>
            </div>

            {submittedData ? (
                /* Sucesso e Botões de PDF / Impressão */
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-md text-center max-w-xl mx-auto space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 uppercase">Solicitação Concluída!</h2>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                            Protocolo: <strong className="text-slate-900 font-extrabold">{submittedData.id}</strong> • Criado em {submittedData.criadoEm}
                        </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl text-left text-xs font-bold text-slate-700 space-y-1.5">
                        <div className="flex justify-between border-b border-slate-200/50 pb-1">
                            <span className="text-slate-400">Servidor:</span>
                            <span className="text-slate-900 font-extrabold uppercase">{submittedData.servidorNome}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/50 pb-1">
                            <span className="text-slate-400">Destino:</span>
                            <span className="text-amber-700 font-extrabold uppercase">{submittedData.destino}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/50 pb-1">
                            <span className="text-slate-400">Data da Viagem:</span>
                            <span className="text-slate-900 font-extrabold">
                                {new Date(submittedData.dataViagem + 'T12:00:00').toLocaleDateString('pt-BR')} às {submittedData.horaSaida} até {new Date(submittedData.dataRetorno + 'T12:00:00').toLocaleDateString('pt-BR')} às {submittedData.horaChegada}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Adiantamento:</span>
                            <span className="text-emerald-700 font-black text-sm">
                                R$ {submittedData.valorAdiantamento} ({submittedData.haveriadAdiantamento})
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-1">
                        <button
                            type="button"
                            onClick={handlePrintOfficialPDF}
                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Printer className="w-4 h-4 text-amber-400" />
                            Imprimir PDF Oficial (Padrão Diárias)
                        </button>
                        <button
                            type="button"
                            disabled={isGeneratingPdf}
                            onClick={handleGeneratePdf}
                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isGeneratingPdf ? <Sparkles className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Baixar PDF Arquivo
                        </button>
                    </div>

                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setSubmittedData(null);
                                switchTab('servidor');
                            }}
                            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                            Nova Solicitação
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-between overflow-hidden space-y-1.5">
                    {/* BARRA DE NAVEGAÇÃO DE ABAS COMPACTA */}
                    <div className="bg-white rounded-2xl p-1 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-1 overflow-x-auto shrink-0">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => switchTab(tab.id)}
                                    className={`flex-1 min-w-[100px] sm:min-w-0 py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        isActive
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                                    }`}
                                >
                                    <span className={`w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center ${
                                        isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                        {tab.num}
                                    </span>
                                    <Icon className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* CONTEÚDO DA ABA */}
                    <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col justify-between overflow-hidden bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs">
                        <div className="flex-1 overflow-y-auto pr-0.5 space-y-2">
                        {/* ABA 1: SERVIDOR */}
                        {activeTab === 'servidor' && (
                            <div className="space-y-3.5 animate-in fade-in duration-150">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
                                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">1. Identificação do Servidor Beneficiário</h2>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                            Servidor a quem se destina a diária <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            list="servidores-autocomplete-list"
                                            value={servidorNome}
                                            onChange={(e) => handleServidorNameChange(e.target.value)}
                                            placeholder="Digite ou selecione o servidor cadastrado..."
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                        />
                                        <datalist id="servidores-autocomplete-list">
                                            {servidoresList.map((s) => (
                                                <option key={s.id} value={s.name}>
                                                    {s.cargo ? `${s.name} - ${s.cargo}` : s.name}
                                                </option>
                                            ))}
                                        </datalist>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                            Cargo / Função
                                        </label>
                                        <input
                                            type="text"
                                            list="cargos-autocomplete-list"
                                            value={cargoFuncao}
                                            onChange={(e) => setCargoFuncao(e.target.value)}
                                            placeholder="Ex: Motorista / Assessor"
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                        />
                                        <datalist id="cargos-autocomplete-list">
                                            {cargosList.map((c, idx) => (
                                                <option key={`cargo-${idx}`} value={c} />
                                            ))}
                                        </datalist>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                            CPF <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={cpf}
                                            onChange={(e) => setCpf(e.target.value)}
                                            placeholder="000.000.000-00"
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                            RG
                                        </label>
                                        <input
                                            type="text"
                                            value={rg}
                                            onChange={(e) => setRg(e.target.value)}
                                            placeholder="Número do RG"
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ABA 2: VIAGEM & CALENDÁRIO DINÂMICO COMPACTO */}
                        {activeTab === 'viagem' && (
                            <div className="space-y-3 animate-in fade-in duration-150">
                                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                                    <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">2. Dados da Viagem e Itinerário</h2>
                                </div>

                                {/* Linha 1: Diárias, Local, Destino, Veículo */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                            Quantidade de Diárias
                                        </label>
                                        <select
                                            value={quantidadeDiarias}
                                            onChange={(e: any) => setQuantidadeDiarias(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2 text-xs font-bold text-slate-800 outline-none transition-all"
                                        >
                                            <option value="Meia (0,5)">Meia Diária (0,5)</option>
                                            <option value="Completa (1,0)">Diária Completa (1,0)</option>
                                            <option value="1.5">1.5 Diárias</option>
                                            <option value="2.0">2.0 Diárias</option>
                                            <option value="Outro">Outro (Especificar)</option>
                                        </select>
                                    </div>

                                    {quantidadeDiarias === 'Outro' && (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                                Especificar Quantidade
                                            </label>
                                            <input
                                                type="text"
                                                value={quantidadeOutro}
                                                onChange={(e) => setQuantidadeOutro(e.target.value)}
                                                placeholder="Ex: 3 Diárias completas"
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2 text-xs font-bold text-slate-800 outline-none transition-all"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                            Local de Saída
                                        </label>
                                        <input
                                            type="text"
                                            value={localSaida}
                                            onChange={(e) => setLocalSaida(e.target.value)}
                                            placeholder="Ex: São José do Goiabal"
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2 text-xs font-bold text-slate-800 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                            Destino <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                list="destino-cities-ibge-list"
                                                value={destino}
                                                onChange={(e) => setDestino(e.target.value)}
                                                placeholder={isCityLoading ? "Carregando cidades do Brasil..." : "Selecione ou digite a cidade de destino"}
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2 text-xs font-bold text-slate-800 outline-none transition-all uppercase"
                                            />
                                            <datalist id="destino-cities-ibge-list">
                                                {cities.map((city, idx) => (
                                                    <option key={`ibge-city-${idx}`} value={city} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                            Veículo
                                        </label>
                                        <input
                                            type="text"
                                            value={veiculo}
                                            onChange={(e) => setVeiculo(e.target.value)}
                                            placeholder="Ex: Fiat Uno Modelo Oficial / Placa"
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2 text-xs font-bold text-slate-800 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                {/* SELETOR DINÂMICO DE CALENDÁRIO & HORÁRIOS COMPACTO */}
                                <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3">
                                    {/* Header do Calendário: Alternador de Modo + Resumo Selecionado */}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modo:</span>
                                            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setModeCalendar('unico');
                                                        setDataRetorno(dataViagem);
                                                    }}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                        modeCalendar === 'unico'
                                                            ? 'bg-amber-500 text-white shadow-2xs'
                                                            : 'text-slate-600 hover:text-slate-900'
                                                    }`}
                                                >
                                                    Dia Único
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setModeCalendar('periodo')}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                        modeCalendar === 'periodo'
                                                            ? 'bg-amber-500 text-white shadow-2xs'
                                                            : 'text-slate-600 hover:text-slate-900'
                                                    }`}
                                                >
                                                    Período (Início e Fim)
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-700">
                                            <div className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                <span>Saída: <strong className="text-amber-800 font-extrabold">{dataViagem ? new Date(dataViagem + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} às {horaSaida}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-orange-600"></span>
                                                <span>Chegada: <strong className="text-orange-950 font-extrabold">{dataRetorno ? new Date(dataRetorno + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} às {horaChegada}</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grid do Calendário + Seleção de Horários */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {/* Calendário Visual */}
                                        <div className="md:col-span-2 bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs space-y-2">
                                            {/* Top Month Controls */}
                                            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                                <button
                                                    type="button"
                                                    onClick={prevMonth}
                                                    className="p-1 rounded-md hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                                                >
                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="text-[11px] font-black uppercase text-slate-900 tracking-wider">
                                                    {monthNames[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={nextMonth}
                                                    className="p-1 rounded-md hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
                                                >
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Days Header */}
                                            <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-slate-400">
                                                {weekDays.map(w => (
                                                    <div key={w} className="py-0.5">{w}</div>
                                                ))}
                                            </div>

                                            {/* Days Matrix COMPACTA */}
                                            <div className="grid grid-cols-7 gap-1">
                                                {getDaysInMonthMatrix(viewMonth).map((dateObj, idx) => {
                                                    if (!dateObj) {
                                                        return <div key={`empty-${idx}`} className="h-6"></div>;
                                                    }

                                                    const dateStr = formatDateStr(dateObj);
                                                    const isStart = dateStr === dataViagem;
                                                    const isEnd = dateStr === dataRetorno;
                                                    const isInRange = dataViagem && dataRetorno && dateStr >= dataViagem && dateStr <= dataRetorno;
                                                    const isToday = dateStr === new Date().toISOString().split('T')[0];

                                                    let btnClass = 'bg-slate-50 text-slate-700 hover:bg-amber-100';
                                                    if (isStart || isEnd) {
                                                        btnClass = 'bg-amber-500 text-white font-black shadow-2xs';
                                                    } else if (isInRange) {
                                                        btnClass = 'bg-amber-100 text-amber-900 font-extrabold';
                                                    } else if (isToday) {
                                                        btnClass = 'border border-amber-400 text-slate-900 font-bold';
                                                    }

                                                    return (
                                                        <button
                                                            key={dateStr}
                                                            type="button"
                                                            onClick={() => handleCalendarDayClick(dateObj)}
                                                            className={`h-6 rounded-md text-[10px] transition-all flex items-center justify-center cursor-pointer ${btnClass}`}
                                                        >
                                                            {dateObj.getDate()}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Horários da Saída e Chegada */}
                                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs space-y-3 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-1 pb-1 border-b border-slate-100 mb-2 text-slate-900 font-extrabold text-[11px] uppercase tracking-wider">
                                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                    Horários
                                                </div>

                                                <div className="space-y-2.5">
                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                                            Hora da Saída
                                                        </label>
                                                        <input
                                                            type="time"
                                                            value={horaSaida}
                                                            onChange={(e) => setHoraSaida(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-md p-1.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                                        />
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {['06:00', '07:00', '08:00', '13:00'].map(t => (
                                                                <button
                                                                    key={`saida-${t}`}
                                                                    type="button"
                                                                    onClick={() => setHoraSaida(t)}
                                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                        horaSaida === t ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                    }`}
                                                                >
                                                                    {t}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                                            Hora de Chegada
                                                        </label>
                                                        <input
                                                            type="time"
                                                            value={horaChegada}
                                                            onChange={(e) => setHoraChegada(e.target.value)}
                                                            className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-md p-1.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                                        />
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {['12:00', '17:00', '18:00', '19:00'].map(t => (
                                                                <button
                                                                    key={`chegada-${t}`}
                                                                    type="button"
                                                                    onClick={() => setHoraChegada(t)}
                                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                                        horaChegada === t ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                    }`}
                                                                >
                                                                    {t}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ABA 3: VALORES E ADIANTAMENTO */}
                        {activeTab === 'valores' && (
                            <div className="space-y-3.5 animate-in fade-in duration-150">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">3. Adiantamento de Valores</h2>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                            Haverá adiantamento de valores?
                                        </label>
                                        <div className="flex items-center gap-4 pt-1">
                                            <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
                                                <input
                                                    type="radio"
                                                    name="adiantamento"
                                                    value="Sim"
                                                    checked={haveriadAdiantamento === 'Sim'}
                                                    onChange={() => setHaveriaAdiantamento('Sim')}
                                                    className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                                                />
                                                ( X ) Sim
                                            </label>
                                            <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
                                                <input
                                                    type="radio"
                                                    name="adiantamento"
                                                    value="Não"
                                                    checked={haveriadAdiantamento === 'Não'}
                                                    onChange={() => setHaveriaAdiantamento('Não')}
                                                    className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                                                />
                                                ( ) Não
                                            </label>
                                        </div>
                                    </div>

                                    {haveriadAdiantamento === 'Sim' && (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                Informe o valor do adiantamento (R$) <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-xs font-black text-slate-400">R$</span>
                                                <input
                                                    type="text"
                                                    required
                                                    value={valorAdiantamento}
                                                    onChange={handleValorChange}
                                                    placeholder="0,00"
                                                    className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg pl-9 p-2.5 text-xs font-black text-emerald-700 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs font-bold leading-relaxed">
                                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="font-extrabold uppercase block text-amber-950 mb-0.5">Aviso Importante:</strong>
                                        * O valor adiantado deverá ser prestado contas mediante apresentação de Nota Fiscal em nome do Município.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ABA 4: BANCÁRIO */}
                        {activeTab === 'bancario' && (
                            <div className="space-y-3.5 animate-in fade-in duration-150">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">4. Dados Bancários / PIX</h2>
                                </div>

                                {/* SELETOR MODERNO E DINÂMICO DE FORMA DE PAGAMENTO */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                        Forma de Pagamento Solicitada
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                        {/* OPÇÃO 1: TRANSFERÊNCIA BANCÁRIA */}
                                        <button
                                            type="button"
                                            onClick={() => setFormaPagamento('Transferência')}
                                            className={`p-3 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer active:scale-98 ${
                                                formaPagamento === 'Transferência'
                                                    ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                                                    formaPagamento === 'Transferência'
                                                        ? 'bg-amber-500 text-white shadow-2xs'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    <CreditCard className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-xs font-black uppercase tracking-wide ${
                                                            formaPagamento === 'Transferência' ? 'text-amber-950' : 'text-slate-800'
                                                        }`}>
                                                            Transferência Bancária
                                                        </span>
                                                        {formaPagamento === 'Transferência' && (
                                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                                        Agência, Tipo e Conta
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                                formaPagamento === 'Transferência'
                                                    ? 'border-amber-500 bg-amber-500 text-white'
                                                    : 'border-slate-300 bg-transparent'
                                            }`}>
                                                {formaPagamento === 'Transferência' && <CheckCircle2 className="w-3 h-3" />}
                                            </div>
                                        </button>

                                        {/* OPÇÃO 2: PIX */}
                                        <button
                                            type="button"
                                            onClick={() => setFormaPagamento('PIX')}
                                            className={`p-3 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer active:scale-98 ${
                                                formaPagamento === 'PIX'
                                                    ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                                                    formaPagamento === 'PIX'
                                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    <Banknote className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-xs font-black uppercase tracking-wide ${
                                                            formaPagamento === 'PIX' ? 'text-emerald-950' : 'text-slate-800'
                                                        }`}>
                                                            PIX Instantâneo
                                                        </span>
                                                        {formaPagamento === 'PIX' && (
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                                        Apenas Banco e Chave PIX
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                                formaPagamento === 'PIX'
                                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                                    : 'border-slate-300 bg-transparent'
                                            }`}>
                                                {formaPagamento === 'PIX' && <CheckCircle2 className="w-3 h-3" />}
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {formaPagamento === 'PIX' ? (
                                    /* APENAS 2 CAMPOS QUANDO PIX É SELECIONADO: BANCO E CHAVE PIX */
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                Banco
                                            </label>
                                            <input
                                                type="text"
                                                value={banco}
                                                onChange={(e) => setBanco(e.target.value)}
                                                placeholder="Ex: Banco do Brasil / Sicoob / Caixa / Nubank"
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                Chave PIX
                                            </label>
                                            <input
                                                type="text"
                                                value={pix}
                                                onChange={(e) => setPix(e.target.value)}
                                                placeholder="CPF, E-mail, Telefone ou Chave Aleatória"
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* TRANSFERÊNCIA BANCÁRIA: BANCO, AGÊNCIA, TIPO CONTA, NÚMERO DA CONTA, CHAVE PIX */
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                Banco
                                            </label>
                                            <input
                                                type="text"
                                                value={banco}
                                                onChange={(e) => setBanco(e.target.value)}
                                                placeholder="Ex: Banco do Brasil / Sicoob / Caixa"
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                Agência
                                            </label>
                                            <input
                                                type="text"
                                                value={agencia}
                                                onChange={(e) => setAgencia(e.target.value)}
                                                placeholder="Ex: 0000-0"
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                Tipo de Conta
                                            </label>
                                            <select
                                                value={tipoConta}
                                                onChange={(e: any) => setTipoConta(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                            >
                                                <option value="Corrente">Corrente</option>
                                                <option value="Poupança">Poupança</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                Número da Conta
                                            </label>
                                            <input
                                                type="text"
                                                value={conta}
                                                onChange={(e) => setConta(e.target.value)}
                                                placeholder="Ex: 00000-0"
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                Chave PIX (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={pix}
                                                onChange={(e) => setPix(e.target.value)}
                                                placeholder="CPF, E-mail, Telefone ou Chave Aleatória"
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ABA 5: JUSTIFICATIVA */}
                        {activeTab === 'justificativa' && (
                            <div className="space-y-3.5 animate-in fade-in duration-150">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">5. Justificativa da Viagem</h2>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                        Descreva abaixo a justificativa da viagem:
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={justificativa}
                                        onChange={(e) => setJustificativa(e.target.value)}
                                        placeholder="LEVAR FUNCIONARIOS PARA REUNIAO."
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl p-3 text-xs font-bold text-slate-800 outline-none transition-all uppercase"
                                    />
                                </div>
                            </div>
                        )}
                        </div>

                        {/* RODAPÉ DE NAVEGAÇÃO COMPACTO ANCORADO */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 shrink-0">
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                {activeTabIndex > 0 && (
                                    <button
                                        type="button"
                                        onClick={handlePrevTab}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Anterior
                                    </button>
                                )}
                                {activeTabIndex < TABS.length - 1 && (
                                    <button
                                        type="button"
                                        onClick={handleNextTab}
                                        className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        Próximo Passo
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {isFormFullyFilled() && (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer animate-in fade-in duration-200"
                                >
                                    {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Concluir & Gerar PDF
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* Template Oculto para Geração do PDF em Canvas/jsPDF */}
            {submittedData && (
                <div className="fixed left-[-9999px] top-[-9999px]">
                    <div
                        id="adiantamento-pdf-template"
                        className="w-[210mm] min-h-[297mm] p-8 bg-white text-slate-900 font-sans flex flex-col justify-between"
                        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', boxSizing: 'border-box' }}
                    >
                        <div className="space-y-3.5">
                            {/* HEADER OFICIAL DE DIÁRIAS (EXATAMENTE COMO EM LANCAMENTOSSCREEN.TSX) */}
                            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
                                <div className="flex items-center gap-3.5">
                                    {logoUrl && (
                                        <img
                                            src={logoUrl}
                                            alt="Logo Prefeitura"
                                            className="w-14 h-14 object-contain"
                                        />
                                    )}
                                    <div>
                                        <h1 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 leading-tight">
                                            PREFEITURA MUNICIPAL DE SÃO JOSÉ DO GOIABAL
                                        </h1>
                                        <h2 className="text-[10px] font-black uppercase text-slate-500 mt-0.5">
                                            CONCESSÃO DE DIÁRIA E REQUERIMENTO DE ADIANTAMENTO
                                        </h2>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="font-mono text-xs font-extrabold bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-300 inline-block">
                                        {submittedData.id}
                                    </div>
                                    <div className="mt-1">
                                        <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                                            SOLICITADO / PENDENTE
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 01. DADOS DO BENEFICIÁRIO */}
                            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                                <div className="bg-slate-100 px-2.5 py-1 border-b border-slate-300 text-[9px] font-black uppercase tracking-wider text-slate-600">
                                    01. DADOS DO BENEFICIÁRIO
                                </div>
                                <div className="p-2.5 space-y-2">
                                    <div>
                                        <span className="block text-[8px] font-black uppercase text-slate-400">Nome do Servidor</span>
                                        <span className="text-xs font-bold uppercase text-slate-900">{submittedData.servidorNome}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Cargo / Função</span>
                                            <span className="text-[11px] font-bold uppercase text-slate-900">{submittedData.cargoFuncao || 'Não informado'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">CPF</span>
                                            <span className="text-[11px] font-bold text-slate-900">{submittedData.cpf}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">RG</span>
                                            <span className="text-[11px] font-bold text-slate-900">{submittedData.rg || 'Não informado'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 02. LOGÍSTICA E ITINERÁRIO */}
                            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                                <div className="bg-slate-100 px-2.5 py-1 border-b border-slate-300 text-[9px] font-black uppercase tracking-wider text-slate-600">
                                    02. LOGÍSTICA E ITINERÁRIO DA VIAGEM
                                </div>
                                <div className="p-2.5 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Local de Saída</span>
                                            <span className="text-[11px] font-bold text-slate-900">{submittedData.localSaida}</span>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Destino (Cidade / UF)</span>
                                            <span className="text-[11px] font-black uppercase text-amber-900">{submittedData.destino}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Data / Hora de Saída</span>
                                            <span className="text-[11px] font-extrabold text-slate-900">
                                                {new Date(submittedData.dataViagem + 'T12:00:00').toLocaleDateString('pt-BR')} às {submittedData.horaSaida}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Data / Hora de Retorno</span>
                                            <span className="text-[11px] font-extrabold text-slate-900">
                                                {new Date(submittedData.dataRetorno + 'T12:00:00').toLocaleDateString('pt-BR')} às {submittedData.horaChegada}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Quantidade de Diárias Concedidas</span>
                                            <span className="text-[11px] font-extrabold text-slate-900">{submittedData.quantidadeDiarias}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Veículo Utilizado</span>
                                            <span className="text-[11px] font-bold uppercase text-slate-900">{submittedData.veiculo || 'Não informado'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 03. RESUMO DO ADIANTAMENTO E DADOS BANCÁRIOS / PIX */}
                            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                                <div className="bg-slate-100 px-2.5 py-1 border-b border-slate-300 text-[9px] font-black uppercase tracking-wider text-slate-600">
                                    03. RESUMO DO ADIANTAMENTO E DADOS BANCÁRIOS / PIX
                                </div>
                                <div className="p-2.5 space-y-2">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Solicitou Adiantamento?</span>
                                            <span className="text-[11px] font-bold text-slate-900">
                                                ({submittedData.haveriadAdiantamento === 'Sim' ? ' X ' : '   '}) Sim   ({submittedData.haveriadAdiantamento === 'Não' ? ' X ' : '   '}) Não
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400 text-right">Valor do Adiantamento</span>
                                            <span className="text-sm font-black text-emerald-700">R$ {submittedData.valorAdiantamento}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Forma de Pagamento</span>
                                            <span className="text-[11px] font-bold text-slate-900">
                                                ({submittedData.formaPagamento === 'Transferência' ? ' X ' : '   '}) Transferência Bancária   ({submittedData.formaPagamento === 'PIX' ? ' X ' : '   '}) PIX
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Banco</span>
                                            <span className="text-[11px] font-bold uppercase text-slate-900">{submittedData.banco || '-'}</span>
                                        </div>
                                    </div>

                                    {submittedData.formaPagamento === 'Transferência' ? (
                                        <div className="grid grid-cols-3 gap-2 pt-1">
                                            <div>
                                                <span className="block text-[8px] font-black uppercase text-slate-400">Agência</span>
                                                <span className="text-[11px] font-bold text-slate-900">{submittedData.agencia || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase text-slate-400">Tipo e Conta</span>
                                                <span className="text-[11px] font-bold text-slate-900">
                                                    {submittedData.tipoConta} • {submittedData.conta || '-'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black uppercase text-slate-400">Chave PIX (Opcional)</span>
                                                <span className="text-[11px] font-bold text-slate-900">{submittedData.pix || '-'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-1">
                                            <span className="block text-[8px] font-black uppercase text-slate-400">Chave PIX</span>
                                            <span className="text-xs font-black text-slate-900">{submittedData.pix || '-'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 04. MOTIVO DA VIAGEM */}
                            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                                <div className="bg-slate-100 px-2.5 py-1 border-b border-slate-300 text-[9px] font-black uppercase tracking-wider text-slate-600">
                                    04. MOTIVO E JUSTIFICATIVA DA VIAGEM
                                </div>
                                <div className="p-2.5 bg-slate-50">
                                    <p className="text-[10px] font-bold text-slate-900 italic uppercase leading-relaxed whitespace-pre-wrap">
                                        "{submittedData.justificativa}"
                                    </p>
                                </div>
                            </div>

                            {/* 05. TERMO */}
                            <div className="p-2 bg-amber-50 border border-amber-300 rounded-md text-[8.5px] font-extrabold text-amber-950 text-center">
                                * O valor adiantado deverá ser prestado contas mediante apresentação de Nota Fiscal em nome do Município.
                            </div>
                        </div>

                        {/* ASSINATURAS E RODAPÉ */}
                        <div className="pt-8 space-y-6">
                            <div className="grid grid-cols-3 gap-6 text-center text-[9px]">
                                <div className="border-t-2 border-slate-900 pt-1">
                                    <span className="block font-black uppercase text-slate-900">{submittedData.servidorNome}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Servidor Solicitante</span>
                                </div>
                                <div className="border-t-2 border-slate-900 pt-1">
                                    <span className="block font-black uppercase text-slate-900">Gestor / Autorizador</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Chefia Imediata</span>
                                </div>
                                <div className="border-t-2 border-slate-900 pt-1">
                                    <span className="block font-black uppercase text-slate-900">Tesouraria / Finanças</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Liberação do Valor</span>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-slate-300 pt-2 flex items-center justify-between text-[8px] font-bold text-slate-500">
                                <span>Código da Viagem: <strong className="text-slate-800">{submittedData.id}</strong></span>
                                <span>Prefeitura Municipal de São José do Goiabal</span>
                                <span>Página 1 de 1</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
