import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle, AlertTriangle } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface MarketingAlertModalProps {
    isOpen: boolean;
    type: AlertType;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
}

export const MarketingAlertModal: React.FC<MarketingAlertModalProps> = ({
    isOpen,
    type,
    title,
    message,
    onClose,
    onConfirm,
    confirmText = 'OK',
    cancelText = 'Cancelar',
    showCancel = false
}) => {
    if (!isOpen) return null;

    const theme = {
        success: {
            icon: CheckCircle2,
            iconColor: 'text-emerald-500',
            iconBg: 'bg-emerald-100',
            btnBg: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20',
        },
        error: {
            icon: XCircle,
            iconColor: 'text-rose-500',
            iconBg: 'bg-rose-100',
            btnBg: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/20',
        },
        warning: {
            icon: AlertTriangle,
            iconColor: 'text-amber-500',
            iconBg: 'bg-amber-100',
            btnBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20',
        },
        info: {
            icon: Info,
            iconColor: 'text-blue-500',
            iconBg: 'bg-blue-100',
            btnBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20',
        }
    }[type];

    const Icon = theme.icon;

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header Pattern / Color Bar (optional touch of elegance) */}
                <div className={`h-2 w-full ${theme.btnBg.split(' ')[0]}`} />

                <div className="p-6 md:p-8 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-full ${theme.iconBg} flex items-center justify-center mb-6 shrink-0 shadow-inner`}>
                        <Icon className={`w-8 h-8 ${theme.iconColor}`} />
                    </div>

                    <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight mb-2">
                        {title}
                    </h3>

                    <p className="text-sm md:text-base text-slate-600 font-medium leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 w-full mt-auto">
                        {showCancel && (
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-4 focus:ring-slate-100"
                            >
                                {cancelText}
                            </button>
                        )}
                        <button
                            onClick={handleConfirm}
                            className={`flex-1 px-4 py-3 text-white rounded-xl font-bold shadow-sm transition-all focus:outline-none focus:ring-4 ${theme.btnBg}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
