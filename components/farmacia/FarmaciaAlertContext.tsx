import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type AlertType = 'success' | 'error' | 'info';

interface AlertState {
    isOpen: boolean;
    message: string;
    type: AlertType;
}

interface ConfirmState {
    isOpen: boolean;
    message: string;
    onConfirm: (() => void) | null;
}

interface FarmaciaAlertContextType {
    showAlert: (message: string, type?: AlertType) => void;
    showConfirm: (message: string, onConfirm: () => void) => void;
}

const FarmaciaAlertContext = createContext<FarmaciaAlertContextType | undefined>(undefined);

export const useFarmaciaAlert = () => {
    const context = useContext(FarmaciaAlertContext);
    if (!context) {
        throw new Error('useFarmaciaAlert deve ser usado dentro de um FarmaciaAlertProvider');
    }
    return context;
};

export const FarmaciaAlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [alert, setAlert] = useState<AlertState>({ isOpen: false, message: '', type: 'info' });
    const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false, message: '', onConfirm: null });

    const showAlert = (message: string, type: AlertType = 'info') => {
        setAlert({ isOpen: true, message, type });
    };

    const showConfirm = (message: string, onConfirm: () => void) => {
        setConfirm({ isOpen: true, message, onConfirm });
    };

    const handleCloseAlert = () => {
        setAlert(prev => ({ ...prev, isOpen: false }));
    };

    const handleConfirmClose = (confirmed: boolean) => {
        if (confirmed && confirm.onConfirm) {
            confirm.onConfirm();
        }
        setConfirm(prev => ({ ...prev, isOpen: false, onConfirm: null }));
    };

    return (
        <FarmaciaAlertContext.Provider value={{ showAlert, showConfirm }}>
            {children}

            {/* Alert Modal */}
            {alert.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center relative">
                            <button onClick={handleCloseAlert} className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            
                            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                                alert.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
                                alert.type === 'error' ? 'bg-rose-50 text-rose-500' :
                                'bg-blue-50 text-blue-500'
                            }`}>
                                {alert.type === 'success' && <CheckCircle2 className="w-8 h-8" />}
                                {alert.type === 'error' && <AlertTriangle className="w-8 h-8" />}
                                {alert.type === 'info' && <Info className="w-8 h-8" />}
                            </div>
                            
                            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2 uppercase">
                                {alert.type === 'success' ? 'Sucesso!' :
                                alert.type === 'error' ? 'Atenção!' :
                                'Informação'}
                            </h3>
                            
                            <p className="text-slate-500 text-sm font-medium mb-6 leading-relaxed">
                                {alert.message}
                            </p>
                            
                            <button
                                onClick={handleCloseAlert}
                                className={`w-full py-3.5 px-6 rounded-2xl text-sm font-bold text-white transition-all transform active:scale-95 uppercase tracking-wider ${
                                    alert.type === 'success' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30' :
                                    alert.type === 'error' ? 'bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/30' :
                                    'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/30'
                                }`}
                            >
                                Ok, entendi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirm.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center relative">
                            <button onClick={() => handleConfirmClose(false)} className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                            
                            <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            
                            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2 uppercase">
                                Confirmar Ação
                            </h3>
                            
                            <p className="text-slate-500 text-sm font-medium mb-6 leading-relaxed">
                                {confirm.message}
                            </p>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleConfirmClose(false)}
                                    className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-bold transition-colors uppercase tracking-wider"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleConfirmClose(true)}
                                    className="flex-1 py-3.5 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-2xl text-sm font-bold transition-colors shadow-lg shadow-pink-500/30 uppercase tracking-wider"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </FarmaciaAlertContext.Provider>
    );
};
