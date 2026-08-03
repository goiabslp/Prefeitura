import React, { useState, useEffect, useRef } from 'react';
import { 
    QrCode, FileUp, Sparkles, Send, CheckCircle2, AlertTriangle, 
    ArrowLeft, Loader2, Camera, Info, FileText, Image as ImageIcon, Trash2 
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
    // Nav & Stages: 'hub' | 'scanner' | 'form' | 'success'
    const [stage, setStage] = useState<'hub' | 'scanner' | 'form' | 'success'>('hub');
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

    // Scanner webcam refs
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanningRef = useRef<boolean>(false);

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
                        handleCodeSubmit(code.data);
                        return; // stop scanning
                    }
                }
            }
        }
        if (scanningRef.current) {
            requestAnimationFrame(tickScanner);
        }
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
        <div className="flex flex-col min-h-screen bg-slate-900 text-white font-sans overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50 shrink-0">
                <button
                    onClick={stage === 'hub' ? onBack : resetHub}
                    className="p-2 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-sky-400">HUB DE ANEXOS</span>
                </div>
                <div className="w-9 h-9" /> {/* Spacer */}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col justify-between max-w-md mx-auto w-full">
                {/* 1. INITIAL IDENTIFICATION STAGE */}
                {stage === 'hub' && (
                    <div className="flex-1 flex flex-col justify-center space-y-8 py-6">
                        <div className="text-center space-y-2">
                            <h2 className="text-xl font-black uppercase tracking-wider text-slate-100">Vincular Documento</h2>
                            <p className="text-[11px] font-semibold text-slate-400 leading-relaxed px-4">
                                Digite o código de 6 dígitos ou escaneie o QR Code para fazer o upload instantâneo de arquivos.
                            </p>
                        </div>

                        {errorMsg && (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <span className="text-[11px] font-semibold text-rose-300 leading-normal">{errorMsg}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Alphanumeric Code Input */}
                            <div className="space-y-1.5">
                                <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Código da Operação</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="EX: A7K9F2"
                                        value={opCodeInput}
                                        onChange={(e) => setOpCodeInput(e.target.value.toUpperCase())}
                                        className="flex-1 bg-slate-800 border border-slate-700/80 rounded-2xl p-4 text-center text-lg font-mono font-black tracking-widest text-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-600"
                                    />
                                    <button
                                        onClick={() => handleCodeSubmit(opCodeInput)}
                                        disabled={loading || opCodeInput.length !== 6}
                                        className="px-6 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-lg shadow-sky-500/15 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer shrink-0"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                                    </button>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-center py-2 shrink-0">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-800"></div>
                                </div>
                                <span className="relative bg-slate-900 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">OU</span>
                            </div>

                            {/* Camera QR Scanner Trigger */}
                            <button
                                onClick={() => setStage('scanner')}
                                className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 hover:border-slate-600/80 rounded-2xl text-slate-200 font-extrabold transition-all active:scale-98 shadow-sm cursor-pointer"
                            >
                                <QrCode className="w-5 h-5 text-sky-400" />
                                <span className="text-xs uppercase tracking-wider">Escanear QR Code</span>
                            </button>
                        </div>

                        {/* Info banner */}
                        <div className="flex items-start gap-3 bg-slate-800/40 border border-slate-800/80 rounded-2xl p-4">
                            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-semibold text-slate-400 leading-normal">
                                Todos os uploads são auditados automaticamente por segurança e vinculados diretamente ao seu usuário.
                            </p>
                        </div>
                    </div>
                )}

                {/* 2. SCANNER STAGE */}
                {stage === 'scanner' && (
                    <div className="flex-1 flex flex-col justify-center space-y-6">
                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-black uppercase tracking-wider text-slate-100">Escaneando...</h3>
                            <p className="text-[10px] font-semibold text-slate-400">Posicione o QR Code da operação no centro da tela</p>
                        </div>

                        {/* Scanner Video Camera Element */}
                        <div className="relative aspect-square w-full bg-black rounded-3xl overflow-hidden border-2 border-sky-500/30 shadow-2xl flex items-center justify-center max-w-sm mx-auto">
                            <video 
                                ref={videoRef}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            
                            {/* Scanning Guide HUD Overlay */}
                            <div className="absolute inset-8 border-2 border-dashed border-sky-400/80 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                                <div className="w-10 h-10 border-t-2 border-l-2 border-sky-400 absolute top-0 left-0 rounded-tl-lg"></div>
                                <div className="w-10 h-10 border-t-2 border-r-2 border-sky-400 absolute top-0 right-0 rounded-tr-lg"></div>
                                <div className="w-10 h-10 border-b-2 border-l-2 border-sky-400 absolute bottom-0 left-0 rounded-bl-lg"></div>
                                <div className="w-10 h-10 border-b-2 border-r-2 border-sky-400 absolute bottom-0 right-0 rounded-br-lg"></div>
                            </div>
                        </div>

                        <button
                            onClick={resetHub}
                            className="px-6 py-3 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all max-w-xs mx-auto w-full cursor-pointer"
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
                            <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-4 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[8.5px] font-black text-sky-400 uppercase tracking-widest">Operação Localizada</span>
                                        <h4 className="text-base font-black text-white mt-0.5 uppercase tracking-wide">
                                            {operation.module === 'diarias' && 'Diárias e Custeio'}
                                            {operation.module === 'compras' && 'Solicitação de Compra'}
                                            {operation.module === 'oficios' && 'Expedição de Ofício'}
                                            {operation.module === 'abastecimento' && 'Abastecimento / Refino'}
                                        </h4>
                                    </div>
                                    <span className="bg-sky-500/10 text-sky-400 font-mono font-black text-xs px-2.5 py-1 rounded-xl border border-sky-500/20 tracking-wider">
                                        {operation.code}
                                    </span>
                                </div>
                                <div className="text-[10px] font-semibold text-slate-400">
                                    Ref: <span className="font-mono text-slate-300 font-bold">{operation.recordId.slice(0, 8)}...</span>
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <span className="text-[11px] font-semibold text-rose-300 leading-normal">{errorMsg}</span>
                                </div>
                            )}

                            {/* DYNAMIC FIELDS ENGINE */}
                            <div className="space-y-4 text-left">
                                {/* Refuel Invoice Photo */}
                                {operation.module === 'abastecimento' && (
                                    <div className="space-y-2">
                                        <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">Foto da Nota Fiscal *</label>
                                        {fotoNota ? (
                                            <div className="relative rounded-2xl overflow-hidden border border-slate-700 aspect-[4/3] bg-slate-950 flex items-center justify-center">
                                                <img src={fotoNota.url} alt="Nota Fiscal" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => setFotoNota(null)}
                                                    className="absolute top-3 right-3 bg-red-650 p-2 rounded-xl text-white hover:bg-red-700 transition-colors shadow-lg shadow-black/20"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-sky-500/80 rounded-2xl p-6 bg-slate-800/40 hover:bg-slate-800/70 transition-all cursor-pointer group">
                                                <Camera className="w-7 h-7 text-slate-500 group-hover:text-sky-400 transition-colors mb-2" />
                                                <span className="text-[11px] font-bold text-slate-300">Tirar foto da Nota Fiscal</span>
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
                                {['diarias', 'compras', 'oficios', 'abastecimento'].includes(operation.module) && (
                                    <div className="space-y-2">
                                        <label className="block text-[9.5px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                            {operation.module === 'abastecimento' ? 'Outros Documentos / Anexos' : 'Comprovantes / Documentos *'}
                                        </label>
                                        
                                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-sky-500/80 rounded-2xl p-6 bg-slate-800/40 hover:bg-slate-800/70 transition-all cursor-pointer group">
                                            <FileUp className="w-7 h-7 text-slate-500 group-hover:text-sky-400 transition-colors mb-2" />
                                            <span className="text-[11px] font-bold text-slate-300">
                                                {operation.module === 'diarias' ? 'Selecionar Comprovantes' : 'Selecionar Arquivos'}
                                            </span>
                                            <span className="text-[9px] font-semibold text-slate-500 mt-1">PDF ou Imagens (Máx 10MB)</span>
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
                                                    <div key={idx} className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3 animate-slide-in">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {fileObj.file.type.includes('pdf') ? (
                                                                <FileText className="w-5 h-5 text-red-400 shrink-0" />
                                                            ) : (
                                                                <ImageIcon className="w-5 h-5 text-sky-400 shrink-0" />
                                                            )}
                                                            <div className="min-w-0">
                                                                <h5 className="text-[11px] font-bold text-slate-200 truncate">{fileObj.file.name}</h5>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <div className="w-24 bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="bg-sky-500 h-full rounded-full transition-all duration-300"
                                                                            style={{ width: `${fileObj.progress}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="text-[8px] font-bold text-slate-400">{fileObj.progress}%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeUploadedFile(fileObj.file)}
                                                            className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-rose-400 transition-all active:scale-90"
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
                                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xs font-bold text-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-600"
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
                                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xs font-semibold text-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-600 resize-none"
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
                                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xs font-semibold text-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all placeholder:text-slate-600 resize-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex gap-3 pt-6 border-t border-slate-800/80 shrink-0">
                            <button
                                type="button"
                                onClick={resetHub}
                                className="flex-1 py-4 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading || (uploadedFiles.some(f => f.progress < 100) && uploadedFiles.length > 0)}
                                className="flex-1 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-lg shadow-sky-500/15 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
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
                        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/5">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black uppercase tracking-wider text-emerald-400">Documento Enviado!</h3>
                            <p className="text-[11px] font-semibold text-slate-400 leading-relaxed px-6">
                                O arquivo foi vinculado com sucesso ao registro correspondente e já está disponível para consulta no painel geral.
                            </p>
                        </div>

                        <button
                            onClick={resetHub}
                            className="px-6 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-extrabold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all max-w-xs w-full cursor-pointer shadow-sm"
                        >
                            Novo Envio
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
