import React, { useState, useEffect } from 'react';
import { QrCode, Copy, Check, Loader2, Info, X } from 'lucide-react';
import QRCode from 'qrcode';
import { getOrCreateOperationCode } from '../../services/operationCodeService';

interface OperationQRCodeProps {
    moduleName: string;
    recordId: string;
    instructions?: string;
}

export const OperationQRCode: React.FC<OperationQRCodeProps> = ({
    moduleName,
    recordId,
    instructions = 'Aponte a câmera do seu celular para fazer upload rápido de arquivos para este registro.'
}) => {
    const [code, setCode] = useState<string>('');
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);

    useEffect(() => {
        let active = true;
        const fetchCodeAndQr = async () => {
            setLoading(true);
            try {
                const opCode = await getOrCreateOperationCode(moduleName, recordId);
                if (!active) return;
                setCode(opCode);

                // Generate QR Code URL with the protocol or code
                // To keep it simple, we encode just the 6-character code, which the mobile scanner will read
                const dataUrl = await QRCode.toDataURL(opCode, {
                    margin: 2,
                    width: 300,
                    color: {
                        dark: '#0f172a', // Slate 900
                        light: '#ffffff'
                    }
                });
                if (!active) return;
                setQrDataUrl(dataUrl);
            } catch (err) {
                console.error('Error generating operation QR Code:', err);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchCodeAndQr();
        return () => {
            active = false;
        };
    }, [moduleName, recordId]);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    if (loading) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-slate-400 text-xs font-semibold select-none">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Carregando QR...</span>
            </div>
        );
    }

    return (
        <>
            {/* Small Quick-Action Widget */}
            <div 
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 group select-none"
            >
                <div className="p-1 bg-sky-50 rounded-lg text-sky-600 group-hover:bg-sky-100 transition-colors">
                    <QrCode className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                    <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider leading-none">ANEXO RÁPIDO</span>
                    <span className="text-xs font-black text-slate-800 font-mono tracking-wider mt-0.5">{code}</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all active:scale-90"
                    title="Copiar Código"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col scale-100 transition-transform">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-sky-600" />
                                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">QR DA OPERAÇÃO</h3>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex flex-col items-center text-center space-y-5">
                            {/* QR Code Container */}
                            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner">
                                {qrDataUrl ? (
                                    <img 
                                        src={qrDataUrl} 
                                        alt={`QR Code ${code}`} 
                                        className="w-48 h-48 rounded-lg select-none"
                                        draggable={false}
                                    />
                                ) : (
                                    <div className="w-48 h-48 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                                    </div>
                                )}
                            </div>

                            {/* Code Widget */}
                            <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex flex-col text-left">
                                    <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">Código de Envio</span>
                                    <span className="text-xl font-black text-slate-900 font-mono tracking-widest mt-1">{code}</span>
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 hover:text-slate-900 active:scale-95 shadow-sm transition-all"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Copiado</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Copiar</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Instruction info box */}
                            <div className="flex items-start gap-3 bg-sky-50/50 border border-sky-100/50 rounded-2xl p-4 text-left">
                                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                                <p className="text-[11px] font-semibold text-slate-600 leading-normal">
                                    {instructions}
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
