import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { ProcessStepper } from '../common/ProcessStepper';
import { FileText, ArrowLeft, Download, Loader2, CheckCircle2, Clock } from 'lucide-react';
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
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [request, setRequest] = useState<any>(null);
    const [contents, setContents] = useState<any[]>([]);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [hasExpiredFiles, setHasExpiredFiles] = useState(false);

    const hasAdminPowers = userRole === 'Administrador' || userRole === 'Marketing';

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
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
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
                    .eq('marketing_request_id', requestId);

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
            case 1:
                return (
                    <div className="space-y-6">
                        <div className="relative">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                Título do Conteúdo (Finalidade)
                            </label>
                            <input
                                type="text"
                                readOnly
                                value={request.title || ''}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none opacity-80 cursor-not-allowed"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Solicitante Principal
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={request.applicant_name || ''}
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
                                    value={request.requesting_sector || ''}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none opacity-80 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-500" />
                                Descrição e Objetivos
                            </h3>
                            <div className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 overflow-y-auto cursor-not-allowed">
                                {request.description?.split('\n').map((line: string, i: number) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        <br />
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col relative w-full">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    Arquivos Anexados ({attachments.length})
                                </h3>

                                {hasAdminPowers && !isUploading && (
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="file-upload"
                                            className="hidden"
                                            accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/mp3"
                                            onChange={handleFileUploadChange}
                                        />
                                        <label htmlFor="file-upload" className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors text-sm">
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

                            {hasExpiredFiles && attachments.length === 0 ? (
                                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium flex gap-3 my-4">
                                    <span className="text-xl">⚠️</span>
                                    Os arquivos foram removidos automaticamente após o prazo de 7 dias. Solicite à equipe de Marketing o reenvio dos arquivos.
                                </div>
                            ) : attachments.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {attachments.map((file, idx) => {
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
                                                        <span className="text-sm font-semibold text-slate-700 truncate" title={file.name}>{file.name}</span>
                                                        <span className="text-[10px] text-amber-600 font-bold">Expira em {daysRemaining} dia(s)</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDownload(file.name)}
                                                    className="w-8 h-8 rounded-full bg-white text-indigo-600 shadow-sm border border-slate-200 flex items-center justify-center hover:bg-indigo-50 transition-colors shrink-0 ml-2"
                                                    title="Baixar Anexo"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500 italic px-2 my-2">Nenhum anexo disponível.</p>
                            )}
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
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
                                                    {item.expected_date ? format(new Date(item.expected_date), "dd/MM/yyyy", { locale: ptBR }) : 'S/ Data'}
                                                </span>
                                                {item.target_sector && (
                                                    <span className="px-2.5 py-1 text-[10px] font-semibold bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">
                                                        {item.target_sector}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-xs text-slate-500 mt-2">
                                                {item.location && <p><strong className="text-slate-600 font-bold">Local:</strong> {item.location}</p>}
                                                {item.expected_time && <p><strong className="text-slate-600 font-bold">Horário:</strong> {item.expected_time}</p>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 4:
                return (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-3xl mx-auto shadow-sm">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-8 h-8 text-indigo-600" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ficha da Solicitação</h2>
                            <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-semibold">{request.protocol}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Título / Assunto</div>
                                    <div className="text-slate-800 font-bold truncate" title={request.title}>{request.title || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Solicitante</div>
                                    <div className="text-slate-800 font-medium">{request.applicant_name}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Setor Alvo</div>
                                    <div className="text-slate-800 font-medium">{request.requesting_sector}</div>
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
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Peças</div>
                                    <div className="text-slate-800 font-medium">{contents.length} itens cadastrados</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Criado Em</div>
                                    <div className="text-slate-800 font-medium">{format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
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
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0 shadow-sm z-10 w-full mb-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Detalhes do Conteúdo</h1>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{request.protocol}</p>
                    </div>
                </div>
            </header>

            <div className="px-4 md:px-6 py-6 pb-2 shrink-0 max-w-5xl mx-auto w-full">
                <ProcessStepper steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} />
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar px-4 md:px-6 pb-20 pt-4">
                <div className="max-w-3xl mx-auto min-h-[400px]">
                    {/* Read-Only Banner */}
                    <div className="mb-6 bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-center justify-center text-center gap-3 text-slate-500 text-sm font-semibold w-full">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        O conteúdo desta solicitação não pode ser alterado.
                    </div>

                    {renderStepContent()}
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 shrink-0 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                        disabled={currentStep === 1}
                        className={`px-6 md:px-8 py-3 rounded-full font-bold text-sm tracking-wide transition-all ${currentStep === 1
                            ? 'opacity-0 pointer-events-none'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:shadow-sm'
                            }`}
                    >
                        Voltar
                    </button>

                    <div className="flex items-center gap-2">
                        {STEPS.map((step, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-300 ${currentStep === idx + 1 ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-200'
                                    }`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => setCurrentStep(prev => prev + 1)}
                        disabled={currentStep === STEPS.length}
                        className={`px-6 md:px-8 py-3 rounded-full font-bold text-sm tracking-wide transition-all ${currentStep === STEPS.length
                            ? 'opacity-0 pointer-events-none'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20'
                            }`}
                    >
                        Avançar
                    </button>
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
