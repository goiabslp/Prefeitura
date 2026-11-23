import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, Info, X } from 'lucide-react';

const NOTICE_KEY = 'compras_aviso_regularizacao_contabil_2026';
const RESUME_AT = new Date('2026-12-01T00:00:00-03:00').getTime();

interface PurchaseAccountingNoticeModalProps {
  visible: boolean;
}

/**
 * Aviso temporario para /Compras, /Editor/Compras e /Historico/Compras.
 * Nao interfere na criacao, no salvamento ou na tramitacao dos pedidos.
 */
const PurchaseAccountingNoticeModal: React.FC<PurchaseAccountingNoticeModalProps> = ({ visible }) => {
  const [isOpen, setIsOpen] = useState(false);
  const acknowledgeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!visible) {
      setIsOpen(false);
      return;
    }

    const updateVisibility = () => {
      let acknowledged = false;
      try {
        acknowledged = sessionStorage.getItem(NOTICE_KEY) === 'acknowledged';
      } catch {
        // O aviso continua funcionando mesmo se o armazenamento estiver indisponivel.
      }
      setIsOpen(Date.now() < RESUME_AT && !acknowledged);
    };

    updateVisibility();
    const intervalId = window.setInterval(updateVisibility, 60_000);
    return () => window.clearInterval(intervalId);
  }, [visible]);

  useEffect(() => {
    if (isOpen) acknowledgeButtonRef.current?.focus();
  }, [isOpen]);

  const handleAcknowledge = () => {
    try {
      sessionStorage.setItem(NOTICE_KEY, 'acknowledged');
    } catch {
      // Ainda e possivel fechar o modal sem armazenamento.
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-accounting-notice-title"
        aria-describedby="purchase-accounting-notice-description"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-5 py-5 sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <CalendarClock className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-800">Aviso importante</p>
            <h2 id="purchase-accounting-notice-title" className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">
              Comunicado do Setor de Compras
            </h2>
          </div>
          <button
            type="button"
            onClick={handleAcknowledge}
            aria-label="Fechar comunicado"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-amber-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div id="purchase-accounting-notice-description" className="space-y-4 px-5 py-5 text-sm leading-relaxed text-slate-700 sm:px-6 sm:text-base">
          <p>
            Informamos que, devido ao processo de <strong>regularização contábil</strong>,
            o encaminhamento de novos pedidos ao Setor de Compras estará temporariamente suspenso
            até <strong>30/11/2026</strong>.
          </p>
          <div className="flex gap-3 rounded-xl border border-sky-100 bg-sky-50 p-3.5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
            <p>
              <strong>Os pedidos poderão ser elaborados e cadastrados normalmente.</strong>{' '}
              O encaminhamento ao Setor de Compras será retomado a partir de <strong>01/12/2026</strong>.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
          <button
            ref={acknowledgeButtonRef}
            type="button"
            onClick={handleAcknowledge}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2"
          >
            Entendi
          </button>
        </div>
      </section>
    </div>
  );
};

export default PurchaseAccountingNoticeModal;
