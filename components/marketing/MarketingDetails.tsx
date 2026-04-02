import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ProcessStepper } from '../common/ProcessStepper';
import { FileText, ArrowLeft, Download, Loader2, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { differenceInDays } from 'date-fns';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

interface MarketingDetailsProps {
    requestId: string;
    userRole: string; // "Administrador" or "Marketing" get special features
    onBack: () => void;
}

const STEPS = [
    'Informações',
    'Descrição',
    'Conteúdo',
    'Validação'
];

export const MarketingDetails: React.FC<MarketingDetailsProps> = ({ requestId, userRole, onBack }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState<any>(null);
    const [contents, setContents] = useState<any[]>([]);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [hasExpiredFiles, setHasExpiredFiles] = useState(false);

    const STEPS = ['Informações', 'Descrição', 'Conteúdo', 'Anexos', 'Produção'];

    const hasAdminPowers = userRole === 'Administrador' || userRole === 'Marketing';

    const extractTitle = (desc?: string) => {
        if (!desc) return 'Sem Título';
        const match = desc.match(/\*\*Título do Pedido:\*\* (.*?)\n/);
        return match && match[1] ? match[1] : 'Sem Título';
    };

    const extractEventDetails = (desc?: string, firstContent?: any) => {
        if (!desc) return { date: '-', time: '-', location: '-', details: '' };

        // Try regex first for description-based details
        const dateMatch = desc.match(/\*\*Data do Evento:\*\* (.*?)\n/);
        const timeMatch = desc.match(/\*\*Hora do Evento:\*\* (.*?)\n/);
        const localMatch = desc.match(/\*\*Local do Evento:\*\* (.*?)\n/);

        // Fallback to first content item if regex fails
        const date = dateMatch && dateMatch[1] ? dateMatch[1].trim() : (firstContent?.event_date || '-');
        const time = timeMatch && timeMatch[1] ? timeMatch[1].trim() : (firstContent?.event_time || '-');
        const location = localMatch && localMatch[1] ? localMatch[1].trim() : (firstContent?.event_location || '-');

        const descParts = desc.split('**Descrição Detalhada:**');
        const detailsText = descParts.length > 1 ? descParts[1].trim() : desc;

        return {
            date: date === '-' ? '-' : format(new Date(date), "dd/MM/yyyy", { locale: ptBR }),
            time: time,
            location: location,
            details: detailsText
        };
    };

    // Status / Alert system
    const [alertConfig, setAlertConfig] = useState<any>({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onClose: () => setAlertConfig((prev: any) => ({ ...prev, isOpen: false }))
    });

    const showAlert = (type: string, title: string, message: string, onConfirm?: () => void, showCancel?: boolean) => {
        setAlertConfig({
            isOpen: true,
            type,
            title,
            message,
            onConfirm,
            showCancel,
            confirmText: 'Confirmar',
            cancelText: 'Cancelar',
            onClose: () => setAlertConfig((prev: any) => ({ ...prev, isOpen: false }))
        });
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!hasAdminPowers) return;

        showAlert(
            'warning',
            `Confirmar o status como ${newStatus}?`,
            'A solicitação mudará de status visível para o criador da mesma.',
            async () => {
                try {
                    setAlertConfig((prev: any) => ({ ...prev, isOpen: false }));
                    const { error } = await supabase
                        .from('marketing_requests')
                        .update({ status: newStatus })
                        .eq('id', requestId);

                    if (error) throw error;
                    setRequest({ ...request, status: newStatus });

                    setTimeout(() => {
                        showAlert('success', 'Status Atualizado', `O status mudou para ${newStatus} com sucesso.`);
                    }, 400);

                } catch (err) {
                    console.error("Erro ao atualizar status:", err);
                    showAlert('error', 'Erro', 'Não foi possível alterar o status no momento.');
                }
            },
            true
        );
    };

    const handleFileUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input
        event.target.value = '';

        // Validation
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/mp3'];
        if (!validTypes.includes(file.type)) {
            showAlert('error', 'Formato Inválido', 'Por favor, envie apenas Imagens, Vídeos (MP4/MOV) ou Áudios (MP3).');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showAlert('error', 'Arquivo muito grande', 'O limite máximo para arquivos é de 2GB.');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const fileExt = file.name.split('.').pop();
            const rawFileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const prefix = currentStep === 4 ? 'prod_' : 'req_'; // Prefix files based on the step
            const fileName = `${prefix}${rawFileName}`;
            const filePath = `${requestId}/${fileName}`;

            // Get session for auth headers
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Não autorizado");

            // We use XMLHttpRequest for reliable progress tracking on large files
            const xhr = new XMLHttpRequest();

            const promise = new Promise((resolve, reject) => {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        setUploadProgress(percentComplete);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                    } else {
                        reject(new Error(`Upload failed: ${xhr.statusText}`));
                    }
                };

                xhr.onerror = () => reject(new Error("Network error"));
            });

            // Endpoint from env variables for storage insertion
            // Using the base URL from env directly is the standard way when standard supabase client isn't enough
            const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://sua-url-supabase.supabase.co';
            const url = `${supabaseUrl}/storage/v1/object/marketing_attachments/${filePath}`;

            xhr.open('POST', url, true);
            xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);

            // Note: Content-Type is optional for formData but highly recommended for raw blobs. 
            // In standard supabase-js, it pushes raw files. We do the same here.
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.setRequestHeader('x-upsert', 'true');

            xhr.send(file);

            await promise;

            showAlert('success', 'Upload Concluído', 'Arquivo anexado com sucesso!');

            // Refresh attachments
            const { data: newFiles } = await supabase.storage.from('marketing_attachments').list(requestId);
            if (newFiles) setAttachments(newFiles);

        } catch (error) {
            console.error('Upload Error:', error);
            showAlert('error', 'Falha no Envio', 'Houve um erro ao enviar este arquivo.');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                // Fetch main request
                const { data: reqData, error: reqError } = await supabase
                    .from('marketing_requests')
                    .select('*')
                    .eq('id', requestId)
                    .single();

                if (reqError) throw reqError;
                setRequest(reqData);

                // Fetch contents
                const { data: contentData, error: contentError } = await supabase
                    .from('marketing_contents')
                    .select('*')
                    .eq('request_id', requestId);

                if (contentError) throw contentError;
                setContents(contentData || []);

                // Fetch attachments
                const { data: filesData, error: filesError } = await supabase.storage
                    .from('marketing_attachments')
                    .list(requestId);

                if (filesError) {
                    console.error("Erro ao carregar anexos:", filesError);
                } else if (filesData) {
                    // Check for expiration (7 days)
                    const validFiles = [];
                    let expired = false;

                    for (const file of filesData) {
                        try {
                            const daysOld = differenceInDays(new Date(), new Date(file.created_at));
                            if (daysOld > 7) {
                                expired = true;
                            } else {
                                validFiles.push(file);
                            }
                        } catch (e) {
                            validFiles.push(file); // fallback se n tiver data
                        }
                    }

                    if (expired) {
                        setHasExpiredFiles(true);
                    }
                    setAttachments(validFiles);
                }
            } catch (err) {
                console.error("Erro ao carregar detalhes do marketing:", err);
            } finally {
                setLoading(false);
            }
        };

        if (requestId) {
            fetchDetails();
        }
    }, [requestId]);

    const handleDownload = async (fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('marketing_attachments')
                .download(`${requestId}/${fileName}`);

            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error("Erro ao baixar anexo:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 bg-white">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                <p className="text-sm font-semibold tracking-wide">Carregando detalhes da solicitação...</p>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 bg-white">
                <p>Solicitação não encontrada.</p>
                <button onClick={onBack} className="mt-4 text-indigo-600 font-bold hover:underline">Voltar</button>
            </div>
        );
    }

    // Render logic per step
    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Solicitante Principal
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={request.requester_name || ''}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none opacity-80 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Setor Solicitante
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={request.requester_sector || ''}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none opacity-80 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Status
                                </label>
                                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-bold flex items-center gap-2 opacity-80 cursor-not-allowed">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    {request.status}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Data do Pedido
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none opacity-80 cursor-not-allowed"
                                />
                            </div>
                             <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Assinatura Eletrônica
                                </label>
                                <div className={`w-full border rounded-xl px-4 py-3 flex items-center justify-between opacity-80 cursor-not-allowed ${request.digital_signature?.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                    <div className="flex items-center gap-2 font-medium text-sm">
                                        <CheckCircle2 className={`w-4 h-4 ${request.digital_signature?.enabled ? 'text-emerald-500' : 'text-slate-400'}`} />
                                        {request.digital_signature?.enabled ? 'Assinado Digitalmente' : 'Aguardando Assinatura'}
                                    </div>
                                    {request.digital_signature?.date && (
                                        <div className="text-xs font-bold bg-white px-3 py-1 rounded-lg shadow-sm border border-emerald-100">
                                            {format(new Date(request.digital_signature.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 1:
                const evDetails = extractEventDetails(request.description, contents[0]);
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Data do Evento
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={evDetails.date}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none opacity-80 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Hora do Evento
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={evDetails.time}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none opacity-80 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Local do Evento
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={evDetails.location}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none opacity-80 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-500" />
                                Descrição e Objetivos
                            </h3>
                            <div className="w-full min-h-[192px] max-h-96 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 overflow-y-auto cursor-not-allowed">
                                {evDetails.details.split('\n').map((line: string, i: number) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        <br />
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-4">
                            <p className="text-sm text-indigo-800 font-medium">
                                Esta solicitação gerou <strong className="font-black text-indigo-900">{contents.length}</strong> peças de conteúdo.
                            </p>
                        </div>

                        {contents.length === 0 ? (
                            <div className="py-12 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                                <FileText className="w-10 h-10 mb-3 text-slate-300" />
                                <span className="text-sm font-semibold">Nenhum item cadastrado</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {contents.map((item, index) => (
                                    <div key={index} className="group bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-black bg-indigo-100 text-indigo-600 rounded-md">
                                                    {item.content_type}
                                                </span>
                                                <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-md flex items-center gap-1.5">
                                                    <Clock className="w-3 h-3" />
                                                    {item.event_date ? format(new Date(item.event_date), "dd/MM/yyyy", { locale: ptBR }) : 'S/ Data'}
                                                </span>
                                                {item.content_sector && (
                                                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">
                                                        {item.content_sector}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs text-slate-500 mt-2">
                                                {item.event_location && <p><strong className="text-slate-600 font-bold">Local:</strong> {item.event_location}</p>}
                                                {item.event_time && <p><strong className="text-slate-600 font-bold">Horário:</strong> {item.event_time}</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col relative w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-500" />
                                    Anexos do Solicitante
                                </h3>
                                {/* Anexos originais geralmente são enviados na criação. Permitir novos "req_" caso seja o próprio autor ou Admin */}
                                {!isUploading && (
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="file-upload-req"
                                            className="hidden"
                                            accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp3"
                                            onChange={handleFileUploadChange}
                                        />
                                        <label htmlFor="file-upload-req" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors text-sm">
                                            <span>Novo Anexo</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {isUploading && (
                                <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 w-full">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-slate-700">Enviando arquivo...</span>
                                        <span className="text-xs font-bold text-indigo-600">{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                        <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                </div>
                            )}

                            {hasExpiredFiles && attachments.filter(f => !f.name.startsWith('prod_')).length === 0 ? (
                                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium flex gap-3 my-4">
                                    <span className="text-xl">⚠️</span>
                                    Os arquivos antigos foram removidos automaticamente. Solicite o reenvio caso necessário.
                                </div>
                            ) : attachments.filter(f => !f.name.startsWith('prod_')).length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {attachments.filter(f => !f.name.startsWith('prod_')).map((file, idx) => {
                                        let daysRemaining = 7;
                                        try {
                                            const daysOld = differenceInDays(new Date(), new Date(file.created_at));
                                            daysRemaining = Math.max(0, 7 - daysOld);
                                        } catch (e) { }

                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-semibold text-slate-700 truncate" title={file.name}>{file.name.replace('req_', '')}</span>
                                                        <span className="text-[10px] text-amber-600 font-bold">Expira em {daysRemaining} dia(s)</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    <button
                                                        onClick={() => handleDownload(file.name)}
                                                        className="w-8 h-8 rounded-full bg-white text-indigo-600 shadow-sm border border-slate-200 flex items-center justify-center hover:bg-indigo-50 transition-colors"
                                                        title="Baixar Anexo"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic px-2 my-2">Nenhum anexo do solicitante disponível.</p>
                            )}
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col relative w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <h3 className="text-base font-bold text-emerald-700 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    Produção (Arquivos de Retorno)
                                </h3>

                                {hasAdminPowers && !isUploading && (
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="file-upload-prod"
                                            className="hidden"
                                            accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp3"
                                            onChange={handleFileUploadChange}
                                        />
                                        <label htmlFor="file-upload-prod" className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors text-sm">
                                            <span>Inserir Entrega</span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {isUploading && (
                                <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 w-full">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-slate-700">Enviando arquivo final...</span>
                                        <span className="text-xs font-bold text-emerald-600">{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                        <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                </div>
                            )}

                            {attachments.filter(f => f.name.startsWith('prod_')).length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {attachments.filter(f => f.name.startsWith('prod_')).map((file, idx) => {
                                        let daysRemaining = 7;
                                        try {
                                            const daysOld = differenceInDays(new Date(), new Date(file.created_at));
                                            daysRemaining = Math.max(0, 7 - daysOld);
                                        } catch (e) { }

                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl hover:bg-emerald-50 transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-semibold text-slate-700 truncate" title={file.name}>{file.name.replace('prod_', '')}</span>
                                                        <span className="text-[10px] text-amber-600 font-bold">Expira em {daysRemaining} dia(s)</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    <button
                                                        onClick={() => handleDownload(file.name)}
                                                        className="w-8 h-8 rounded-full bg-white text-emerald-600 shadow-sm border border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                                        title="Baixar Arquivo"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    {hasAdminPowers && (
                                                        <button
                                                            onClick={() => {
                                                                showAlert(
                                                                    'warning',
                                                                    'Excluir Entrega?',
                                                                    'Têm certeza que deseja remover este arquivo de produção?',
                                                                    async () => {
                                                                        try {
                                                                            setAlertConfig(prev => ({ ...prev, isOpen: false }));
                                                                            const { error } = await supabase.storage.from('marketing_attachments').remove([`${requestId}/${file.name}`]);
                                                                            if (error) throw error;
                                                                            setAttachments(prev => prev.filter(f => f.name !== file.name));
                                                                            setTimeout(() => showAlert('success', 'Excluído', 'Arquivo removido com sucesso.'), 300);
                                                                        } catch (err) {
                                                                            showAlert('error', 'Erro', 'Não foi possível excluir o arquivo.');
                                                                        }
                                                                    },
                                                                    true
                                                                )
                                                            }}
                                                            className="w-8 h-8 rounded-full bg-white text-rose-600 shadow-sm border border-rose-200 flex items-center justify-center hover:bg-rose-50 transition-colors"
                                                            title="Excluir Arquivo"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic px-2 my-2">Nenhum arquivo de produção disponível.</p>
                            )}
                        </div>

                        {/* Ficha da Solicitação details container is merged onto the production page mostly since its the last step */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col mt-4">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">Ficha Técnica e Validação</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm mt-2">
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Título / Assunto</div>
                                        <div className="text-slate-800 font-bold truncate" title={extractTitle(request.description)}>{extractTitle(request.description)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Solicitante</div>
                                        <div className="text-slate-800 font-medium">{request.applicant_name}</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status Atual</div>
                                        {!hasAdminPowers ? (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                {request.status}
                                            </div>
                                        ) : (
                                            <select
                                                value={request.status}
                                                onChange={(e) => handleStatusChange(e.target.value)}
                                                className="block w-full max-w-[200px] border border-indigo-200 bg-indigo-50 text-indigo-800 text-sm font-bold rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                                            >
                                                <option value="Em Análise">Em Análise</option>
                                                <option value="Na Fila">Na Fila</option>
                                                <option value="Em Andamento">Em Andamento</option>
                                                <option value="Aprovado">Aprovado</option>
                                                <option value="Rejeitado">Rejeitado</option>
                                            </select>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Peças Solicitadas</div>
                                        <div className="text-slate-800 font-medium">{contents.length} itens</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden">
            {/* Minimal Header */}
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-2 flex flex-col md:flex-row md:items-center justify-between shadow-sm z-10 w-full gap-3 md:gap-4 shrink-0 overflow-hidden">
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200 shrink-0"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-baseline gap-2 truncate">
                        <h1 className="text-base md:text-lg font-black text-slate-800 tracking-tight whitespace-nowrap">Detalhes do Conteúdo</h1>
                        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-slate-400">({request.protocol})</span>
                    </div>
                </div>

                <div className="flex-1 min-w-0 pr-2">
                    <ProcessStepper steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} maxCompletedStep={STEPS.length} compact />
                </div>

                <div className="flex items-center shrink-0">
                    <button
                        onClick={() => setCurrentStep(prev => prev + 1)}
                        disabled={currentStep === STEPS.length - 1}
                        className={`px-4 md:px-6 py-1.5 md:py-2 text-xs md:text-sm font-bold rounded-xl shadow-sm transition-all whitespace-nowrap outline-none ${currentStep === STEPS.length - 1
                            ? 'opacity-0 pointer-events-none'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-600/20'
                            }`}
                    >
                        Avançar
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar px-4 md:px-6 pb-20 pt-4 md:pt-6">
                <div className="max-w-4xl mx-auto min-h-[400px]">
                    {/* Read-Only Banner */}
                    <div className="mb-6 bg-slate-100 border border-slate-200 rounded-xl p-3 md:p-4 flex items-center justify-center text-center gap-2 md:gap-3 text-slate-500 text-xs md:text-sm font-semibold w-full">
                        <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 shrink-0" />
                        <span>O conteúdo desta solicitação não pode ser alterado. MODO VISUALIZAÇÃO.</span>
                    </div>

                    {renderStepContent()}
                </div>
            </div>

            {/* Modal Components */}
            {alertConfig.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-slate-100 scale-100 animate-in zoom-in-95 duration-200">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${alertConfig.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                            alertConfig.type === 'error' ? 'bg-rose-100 text-rose-600' :
                                alertConfig.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                    'bg-blue-100 text-blue-600'
                            }`}>
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 text-center mb-2">{alertConfig.title}</h3>
                        <p className="text-sm text-slate-600 text-center mb-6 leading-relaxed">{alertConfig.message}</p>
                        <div className="flex items-center gap-3">
                            {alertConfig.showCancel && (
                                <button
                                    onClick={alertConfig.onClose}
                                    className="flex-1 px-4 py-2.5 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm"
                                >
                                    {alertConfig.cancelText}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (alertConfig.onConfirm) alertConfig.onConfirm();
                                    else alertConfig.onClose();
                                }}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white transition-colors text-sm shadow-sm ${alertConfig.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                    alertConfig.type === 'error' ? 'bg-rose-600 hover:bg-rose-700' :
                                        alertConfig.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
                                            'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                {alertConfig.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
