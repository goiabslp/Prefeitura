import React, { useState, useEffect, useRef } from 'react';
import { 
    QrCode, FileUp, Sparkles, Send, CheckCircle2, AlertTriangle, 
    ArrowLeft, Loader2, Camera, Info, FileText, Image as ImageIcon, Trash2, Clock 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { getRecordByOperationCode } from '../../services/operationCodeService';
import { uploadFile } from '../../services/storageService';

interface UploadHubProps {
    currentUser: any;
    onBack: () => void;
}

interface OperationDetails {
    code: string;
    module: string;
    recordId: string;
    recordData: any;
}

export const UploadHub: React.FC<UploadHubProps> = ({ currentUser, onBack }) => {
    // Nav & Stages: 'hub' | 'scanner' | 'processing_qr' | 'form' | 'success'
    const [stage, setStage] = useState<'hub' | 'scanner' | 'processing_qr' | 'form' | 'success'>('hub');
    const [subStage, setSubStage] = useState<'hub' | 'anexar' | 'transferir'>('hub');
    const [opCodeInput, setOpCodeInput] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    
    // Detected Operation details
    const [operation, setOperation] = useState<OperationDetails | null>(null);

    // Form inputs
    const [uploadedFiles, setUploadedFiles] = useState<{ file: File; progress: number; url?: string }[]>([]);
    const [valorInput, setValorInput] = useState<string>('');
    const [descricaoInput, setDescricaoInput] = useState<string>('');
    const [observacaoInput, setObservacaoInput] = useState<string>('');
    const [fotoNota, setFotoNota] = useState<{ file: File; url?: string } | null>(null);

    // States for Área de Transferência
    const [transferArea, setTransferArea] = useState<any>(null);
    const [transferFiles, setTransferFiles] = useState<any[]>([]);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [transferTimeLeft, setTransferTimeLeft] = useState<number>(0);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [newAreaName, setNewAreaName] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);
    const [creatingArea, setCreatingArea] = useState<boolean>(false);

    // Scanner webcam refs
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanningRef = useRef<boolean>(false);

    // Sync URL sub-routes
    useEffect(() => {
        const path = window.location.pathname.toLowerCase();
        if (path === '/upload/anexar') {
            setSubStage('anexar');
        } else if (path === '/upload/transferir') {
            setSubStage('transferir');
        } else {
            setSubStage('hub');
        }
    }, []);

    const handleNavigateSubStage = (newSubStage: 'hub' | 'anexar' | 'transferir') => {
        setSubStage(newSubStage);
        setErrorMsg('');
        if (newSubStage === 'anexar') {
            window.history.pushState({}, '', '/Upload/Anexar');
        } else if (newSubStage === 'transferir') {
            window.history.pushState({}, '', '/Upload/Transferir');
        } else {
            window.history.pushState({}, '', '/Upload');
        }
    };

    const generateTransferCode = () => {
        const chars = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Time left timer for active area
    useEffect(() => {
        if (!transferArea) return;
        const interval = setInterval(() => {
            const exp = new Date(transferArea.expires_at).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, Math.floor((exp - now) / 1000));
            setTimeLeft(diff);
            if (diff === 0) {
                setTransferArea(null);
                setTransferFiles([]);
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [transferArea]);

    // Time left timer for upload form
    useEffect(() => {
        if (!operation || operation.module !== 'transfer') return;
        const interval = setInterval(() => {
            const exp = new Date(operation.recordData.expires_at).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, Math.floor((exp - now) / 1000));
            setTransferTimeLeft(diff);
            if (diff === 0) {
                setErrorMsg('Esta área de transferência expirou.');
                setOperation(null);
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [operation]);

    // Fetch and listen to transfer files in real-time
    useEffect(() => {
        if (!transferArea) return;
        
        const fetchFiles = async () => {
            const { data } = await supabase
                .from('transfer_files')
                .select('*')
                .eq('transfer_area_id', transferArea.id)
                .order('created_at', { ascending: false });
            if (data) {
                setTransferFiles(data);
            }
        };
        fetchFiles();

        const channel = supabase
            .channel(`transfer_files_${transferArea.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'transfer_files',
                filter: `transfer_area_id=eq.${transferArea.id}`
            }, (payload) => {
                const newFile = payload.new as any;
                setTransferFiles(prev => [newFile, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [transferArea]);

    const loadMyActiveTransferArea = async () => {
        try {
            // Limpa áreas expiradas do banco
            await supabase
                .from('transfer_areas')
                .delete()
                .lt('expires_at', new Date().toISOString());

            const { data } = await supabase
                .from('transfer_areas')
                .select('*')
                .eq('created_by', currentUser?.id)
                .gt('expires_at', new Date().toISOString())
                .maybeSingle();

            if (data) {
                setTransferArea(data);
            } else {
                setTransferArea(null);
            }
        } catch (e) {
            console.error('Erro ao buscar área de transferência', e);
        }
    };

    useEffect(() => {
        if (subStage === 'transferir' && currentUser) {
            loadMyActiveTransferArea();
        }
    }, [subStage, currentUser]);

    const handleCreateTransferArea = async () => {
        if (!newAreaName.trim() || !currentUser) return;
        setCreatingArea(true);
        try {
            const code = generateTransferCode();
            const { data, error } = await supabase
                .from('transfer_areas')
                .insert([{
                    name: newAreaName.trim(),
                    code: code,
                    created_by: currentUser.id,
                    created_by_name: currentUser.name || 'Usuário',
                    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            setTransferArea(data);
            setIsCreateModalOpen(false);
            setNewAreaName('');
        } catch (err: any) {
            alert('Erro ao criar área de transferência: ' + err.message);
        } finally {
            setCreatingArea(false);
        }
    };

    const handleCloseTransferArea = async () => {
        if (!transferArea) return;
        
        const confirmClose = window.confirm("Deseja realmente encerrar esta área de transferência? Todos os arquivos associados serão deletados permanentemente.");
        if (!confirmClose) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('transfer_areas')
                .delete()
                .eq('id', transferArea.id);

            if (error) throw error;
            setTransferArea(null);
            setTransferFiles([]);
        } catch (err: any) {
            alert("Erro ao encerrar área de transferência: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Dynamically load jsQR for camera scanning
    useEffect(() => {
        if (stage === 'scanner') {
            const scriptId = 'jsqr-cdn-script';
            let script = document.getElementById(scriptId) as HTMLScriptElement;
            if (!script) {
                script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
                script.async = true;
                document.body.appendChild(script);
            }
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [stage]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } } 
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                videoRef.current.play();
                scanningRef.current = true;
                requestAnimationFrame(tickScanner);
            }
        } catch (err) {
            console.error('Camera access error:', err);
            setErrorMsg('Não foi possível acessar a câmera do dispositivo.');
            setStage('hub');
        }
    };

    const stopCamera = () => {
        scanningRef.current = false;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const tickScanner = () => {
        if (!scanningRef.current) return;
        
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const video = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const jsQR = (window as any).jsQR;
                if (jsQR) {
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'dontInvert',
                    });
                    if (code && code.data) {
                        handleQrCodeScanned(code.data);
                        return; // stop scanning
                    }
                }
            }
        }
        if (scanningRef.current) {
            requestAnimationFrame(tickScanner);
        }
    };

    const handleQrCodeScanned = async (codeStr: string) => {
        stopCamera();
        setStage('processing_qr');
        setErrorMsg('');
        
        // Delay visual de 1.5s
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Executa a busca e validação do código
        await handleCodeSubmit(codeStr);
    };

    const handleCodeSubmit = async (codeStr: string) => {
        const cleanCode = codeStr.trim().toUpperCase();
        if (cleanCode.length !== 6) {
            setErrorMsg('O código deve possuir exatamente 6 caracteres.');
            return;
        }
        setLoading(true);
        setErrorMsg('');
        stopCamera();

        try {
            // 1. Tenta buscar primeiro na tabela de Área de Transferência temporária
            const { data: trData } = await supabase
                .from('transfer_areas')
                .select('*')
                .eq('code', cleanCode)
                .gt('expires_at', new Date().toISOString())
                .maybeSingle();

            if (trData) {
                setOperation({
                    code: cleanCode,
                    module: 'transfer',
                    recordId: trData.id,
                    recordData: trData
                });
                // Inicia o timer regressivo do form
                const exp = new Date(trData.expires_at).getTime();
                const now = new Date().getTime();
                setTransferTimeLeft(Math.max(0, Math.floor((exp - now) / 1000)));
                
                setStage('form');
                setLoading(false);
                return;
            }

            // 2. Se não encontrar, tenta buscar na tabela tradicional de operações
            const record = await getRecordByOperationCode(cleanCode);
            if (!record) {
                setErrorMsg('Código de operação inválido ou não encontrado.');
                setLoading(false);
                return;
            }

            // Fetch record specific data to confirm existence
            let tableName = '';
            if (record.module === 'diarias') tableName = 'diarias_eventos';
            else if (record.module === 'compras') tableName = 'purchase_orders';
            else if (record.module === 'oficios') tableName = 'oficios';
            else if (record.module === 'abastecimento') tableName = 'abastecimentos';

            if (!tableName) {
                setErrorMsg('Módulo de operação não suportado.');
                setLoading(false);
                return;
            }

            const { data: recordData, error: recordError } = await supabase
                .from(tableName)
                .select('*')
                .eq('id', record.record_id)
                .maybeSingle();

            if (recordError || !recordData) {
                setErrorMsg('O registro associado a este código não foi encontrado.');
                setLoading(false);
                return;
            }

            setOperation({
                code: cleanCode,
                module: record.module,
                recordId: record.record_id,
                recordData
            });
            setStage('form');
        } catch (err) {
            console.error('Error fetching code:', err);
            setErrorMsg('Erro de conexão ao buscar a operação.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>, isFotoNota = false) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const filesArray = Array.from(e.target.files);

        if (isFotoNota) {
            const file = filesArray[0];
            setLoading(true);
            const url = await uploadFile(file, 'attachments', `refuel_invoice_photos/${Date.now()}_${file.name}`);
            setLoading(false);
            if (url) {
                setFotoNota({ file, url });
            }
        } else {
            const newFiles = filesArray.map(file => ({ file, progress: 0 }));
            setUploadedFiles(prev => [...prev, ...newFiles]);

            // Sequentially upload files
            for (let i = 0; i < newFiles.length; i++) {
                const targetFile = newFiles[i];
                // Simulate progress
                const interval = setInterval(() => {
                    setUploadedFiles(prev => prev.map(f => f.file === targetFile.file ? { ...f, progress: Math.min(f.progress + 20, 90) } : f));
                }, 100);

                const url = await uploadFile(targetFile.file, 'attachments', `operation_uploads/${Date.now()}_${targetFile.file.name}`);
                clearInterval(interval);

                if (url) {
                    setUploadedFiles(prev => prev.map(f => f.file === targetFile.file ? { ...f, progress: 100, url } : f));
                } else {
                    setUploadedFiles(prev => prev.filter(f => f.file !== targetFile.file));
                }
            }
        }
    };

    const removeUploadedFile = (file: File) => {
        setUploadedFiles(prev => prev.filter(f => f.file !== file));
    };

    const handleSaveUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!operation) return;

        // Validation based on module requirements
        if (uploadedFiles.length === 0 && !fotoNota) {
            setErrorMsg('Por favor, faça upload de pelo menos um arquivo.');
            return;
        }

        setLoading(true);
        setErrorMsg('');

        try {
            const timestamp = new Date().toISOString();

            if (operation.module === 'diarias') {
                const currentComprovantes = operation.recordData.comprovantes_gestor || [];
                const newComprovantes = [
                    ...currentComprovantes,
                    ...uploadedFiles.map((f, idx) => ({
                        id: `${Date.now()}_${idx}`,
                        name: f.file.name,
                        url: f.url || '',
                        type: f.file.type,
                        date: timestamp,
                        expenseValue: valorInput,
                        expenseType: 'Outros',
                        description: descricaoInput
                    }))
                ];

                const { error: updateError } = await supabase
                    .from('diarias_eventos')
                    .update({ comprovantes_gestor: newComprovantes })
                    .eq('id', operation.recordId);

                if (updateError) throw updateError;

            } else if (operation.module === 'compras') {
                const currentAttachments = operation.recordData.attachments || [];
                const newAttachments = [
                    ...currentAttachments,
                    ...uploadedFiles.map((f, idx) => ({
                        id: `${Date.now()}_${idx}`,
                        name: f.file.name,
                        url: f.url || '',
                        type: f.file.type,
                        date: timestamp
                    }))
                ];

                const { error: updateError } = await supabase
                    .from('purchase_orders')
                    .update({ attachments: newAttachments })
                    .eq('id', operation.recordId);

                if (updateError) throw updateError;

            } else if (operation.module === 'oficios') {
                // For oficios, we append to document_snapshot.content.images and document_snapshot.content.body
                const snapshot = operation.recordData.document_snapshot || {};
                const content = snapshot.content || {};
                const currentImages = content.images || [];

                const newImages = uploadedFiles.map((f, idx) => ({
                    id: `${Date.now()}_${idx}`,
                    url: f.url || '',
                    width: 300
                }));

                const imgTokens = newImages.map(img => `{{IMG::${img.id}}}`).join('\n');
                const updatedBody = (content.body || '') + `\n\n[Anexo Rápido (${descricaoInput || 'Sem descrição'}):]\n${imgTokens}`;

                const updatedSnapshot = {
                    ...snapshot,
                    content: {
                        ...content,
                        images: [...currentImages, ...newImages],
                        body: updatedBody
                    }
                };

                const { error: updateError } = await supabase
                    .from('oficios')
                    .update({ document_snapshot: updatedSnapshot })
                    .eq('id', operation.recordId);

                if (updateError) throw updateError;

            } else if (operation.module === 'abastecimento') {
                // Abastecimento gets the primary photo_url, document_url (optional secondary) and observacoes
                const updates: any = {};
                if (fotoNota) updates.photo_url = fotoNota.url;
                if (uploadedFiles.length > 0) updates.document_url = uploadedFiles[0].url;
                if (observacaoInput) updates.observacoes = observacaoInput;

                const { error: updateError } = await supabase
                    .from('abastecimentos')
                    .update(updates)
                    .eq('id', operation.recordId);

                if (updateError) throw updateError;
            } else if (operation.module === 'transfer') {
                // Área de transferência temporária: salva cada anexo individualmente na tabela transfer_files
                for (const f of uploadedFiles) {
                    const { error: insertError } = await supabase
                        .from('transfer_files')
                        .insert([{
                            transfer_area_id: operation.recordId,
                            file_name: f.file.name,
                            file_url: f.url || '',
                            file_size: f.file.size,
                            uploaded_by: currentUser?.id,
                            uploaded_by_name: currentUser?.name || 'Usuário'
                        }]);
                    if (insertError) throw insertError;
                }
            }

            // Success log
            try {
                await supabase.from('audit_logs').insert([{
                    user_id: currentUser?.id,
                    user_name: currentUser?.name || 'Sistema',
                    action: 'FAST_UPLOAD',
                    details: {
                        module: operation.module,
                        record_id: operation.recordId,
                        code: operation.code,
                        files: uploadedFiles.map(f => f.file.name)
                    }
                }]);
            } catch (logErr) {
                console.warn('Failed to insert audit log', logErr);
            }

            setStage('success');
        } catch (err: any) {
            console.error('Save upload error:', err);
            setErrorMsg(err.message || 'Erro ao vincular arquivos ao registro.');
        } finally {
            setLoading(false);
        }
    };

    const resetHub = () => {
        setStage('hub');
        setOpCodeInput('');
        setOperation(null);
        setUploadedFiles([]);
        setValorInput('');
        setDescricaoInput('');
        setObservacaoInput('');
        setFotoNota(null);
        setErrorMsg('');
    };

    return (
        <div className="w-full flex-1 flex flex-col bg-slate-50/50 text-slate-800 font-sans overflow-y-auto p-6 relative min-h-[600px]">
            {/* Botão de Voltar Flutuante no Canto Superior Esquerdo */}
            <div className="absolute top-6 left-6 z-20">
                <button
                    type="button"
                    onClick={() => {
                        if (stage !== 'hub') {
                            resetHub();
                        } else if (subStage !== 'hub') {
                            handleNavigateSubStage('hub');
                        } else {
                            onBack();
                        }
                    }}
                    className="px-4 py-2.5 bg-white border border-slate-205 text-[10px] font-black text-slate-500 hover:text-slate-850 uppercase tracking-widest rounded-full shadow-md shadow-slate-100 hover:shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4 text-slate-400" />
                    Voltar
                </button>
            </div>

            {/* Main Content Area */}
            <div className={`w-full flex-1 flex flex-col justify-center mx-auto transition-all duration-300 ${
                (stage === 'hub' && subStage === 'hub') ? 'max-w-4xl' : 'max-w-md'
            }`}>
                {/* 1. HUB CHOOSER (CARDS) STAGE */}
                {stage === 'hub' && subStage === 'hub' && (
                    <div className="flex-1 flex flex-col justify-center items-center space-y-12 py-10 animate-fade-in w-full">
                        {/* Título Centralizado com Ícone Arredondado */}
                        <div className="flex flex-col items-center text-center space-y-4 pt-4 shrink-0">
                            <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-md shadow-amber-100/50">
                                <FileUp className="w-7 h-7" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-855 uppercase tracking-tight">Hub de Upload</h2>
                        </div>

                        {/* Cards horizontais em estilo Prefeitura */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
                            {/* Card 1: Anexar */}
                            <button
                                type="button"
                                onClick={() => handleNavigateSubStage('anexar')}
                                className="group relative bg-white border border-slate-150 p-8 rounded-[32px] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-98 flex flex-col items-center text-center space-y-4 cursor-pointer shadow-md shadow-slate-100/40 overflow-hidden"
                            >
                                <div className="absolute -top-12 -right-12 w-28 h-28 bg-gradient-to-br from-sky-500/5 to-indigo-500/5 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
                                <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform z-10">
                                    <FileUp className="w-6 h-6" />
                                </div>
                                <div className="z-10">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Anexar Documento</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-normal">
                                        VINCULAR COMPROVANTES
                                    </p>
                                </div>
                            </button>

                            {/* Card 2: Área de Transferência */}
                            <button
                                type="button"
                                onClick={() => handleNavigateSubStage('transferir')}
                                className="group relative bg-white border border-slate-150 p-8 rounded-[32px] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-98 flex flex-col items-center text-center space-y-4 cursor-pointer shadow-md shadow-slate-100/40 overflow-hidden"
                            >
                                <div className="absolute -top-12 -right-12 w-28 h-28 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition-transform z-10">
                                    <Send className="w-5.5 h-5.5" />
                                </div>
                                <div className="z-10">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Área de Transferência</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-normal">
                                        COMPARTILHAR ARQUIVOS
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* 1.1. ANEXAR (LEITOR DE CÓDIGO) STAGE */}
                {stage === 'hub' && subStage === 'anexar' && (
                    <div className="flex-1 flex flex-col justify-center space-y-8 py-6 animate-fade-in">
                        <div className="text-center space-y-2">
                            <h2 className="text-xl font-black uppercase tracking-wider text-slate-800">Vincular Documento</h2>
                            <p className="text-[11px] font-semibold text-slate-550 leading-relaxed px-4">
                                Digite o código de 6 dígitos da operação/área de transferência ou escaneie o QR Code para fazer o upload instantâneo.
                            </p>
                        </div>

                        {errorMsg && (
                            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span className="text-[11px] font-semibold text-rose-800 leading-normal">{errorMsg}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Alphanumeric Code Input */}
                            <div className="space-y-1.5">
                                <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Código de Envio</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="EX: A7K9F2"
                                        value={opCodeInput}
                                        onChange={(e) => setOpCodeInput(e.target.value.toUpperCase())}
                                        className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 text-center text-base sm:text-lg font-mono font-black tracking-widest text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-400 shadow-sm"
                                    />
                                    <button
                                        onClick={() => handleCodeSubmit(opCodeInput)}
                                        disabled={loading || opCodeInput.length !== 6}
                                        className="px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-750 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer shrink-0"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                                    </button>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-center py-2 shrink-0">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <span className="relative bg-slate-50/50 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">OU</span>
                            </div>

                            {/* Camera QR Scanner Trigger */}
                            <button
                                onClick={() => setStage('scanner')}
                                className="w-full flex items-center justify-center gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-extrabold transition-all active:scale-98 shadow-sm cursor-pointer"
                            >
                                <QrCode className="w-5 h-5 text-sky-600" />
                                <span className="text-xs uppercase tracking-wider text-slate-800">Escanear QR Code</span>
                            </button>
                        </div>

                        {/* Info banner */}
                        <div className="flex items-start gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-semibold text-slate-500 leading-normal">
                                O envio é auditado e vinculado diretamente ao seu usuário para fins de segurança.
                            </p>
                        </div>
                    </div>
                )}

                {/* 1.2. ÁREA DE TRANSFERÊNCIA STAGE */}
                {stage === 'hub' && subStage === 'transferir' && (
                    <div className="flex-1 flex flex-col justify-between py-2 animate-fade-in min-h-0">
                        {!transferArea ? (
                            <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6 py-6">
                                <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650">
                                    <Send className="w-8 h-8" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-black uppercase tracking-wider text-slate-800">Criar Área Temporária</h3>
                                    <p className="text-[11px] font-semibold text-slate-500 leading-relaxed px-6">
                                        Crie uma área onde qualquer pessoa com o código poderá anexar arquivos. Tudo o que for anexado aparecerá aqui em tempo real.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                                >
                                    Criar Área de Transferência
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col space-y-5 min-h-0 text-left">
                                {/* Detalhes da área ativa */}
                                <div className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <span className="text-[8.5px] font-black text-indigo-650 uppercase tracking-widest block">Área Ativa</span>
                                            <h4 className="text-base font-black text-slate-800 mt-0.5 uppercase tracking-wide truncate max-w-[200px]">{transferArea.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-xl text-indigo-750 font-mono font-bold text-xs shrink-0 shadow-sm">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{formatTime(timeLeft)}</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Código de Envio</span>
                                            <span className="text-lg font-mono font-black tracking-widest text-slate-800 mt-0.5">{transferArea.code}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(transferArea.code);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-[10px] font-black rounded-lg text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                            >
                                                {copied ? 'Copiado!' : 'Copiar'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCloseTransferArea}
                                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[10px] font-black rounded-lg text-rose-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-rose-550" />
                                                Encerrar
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de arquivos recebidos em tempo real */}
                                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                                    <h5 className="text-[9.5px] font-black uppercase tracking-widest text-slate-450 ml-1">Arquivos Recebidos ({transferFiles.length})</h5>
                                    
                                    <div className="flex-1 overflow-y-auto border border-slate-200 bg-white rounded-2xl p-3 custom-scrollbar min-h-0 flex flex-col shadow-sm">
                                        {transferFiles.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 space-y-3">
                                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center leading-relaxed">
                                                    Aguardando arquivos serem anexados por outro dispositivo...
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {transferFiles.map((fileObj: any) => (
                                                    <div key={fileObj.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-350 transition-colors animate-slide-in">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {fileObj.file_name.toLowerCase().endsWith('.pdf') ? (
                                                                <FileText className="w-5 h-5 text-red-500 shrink-0" />
                                                            ) : (
                                                                <ImageIcon className="w-5 h-5 text-indigo-500 shrink-0" />
                                                            )}
                                                            <div className="min-w-0">
                                                                <h5 className="text-[11px] font-bold text-slate-800 truncate">{fileObj.file_name}</h5>
                                                                <span className="text-[8.5px] font-semibold text-slate-500 block mt-0.5">
                                                                    Anexado por: <span className="font-bold text-slate-700">{fileObj.uploaded_by_name}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <a
                                                            href={fileObj.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-650 hover:text-white border border-indigo-100 rounded-lg transition-all active:scale-90 shadow-sm shrink-0"
                                                            title="Download"
                                                        >
                                                            <FileUp className="w-4 h-4 rotate-180" />
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. SCANNER STAGE */}
                {stage === 'scanner' && (
                    <div className="flex-1 flex flex-col justify-center space-y-6">
                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-black uppercase tracking-wider text-slate-800">Escaneando...</h3>
                            <p className="text-[10px] font-semibold text-slate-500">Posicione o QR Code no centro da tela</p>
                        </div>

                        {/* Scanner Video Camera Element */}
                        <div className="relative aspect-square w-full bg-black rounded-3xl overflow-hidden border-2 border-sky-500/30 shadow-lg flex items-center justify-center max-w-sm mx-auto">
                            <video 
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            
                            {/* Scanning Guide HUD Overlay */}
                            <div className="absolute inset-8 border-2 border-dashed border-sky-500/80 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                                <div className="w-10 h-10 border-t-2 border-l-2 border-sky-500 absolute top-0 left-0 rounded-tl-lg"></div>
                                <div className="w-10 h-10 border-t-2 border-r-2 border-sky-500 absolute top-0 right-0 rounded-tr-lg"></div>
                                <div className="w-10 h-10 border-b-2 border-l-2 border-sky-500 absolute bottom-0 left-0 rounded-bl-lg"></div>
                                <div className="w-10 h-10 border-b-2 border-r-2 border-sky-500 absolute bottom-0 right-0 rounded-br-lg"></div>
                            </div>
                        </div>

                        <button
                            onClick={resetHub}
                            className="px-6 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all max-w-xs mx-auto w-full cursor-pointer shadow-sm"
                        >
                            Voltar
                        </button>
                    </div>
                )}

                {/* 3. DYNAMIC UPLOAD FORM STAGE */}
                {stage === 'form' && operation && (
                    <form onSubmit={handleSaveUpload} className="flex-1 flex flex-col justify-between space-y-6">
                        <div className="space-y-5">
                            {/* Operation Badge Info Card */}
                            <div className="bg-white border border-slate-205 rounded-2xl p-4 space-y-2 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <span className="text-[8.5px] font-black text-sky-600 uppercase tracking-widest block">
                                            {operation.module === 'transfer' ? 'Área de Transferência' : 'Operação Localizada'}
                                        </span>
                                        <h4 className="text-base font-black text-slate-800 mt-0.5 uppercase tracking-wide truncate max-w-[220px]">
                                            {operation.module === 'transfer' ? operation.recordData.name : (
                                                <>
                                                    {operation.module === 'diarias' && 'Diárias e Custeio'}
                                                    {operation.module === 'compras' && 'Solicitação de Compra'}
                                                    {operation.module === 'oficios' && 'Expedição de Ofício'}
                                                    {operation.module === 'abastecimento' && 'Abastecimento / Refino'}
                                                </>
                                            )}
                                        </h4>
                                    </div>
                                    <span className="bg-sky-50 text-sky-700 font-mono font-black text-xs px-2.5 py-1 rounded-xl border border-sky-100 tracking-wider shrink-0">
                                        {operation.code}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                                    <span>
                                        Criador: <span className="font-bold text-slate-700">{operation.module === 'transfer' ? operation.recordData.created_by_name : 'Sistema'}</span>
                                    </span>
                                    {operation.module === 'transfer' && (
                                        <span className="text-indigo-650 font-mono font-bold shrink-0">
                                            Expira em: {formatTime(transferTimeLeft)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="bg-rose-550/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <span className="text-[11px] font-semibold text-rose-700 leading-normal">{errorMsg}</span>
                                </div>
                            )}

                            {/* DYNAMIC FIELDS ENGINE */}
                            <div className="space-y-4 text-left">
                                {/* Refuel Invoice Photo */}
                                {operation.module === 'abastecimento' && (
                                    <div className="space-y-2">
                                        <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Foto da Nota Fiscal *</label>
                                        {fotoNota ? (
                                            <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-900 flex items-center justify-center shadow-sm">
                                                <img src={fotoNota.url} alt="Nota Fiscal" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => setFotoNota(null)}
                                                    className="absolute top-3 right-3 bg-red-600 p-2 rounded-xl text-white hover:bg-red-700 transition-colors shadow-lg shadow-black/20 cursor-pointer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-250 hover:border-sky-500/80 rounded-2xl p-6 bg-white hover:bg-slate-50 transition-all cursor-pointer group shadow-sm">
                                                <Camera className="w-7 h-7 text-slate-400 group-hover:text-sky-600 transition-colors mb-2" />
                                                <span className="text-[11px] font-bold text-slate-700">Tirar foto da Nota Fiscal</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={(e) => handleFileUploadChange(e, true)}
                                                />
                                            </label>
                                        )}
                                    </div>
                                )}

                                {/* Main Document Upload */}
                                {(['diarias', 'compras', 'oficios', 'abastecimento'].includes(operation.module) || operation.module === 'transfer') && (
                                    <div className="space-y-2">
                                        <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                            {operation.module === 'abastecimento' ? 'Outros Documentos / Anexos' : 'Comprovantes / Documentos *'}
                                        </label>
                                        
                                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-250 hover:border-sky-500/80 rounded-2xl p-6 bg-white hover:bg-slate-50 transition-all cursor-pointer group shadow-sm">
                                            <FileUp className="w-7 h-7 text-slate-400 group-hover:text-sky-600 transition-colors mb-2" />
                                            <span className="text-[11px] font-bold text-slate-700">
                                                {operation.module === 'diarias' ? 'Selecionar Comprovantes' : 'Selecionar Arquivos'}
                                            </span>
                                            <span className="text-[9px] font-semibold text-slate-400 mt-1">PDF ou Imagens (Máx 10MB)</span>
                                            <input
                                                type="file"
                                                multiple={operation.module !== 'abastecimento'}
                                                accept="image/*,application/pdf"
                                                className="hidden"
                                                onChange={(e) => handleFileUploadChange(e, false)}
                                            />
                                        </label>

                                        {/* File list progress */}
                                        {uploadedFiles.length > 0 && (
                                            <div className="space-y-2 pt-2">
                                                {uploadedFiles.map((fileObj, idx) => (
                                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 animate-slide-in shadow-sm">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {fileObj.file.type.includes('pdf') ? (
                                                                <FileText className="w-5 h-5 text-red-500 shrink-0" />
                                                            ) : (
                                                                <ImageIcon className="w-5 h-5 text-sky-600 shrink-0" />
                                                            )}
                                                            <div className="min-w-0">
                                                                <h5 className="text-[11px] font-bold text-slate-800 truncate">{fileObj.file.name}</h5>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="bg-sky-550 h-full rounded-full transition-all duration-300"
                                                                            style={{ width: `${fileObj.progress}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-[8px] font-bold text-slate-500">{fileObj.progress}%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeUploadedFile(fileObj.file)}
                                                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-all active:scale-90 cursor-pointer"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Valor Input (Diárias) */}
                                {operation.module === 'diarias' && (
                                    <div className="space-y-1.5">
                                        <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor do Gasto (R$)</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: 150,00"
                                            value={valorInput}
                                            onChange={(e) => setValorInput(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-400 shadow-sm"
                                        />
                                    </div>
                                )}

                                {/* Descrição (Diárias ou Ofícios) */}
                                {['diarias', 'oficios'].includes(operation.module) && (
                                    <div className="space-y-1.5">
                                        <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Descrição / Justificativa</label>
                                        <textarea
                                            placeholder="Descreva brevemente a finalidade deste documento..."
                                            value={descricaoInput}
                                            onChange={(e) => setDescricaoInput(e.target.value)}
                                            rows={3}
                                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-400 resize-none shadow-sm"
                                        />
                                    </div>
                                )}

                                {/* Observação (Abastecimento) */}
                                {operation.module === 'abastecimento' && (
                                    <div className="space-y-1.5">
                                        <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Observações do Abastecimento</label>
                                        <textarea
                                            placeholder="Observações complementares..."
                                            value={observacaoInput}
                                            onChange={(e) => setObservacaoInput(e.target.value)}
                                            rows={2}
                                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-400 resize-none shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex gap-3 pt-6 border-t border-slate-200 shrink-0">
                            <button
                                type="button"
                                onClick={resetHub}
                                className="flex-1 py-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading || (uploadedFiles.some(f => f.progress < 100) && uploadedFiles.length > 0)}
                                className="flex-1 py-4 bg-gradient-to-r from-sky-600 to-indigo-650 hover:from-sky-750 hover:to-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                                {loading ? 'Enviando...' : 'Concluir Envio'}
                            </button>
                        </div>
                    </form>
                )}

                {/* 4. SUCCESS FEEDBACK STAGE */}
                {stage === 'success' && (
                    <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6 py-12 animate-scale-up">
                        <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-650 rounded-full flex items-center justify-center shadow-sm">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black uppercase tracking-wider text-emerald-600">Documento Enviado!</h3>
                            <p className="text-[11px] font-semibold text-slate-500 leading-relaxed px-6">
                                O arquivo foi vinculado com sucesso ao registro correspondente e já está disponível para consulta no painel geral.
                            </p>
                        </div>

                        <button
                            onClick={resetHub}
                            className="px-6 py-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all max-w-xs w-full shadow-sm cursor-pointer"
                        >
                            Novo Envio
                        </button>
                    </div>
                )}
            </div>

            {/* Modal de Criação de Área de Transferência */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl relative">
                        <div className="space-y-1">
                            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Nome da Área</h3>
                            <p className="text-[10px] text-slate-450 font-semibold">Identifique esta área de compartilhamento temporária.</p>
                        </div>
                        <input
                            type="text"
                            placeholder="Ex: Documentos da Prefeitura"
                            value={newAreaName}
                            onChange={(e) => setNewAreaName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 shadow-sm"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setNewAreaName('');
                                }}
                                className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateTransferArea}
                                disabled={creatingArea || !newAreaName.trim()}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer shadow-md"
                            >
                                {creatingArea ? 'Criando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
