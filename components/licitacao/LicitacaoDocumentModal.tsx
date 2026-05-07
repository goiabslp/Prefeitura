import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { uploadFile } from '../../services/storageService';
import { useAddLicitacaoDocument } from '../../hooks/useLicitacaoModule';
import { User } from '../../types';

interface LicitacaoDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    processoId: string;
    currentUser: User;
    onSuccess?: (newDoc: any) => void;
}

export const LicitacaoDocumentModal: React.FC<LicitacaoDocumentModalProps> = ({
    isOpen,
    onClose,
    processoId,
    currentUser,
    onSuccess
}) => {
    const [descricao, setDescricao] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addDocument = useAddLicitacaoDocument();

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError('');
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Por favor, selecione um arquivo.');
            return;
        }
        if (!descricao.trim()) {
            setError('A descrição do documento é obrigatória.');
            return;
        }

        setIsUploading(true);
        setError('');

        try {
            // Upload to Supabase Storage in the 'attachments' bucket
            const fileUrl = await uploadFile(file, 'attachments');
            
            if (!fileUrl) {
                throw new Error('Falha ao fazer upload do arquivo.');
            }

            // Save document record in the database
            const newDoc = await addDocument.mutateAsync({
                processo_id: processoId,
                nome_documento: descricao,
                url: fileUrl,
                criado_por: currentUser.id
            });

            if (onSuccess && newDoc) {
                onSuccess(newDoc);
            }

            onClose();
        } catch (err: any) {
            console.error('Error uploading document:', err);
            setError(err.message || 'Ocorreu um erro ao anexar o documento.');
        } finally {
            setIsUploading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                            <Upload className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800">Anexar Documento</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        disabled={isUploading}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-100 disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Descrição do Documento */}
                    <div>
                        <label className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">Descrição do Documento</label>
                        <input 
                            type="text"
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Ex: Edital, Proposta, etc..."
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-medium text-sm transition-all"
                            disabled={isUploading}
                        />
                    </div>

                    {/* Área de Upload de Arquivo */}
                    <div>
                        <label className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">Arquivo</label>
                        <div 
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all
                                ${file 
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                    : 'border-slate-200 hover:border-emerald-400 bg-slate-50 text-slate-500'
                                }
                                ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleFileChange}
                                disabled={isUploading}
                            />
                            {file ? (
                                <>
                                    <FileText className="w-8 h-8 mb-2" />
                                    <p className="font-bold text-sm max-w-[250px] truncate">{file.name}</p>
                                    <p className="text-xs opacity-70 mt-1">Clique para alterar</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-8 h-8 mb-2 opacity-50" />
                                    <p className="font-bold text-sm">Clique para selecionar um arquivo</p>
                                    <p className="text-xs opacity-70 mt-1">PDF, DOC, JPG, PNG (Max 10MB)</p>
                                </>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold text-center">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isUploading}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={isUploading || !file || !descricao.trim()}
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    Anexar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
