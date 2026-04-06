import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ProcessStepper } from '../common/ProcessStepper';
import { TwoFactorModal } from '../TwoFactorModal';
import { ModernSelect } from '../common/ModernSelect';
import { Loader2, Plus, Trash2, UploadCloud, File, Image as ImageIcon, Camera, Mic, Video, ArrowLeft, CheckCircle2, Calendar, Clock } from 'lucide-react';
import { Sector } from '../../types';
import { MarketingAlertModal, MarketingAlertModalProps } from './MarketingAlertModal';

interface NovoConteudoStepperProps {
    onNavigate: (view: string) => void;
    onBack: () => void;
    userId: string;
    userName: string;
    sectors: Sector[];
    activeStep?: number;
}

interface ContentItem {
    id: string;
    type: string;
    sector: string;
    location: string;
}

export const NovoConteudoStepper: React.FC<NovoConteudoStepperProps> = ({
    onNavigate,
    onBack,
    userId,
    userName,
    sectors,
    activeStep
}) => {
    const STEPS = ['Informações', 'Descrição', 'Conteúdo', 'Anexos', 'Assinatura'];
    const [currentStep, setCurrentStep] = useState(0);
    const [maxCompletedStep, setMaxCompletedStep] = useState(-1);

    // Form State
    const [requesterSector, setRequesterSector] = useState('');
    const [contentTitle, setContentTitle] = useState('');
    const [description, setDescription] = useState('');
    const [contents, setContents] = useState<ContentItem[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    
    // Event Range State
    const [eventStartDate, setEventStartDate] = useState('');
    const [eventEndDate, setEventEndDate] = useState('');
    const [eventStartTime, setEventStartTime] = useState('');
    const [eventEndTime, setEventEndTime] = useState('');

    // Content Add Modal State
    const [isContentModalOpen, setIsContentModalOpen] = useState(false);
    const [editingContent, setEditingContent] = useState<ContentItem | null>(null);

    // Auth & Submit State
    const [userSecret, setUserSecret] = useState<string | null>(null);
    const [userSecret2, setUserSecret2] = useState<string | null>(null);
    const [is2FAOpen, setIs2FAOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState<MarketingAlertModalProps>({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false }))
    });

    const showAlert = (type: MarketingAlertModalProps['type'], title: string, message: string, onConfirm?: () => void, showCancel?: boolean, confirmText?: string, cancelText?: string) => {
        setAlertConfig({
            isOpen: true,
            type,
            title,
            message,
            onConfirm,
            showCancel,
            confirmText: confirmText || 'OK',
            cancelText: cancelText || 'Cancelar',
            onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false }))
        });
    };

    // Load user sector and 2FA secrets
    useEffect(() => {
        const fetchUserData = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('sector, two_factor_secret, two_factor_secret_2')
                .eq('id', userId)
                .single();

            if (data) {
                setRequesterSector(data.sector || '');
                setUserSecret(data.two_factor_secret);
                setUserSecret2(data.two_factor_secret_2);
            }
        };
        fetchUserData();
    }, [userId]);
 
    useEffect(() => {
        if (activeStep !== undefined) {
            setCurrentStep(activeStep);
            if (activeStep > maxCompletedStep) setMaxCompletedStep(activeStep - 1);
        }
    }, [activeStep]);

    const handleNext = () => {
        // Validation per step
        if (currentStep === 0 && !requesterSector) return showAlert('error', 'Atenção', 'Setor do solicitante não definido.');
        if (currentStep === 0 && !contentTitle.trim()) return showAlert('error', 'Campo Obrigatório', 'O Título do Conteúdo é obrigatório.');
        if (currentStep === 1 && description.trim().length < 10) return showAlert('error', 'Descrição Curta', 'A descrição da demanda deve ter ao menos 10 caracteres para que possamos entender sua necessidade.');
        if (currentStep === 2) {
            const hasInvalidContent = contents.some(c => !c.type || !c.sector);
            if (hasInvalidContent) {
                return showAlert('warning', 'Campos Pendentes', 'Preencha os campos obrigatórios de todos os itens de conteúdo (Tipo e Setor) antes de prosseguir.');
            }
        }

        if (currentStep > maxCompletedStep) {
            setMaxCompletedStep(currentStep);
        }
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    };

    const handlePrev = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    const removeContent = (id: string) => {
        showAlert(
            'warning',
            'Remover Item?',
            'Tem certeza que deseja remover este item de conteúdo da sua lista? Esta ação não pode ser desfeita.',
            () => {
                setContents(contents.filter(c => c.id !== id));
                setAlertConfig(prev => ({ ...prev, isOpen: false }));
            },
            true,
            'Sim, Remover',
            'Cancelar'
        );
    };

    const handleOpenModal = (item?: ContentItem) => {
        if (item) {
            setEditingContent(item);
        } else {
            setEditingContent({ id: Date.now().toString(), type: '', sector: '', location: '' });
        }
        setIsContentModalOpen(true);
    };

    const handleSaveContent = () => {
        if (!editingContent) return;
        if (!editingContent.type || !editingContent.sector) {
            showAlert('error', 'Preencha os Dados', 'Para salvar, é necessário preencher todos os campos obrigatórios: Tipo de Conteúdo e Setor Alvo.');
            return;
        }

        const isEditing = contents.some(c => c.id === editingContent.id);
        if (isEditing) {
            setContents(contents.map(c => c.id === editingContent.id ? editingContent : c));
        } else {
            // Prepend new content so it appears at the top of the list in the builder
            setContents([editingContent, ...contents]);
        }
        setIsContentModalOpen(false);
        setEditingContent(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles([...files, ...Array.from(e.target.files)]);
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        setFiles(newFiles);
    };

    const handleFinalizeClick = () => {
        if (!userSecret && !userSecret2) {
            showAlert('error', 'Segurança Necessária', 'Você não tem autenticação de dois fatores configurada no seu perfil. Entre em contato com o administrador do sistema para habilitar antes de assinar documentos.');
            return;
        }
        setIs2FAOpen(true);
    };

    const submitOrder = async () => {
        setIs2FAOpen(false);
        setSubmitting(true);

        try {
            // 1. Create Request - Using a timestamp-based protocol for natural ordering
            const now = new Date();
            const datePart = now.getFullYear().toString() + 
                             (now.getMonth() + 1).toString().padStart(2, '0') + 
                             now.getDate().toString().padStart(2, '0');
            const timePart = now.getHours().toString().padStart(2, '0') + 
                             now.getMinutes().toString().padStart(2, '0');
            const randomPart = (Math.random() * 900 + 100).toFixed(0); // 3 digit random for safety
            
            const protocol = `MKT-${datePart}${timePart}-${randomPart}`;
            const { data: requestDef, error: reqError } = await supabase
                .from('marketing_requests')
                .insert([{
                    protocol,
                    requester_name: userName,
                    requester_sector: requesterSector,
                    description: `**Título do Pedido:** ${contentTitle}\n**Data de Início:** ${eventStartDate || 'N/A'}\n**Data de Fim:** ${eventEndDate || 'N/A'}\n**Hora de Início:** ${eventStartTime || 'N/A'}\n**Hora de Fim:** ${eventEndTime || 'N/A'}\n\n**Descrição Detalhada:**\n${description}`,
                    user_id: userId,
                    status: 'Em Análise',
                    digital_signature: { enabled: true, date: new Date().toISOString() }
                }])
                .select()
                .single();

            if (reqError) throw reqError;

            // 2. Create Contents
            const contentInserts = contents.map(c => ({
                request_id: requestDef.id,
                content_type: c.type,
                content_sector: c.sector,
                event_location: c.location
            }));

            const { error: contentError } = await supabase
                .from('marketing_contents')
                .insert(contentInserts);

            if (contentError) throw contentError;

            // 3. Upload Files
            for (const file of files) {
                const ext = file.name.split('.').pop();
                const path = `${requestDef.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                await supabase.storage.from('marketing_attachments').upload(path, file);
            }

            showAlert('success', 'Pedido Enviado!', 'Sua solicitação de marketing foi finalizada com sucesso e já está em análise.', () => {
                setAlertConfig(prev => ({ ...prev, isOpen: false }));
                onNavigate(''); // Go back to dashboard
            }, false, 'Fechar Aba');

        } catch (error) {
            console.error("Erro ao enviar pedido:", error);
            showAlert('error', 'Oops, ocorreu um erro!', 'Não foi possível finalizar o pedido de marketing neste momento. Tente novamente mais tarde.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-2.5 flex items-center shadow-sm z-10 shrink-0 gap-3 md:gap-4 overflow-hidden">
                <button
                    onClick={onBack}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all border border-slate-200 shrink-0"
                    title="Sair"
                >
                    <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                </button>

                <h1 className="text-base md:text-xl font-black text-slate-800 tracking-tight shrink-0 whitespace-nowrap">
                    <span className="hidden sm:inline">Novo Pedido de Marketing</span>
                    <span className="sm:hidden">Novo Pedido</span>
                </h1>

                <div id="tour-stepper" className="flex-1 min-w-0 pr-2">
                    <div className="w-full">
                        <ProcessStepper
                            compact
                            steps={STEPS}
                            currentStep={currentStep}
                            maxCompletedStep={maxCompletedStep}
                            onStepClick={(i) => {
                                if (i <= maxCompletedStep + 1) setCurrentStep(i);
                            }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {currentStep < STEPS.length - 1 ? (
                        <button
                            onClick={handleNext}
                            disabled={submitting}
                            className="px-4 md:px-6 py-1.5 md:py-2 bg-indigo-600 text-xs md:text-sm text-white font-bold rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow shadow-indigo-200 transition-all outline-none whitespace-nowrap"
                        >
                            Próxima Etapa
                        </button>
                    ) : null}
                </div>
            </header>

            {/* Stepper Content Body */}
            <div className="flex-1 overflow-hidden p-4 md:p-6 flex flex-col min-h-0">
                <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm p-4 md:p-6 flex flex-col flex-1 min-h-0">

                    {currentStep === 0 && (
                        <div id="tour-info-fields" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <h2 className="text-xl font-bold text-slate-800">1. Informações Gerais</h2>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Título do Conteúdo *</label>
                                <input
                                    type="text"
                                    value={contentTitle}
                                    onChange={e => setContentTitle(e.target.value)}
                                    placeholder="Ex: Campanha de Conscientização..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:font-normal"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Solicitante</label>
                                    <input type="text" value={userName} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-600 cursor-not-allowed outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Setor do Solicitante</label>
                                    <input type="text" value={requesterSector} readOnly className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-600 cursor-not-allowed outline-none" placeholder="Aguardando carregamento..." />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 1 && (
                        <div id="tour-description-fields" className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300 min-h-0">
                            <div className="shrink-0 mb-6">
                                <h2 className="text-xl font-bold text-slate-800">2. Detalhes da Demanda</h2>
                                <p className="text-sm text-slate-500 mt-1">Defina o período do evento e descreva sua necessidade.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 shrink-0">
                                {/* Date Range */}
                                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-2 text-indigo-600 mb-1">
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-xs font-black uppercase tracking-widest">Período do Evento</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Data de Início</label>
                                            <input
                                                type="date"
                                                value={eventStartDate}
                                                onChange={e => setEventStartDate(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Data de Fim</label>
                                            <input
                                                type="date"
                                                value={eventEndDate}
                                                onChange={e => setEventEndDate(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Time Range */}
                                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-2 text-amber-600 mb-1">
                                        <Clock className="w-4 h-4" />
                                        <span className="text-xs font-black uppercase tracking-widest">Horário do Evento</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Hora de Início</label>
                                            <input
                                                type="time"
                                                value={eventStartTime}
                                                onChange={e => setEventStartTime(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Hora de Fim</label>
                                            <input
                                                type="time"
                                                value={eventEndTime}
                                                onChange={e => setEventEndTime(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0 min-h-[300px]">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Descrição Detalhada *</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full flex-1 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-shadow text-slate-700 custom-scrollbar"
                                    placeholder="Digite aqui a descrição detalhada do pedido..."
                                />
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div id="tour-content-items" className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0 gap-3">
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold text-slate-800">3. Conteúdos Necessários</h2>
                                    <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">Adicione os itens que farão parte deste pedido</p>
                                </div>
                                <button
                                    onClick={() => handleOpenModal()}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors text-xs md:text-sm shadow-sm"
                                >
                                    <Plus className="w-4 h-4" /> Adicionar Item
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 min-h-0">
                                {contents.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center shrink-0">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                                            <File className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-700 mb-1">Nenhum item adicionado</h3>
                                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                                            Clique no botão acima para adicionar o primeiro item de conteúdo deste pedido.
                                        </p>
                                    </div>
                                ) : (
                                    contents.map((item, index) => (
                                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group gap-4 shrink-0">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 rounded uppercase tracking-wider text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100/50">
                                                        {item.type}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm sm:text-base truncate">{contentTitle || 'Conteúdo Sem Título'}</h4>
                                                <p className="text-[10px] sm:text-xs text-slate-500 truncate mt-0.5">Setor Alvo: <span className="font-semibold text-slate-700">{item.sector}</span></p>
                                            </div>

                                            <div className="flex items-center sm:self-center self-end gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleOpenModal(item)}
                                                    className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => removeContent(item.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                                    title="Remover item"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div id="tour-attachments" className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-0">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2 md:pb-4 mb-4 shrink-0">
                                <h2 className="text-lg md:text-xl font-bold text-slate-800">4. Anexos Adicionais</h2>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-300 transition-colors shrink-0">
                                    <UploadCloud className="w-10 h-10 text-indigo-400 mb-3" />
                                    <h3 className="text-base font-bold text-slate-700 mb-1">Arraste seus arquivos aqui</h3>
                                    <p className="text-xs text-slate-500 mb-4">PDF, Docx, Jpeg, Png ou Mp4 (Max 10MB)</p>

                                    <label className="px-5 py-2 md:px-6 md:py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm">
                                        Selecionar Arquivos
                                        <input type="file" multiple onChange={handleFileChange} className="hidden" />
                                    </label>
                                </div>

                                {files.length > 0 && (
                                    <div className="bg-slate-50 rounded-xl p-3 md:p-4 border border-slate-200 shrink-0">
                                        <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Arquivos Selecionados</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {files.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                            {file.type.includes('image') ? <ImageIcon size={16} /> : file.type.includes('video') ? <Video size={16} /> : <File size={16} />}
                                                        </div>
                                                        <div className="truncate">
                                                            <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                                                            <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removeFile(idx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div id="tour-signature" className="flex flex-col items-center justify-center h-full animate-in fade-in slide-in-from-bottom-2 duration-300 min-h-0">
                            <div className="text-center pb-4 md:pb-6 border-b border-slate-100 max-w-sm w-full mx-auto shrink-0">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600 ring-8 ring-emerald-50 shrink-0">
                                    <CheckCircle2 className="w-8 h-8 md:w-10 md:h-10" />
                                </div>
                                <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-2">Quase lá!</h2>
                                <p className="text-xs md:text-sm text-slate-500">Sua solicitação está pronta para ser enviada. Assine digitalmente para finalizar.</p>

                                <div className="mt-8 flex justify-center w-full">
                                    <button
                                        onClick={handleFinalizeClick}
                                        disabled={submitting}
                                        className="px-8 py-3.5 bg-emerald-600 text-base text-white font-black rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0 outline-none flex items-center justify-center min-w-[240px] gap-3"
                                    >
                                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Assinar'}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-amber-50 rounded-xl p-3 md:p-5 border border-amber-200 w-full max-w-sm mx-auto mt-4 shrink-0">
                                <h3 className="text-xs md:text-sm font-bold text-amber-800 mb-1">Atenção ao assinar:</h3>
                                <p className="text-[10px] md:text-xs text-amber-700">O pedido entrará em status <strong>Em Análise</strong> automaticamente e não poderá ser alterado.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Content Modal */}
            {isContentModalOpen && editingContent && (
                <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">
                                {contents.some(c => c.id === editingContent.id) ? 'Editar Conteúdo' : 'Adicionar Conteúdo'}
                            </h3>
                            <p className="text-sm text-slate-500 font-medium">Preencha os detalhes do material necessário.</p>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

                            <div className="relative" style={{ zIndex: 60 }}>
                                <ModernSelect
                                    label="Tipo de Conteúdo *"
                                    searchable
                                    value={editingContent.type}
                                    onChange={v => setEditingContent({ ...editingContent, type: v })}
                                    options={[
                                        { value: 'Imagem', label: 'Imagem (Arte)' },
                                        { value: 'Vídeo', label: 'Vídeo' },
                                        { value: 'Voz', label: 'Voz/Locução' },
                                        { value: 'Cobertura', label: 'Cobertura Fotográfica/Fílmica' },
                                        { value: 'Texto', label: 'Texto/Redação' },
                                        { value: 'Outros', label: 'Outros' }
                                    ]}
                                />
                            </div>

                            <div className="relative" style={{ zIndex: 50 }}>
                                <ModernSelect
                                    label="Setor Alvo *"
                                    searchable
                                    value={editingContent.sector}
                                    onChange={v => setEditingContent({ ...editingContent, sector: v })}
                                    options={sectors.map(s => ({ value: s.name, label: s.name }))}
                                />
                            </div>

                            <div className="relative" style={{ zIndex: 30 }}>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Local (Opcional)</label>
                                <input
                                    type="text"
                                    value={editingContent.location}
                                    onChange={e => setEditingContent({ ...editingContent, location: e.target.value })}
                                    placeholder="Ex: Praça principal..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setIsContentModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveContent}
                                className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow shadow-indigo-200 transition-all text-sm"
                            >
                                Salvar Item
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2FA Modal Integration */}
            <TwoFactorModal
                isOpen={is2FAOpen}
                onClose={() => setIs2FAOpen(false)}
                onConfirm={submitOrder}
                secret={userSecret || ''}
                secret2={userSecret2 || ''}
                signatureName={userName}
            />

            {/* Custom Interactive Alert Modal */}
            <MarketingAlertModal {...alertConfig} />
        </div>
    );
};
