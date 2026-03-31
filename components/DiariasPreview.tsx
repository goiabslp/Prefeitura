
import React, { useMemo } from 'react';
import { AppState, EvidenceItem } from '../types';
import { PageWrapper } from './PageWrapper';

interface DiariasPreviewProps {
  state: AppState;
  isGenerating: boolean;
}

export const DiariasPreview: React.FC<DiariasPreviewProps> = ({ state, isGenerating }) => {
  // Desabilita Marca D'agua especificamente para o módulo de diárias
  const stateNoWatermark = {
    ...state,
    branding: {
      ...state?.branding,
      watermark: {
        ...state?.branding?.watermark,
        enabled: false
      }
    }
  };

  const { branding = {} as any, document: docConfig = {} as any, content = {} as any } = state || {};

  const pages = useMemo(() => {
    const result: { type: 'diaria-form' | 'extra-flow' | 'evidences'; content: any }[] = [{ type: 'diaria-form', content: '' }];

    // Bloco 05: Anexo de Texto
    if (content.showExtraField && content.extraFieldText) {
      const text = content.extraFieldText;
      const MAX_LINES_EXTRA = 30;
      const CHARS_PER_LINE = 85;

      const paragraphs = text.split('\n');
      let currentPageText = '';
      let currentLinesUsed = 0;

      paragraphs.forEach((p) => {
        const linesInP = Math.max(1, Math.ceil(p.length / CHARS_PER_LINE));
        if ((currentLinesUsed + linesInP) > MAX_LINES_EXTRA && currentPageText) {
          result.push({ type: 'extra-flow', content: currentPageText });
          currentPageText = p + '\n';
          currentLinesUsed = linesInP;
        } else {
          currentPageText += p + '\n';
          currentLinesUsed += linesInP;
        }
      });
      if (currentPageText) result.push({ type: 'extra-flow', content: currentPageText });
    }

    // Bloco 06: Evidências
    if (content.evidenceItems && content.evidenceItems.length > 0) {
      const ITEMS_PER_PAGE = 2;
      for (let i = 0; i < content.evidenceItems.length; i += ITEMS_PER_PAGE) {
        result.push({
          type: 'evidences',
          content: content.evidenceItems.slice(i, i + ITEMS_PER_PAGE)
        });
      }
    }
    return result;
  }, [content.extraFieldText, content.showExtraField, content.evidenceItems]);

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: 'Pendente',
      in_progress: 'Em Andamento',
      awaiting_approval: 'Aguard. Apro.',
      approved: 'Aprovado',
      finishing: 'Finalizando',
      completed: 'Concluído',
      canceled: 'Cancelado',
      rejected: 'Rejeitado'
    };
    return map[status] || status;
  };

  const getPaymentStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: 'Pendente',
      contabilidade: 'Contabilidade',
      paid: 'Pago'
    };
    return map[status] || status;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return dateStr;
    }
  };

  const renderDiariaPage1 = () => {
    const showSigs = content.showDiariaSignatures !== false;
    return (
      <div className="w-full flex flex-col gap-2 text-[9.5pt] leading-tight text-slate-800">
        <div className="flex items-start justify-between mb-2">
          {docConfig.showLeftBlock && content.leftBlockText && (
            <div className="text-left">
              <div className="whitespace-pre-wrap font-bold" style={{ fontSize: `${docConfig.leftBlockStyle?.size || 9}pt`, color: docConfig.leftBlockStyle?.color || '#475569' }}>
                {content.leftBlockText}
              </div>
            </div>
          )}
          {content.globalStatus && (
            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-[7pt] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded tracking-wide border border-slate-200">
                Status: {getStatusLabel(content.globalStatus)}
              </span>
              {content.paymentStatus && (
                <span className={`text-[7pt] uppercase font-bold px-2 py-0.5 rounded tracking-wide border ${content.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                  Pgto: {getPaymentStatusLabel(content.paymentStatus)} {content.paymentDate ? `(${formatDate(content.paymentDate)})` : ''}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
          <div className="bg-slate-100 px-3 py-1 border-b border-slate-300">
            <span className="font-black text-[7pt] text-slate-500 uppercase">01. Dados do Beneficiário</span>
          </div>
          <div className="p-2 space-y-1">
            <div><span className="text-[6pt] font-black text-slate-400 uppercase block leading-none">Nome do Servidor</span><span className="font-bold text-[10pt] text-slate-900">{content.requesterName || '---'}</span></div>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-[6pt] font-black text-slate-400 uppercase block leading-none">Cargo</span><span className="font-semibold">{content.requesterRole || '---'}</span></div>
              <div><span className="text-[6pt] font-black text-slate-400 uppercase block leading-none">Setor de Atendimento</span><span className="font-semibold">{content.requesterSector || '---'}</span></div>
            </div>
          </div>
        </div>

        <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
          <div className="bg-slate-100 px-3 py-1 border-b border-slate-300">
            <span className="font-black text-[7pt] text-slate-500 uppercase">02. Logística e Itinerário</span>
          </div>
          <div className="p-2">
            <div className="mb-1"><span className="text-[6pt] font-black text-slate-400 uppercase block leading-none">Destino / UF</span><span className="font-bold">{content.destination || '---'}</span></div>
            <div className="grid grid-cols-2 gap-2 mb-1">
              <div className="bg-slate-50 p-1.5 border border-slate-200 rounded">
                <span className="text-[5.5pt] font-black text-slate-500 uppercase block">Saída</span>
                <span className="font-bold text-[8.5pt]">{content.departureDateTime ? new Date(content.departureDateTime).toLocaleString('pt-BR') : '---'}</span>
              </div>
              <div className="bg-slate-50 p-1.5 border border-slate-200 rounded">
                <span className="text-[5.5pt] font-black text-slate-500 uppercase block">Retorno</span>
                <span className="font-bold text-[8.5pt]">{content.returnDateTime ? new Date(content.returnDateTime).toLocaleString('pt-BR') : '---'}</span>
              </div>
            </div>
            <div className="flex gap-4 text-[8pt]">
              <span><b className="text-slate-400 uppercase text-[6pt]">Pernoites:</b> {content.lodgingCount || 0}</span>
              <span><b className="text-slate-400 uppercase text-[6pt]">Distância:</b> {content.distanceKm || 0} KM</span>
            </div>
          </div>
        </div>

        <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
          <div className="bg-slate-100 px-3 py-1 border-b border-slate-300">
            <span className="font-black text-[7pt] text-slate-500 uppercase">03. Resumo Financeiro</span>
          </div>
          <div className="p-2 flex items-center justify-between">
            <div><span className="text-[6pt] font-black text-slate-400 uppercase block">Valor Solicitado</span><span className="text-[13pt] font-black" style={{ color: branding.primaryColor || '#4f46e5' }}>{content.requestedValue || 'R$ 0,00'}</span></div>
            <div className="text-center bg-amber-50 border border-amber-200 px-3 py-1 rounded">
              <span className="text-[5.5pt] font-black text-amber-600 uppercase block">Previsão Pagamento</span>
              <span className="text-[9pt] font-black text-amber-800">{content.paymentForecast || '---'}</span>
            </div>
            <div className="text-right"><span className="text-[6pt] font-black text-slate-400 uppercase block">Autorizado por</span><span className="font-bold text-[9pt]">{content.authorizedBy || '---'}</span></div>
          </div>
        </div>

        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden min-h-[40mm]" style={{ borderColor: branding.secondaryColor || '#0f172a' }}>
          <div className="px-3 py-1" style={{ backgroundColor: branding.secondaryColor || '#0f172a' }}><span className="font-black text-[7pt] text-white uppercase tracking-widest">04. Justificativa Resumida</span></div>
          <div className="p-4 text-justify leading-relaxed whitespace-pre-wrap flex-1 bg-white italic text-[10pt]">
            {content.descriptionReason || 'Nenhuma justificativa informada.'}
          </div>
        </div>

        {showSigs && (
          <div className="mt-auto pt-24 flex flex-col items-center gap-20 w-full">
            <div className="w-64 border-t border-slate-900 pt-1 text-center">
              <p className="font-black uppercase text-[8.5pt]">{content.requesterName || 'SERVIDOR SOLICITANTE'}</p>
              <p className="text-[7pt] text-slate-500 font-bold uppercase">Requerente</p>
            </div>
            <div className="grid grid-cols-2 w-full gap-8">
              <div className="border-t border-slate-900 pt-1 text-center"><p className="font-black uppercase text-[8pt]">Visto Contabilidade</p><p className="text-[6.5pt] text-slate-500 font-bold uppercase">Tesouraria</p></div>
              <div className="text-center w-full relative group/sig">
                {content.digitalSignature?.enabled && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 text-[6pt] text-slate-500 uppercase tracking-widest leading-none pb-1">
                    <p className="font-bold text-emerald-600">Assinado Digitalmente</p>
                    <p>IP: {content.digitalSignature.ip}</p>
                    <p>ID: <span className="font-mono">{content.digitalSignature.id}</span></p>
                    <p className="text-[5pt] normal-case opacity-70">{new Date(content.digitalSignature.date).toLocaleString('pt-BR')}</p>
                  </div>
                )}
                <div className="border-t border-slate-900 pt-1">
                  <p className="font-black uppercase text-[8pt]">{content.signatureName || 'AUTORIZADOR'}</p>
                  <p className="text-[6.5pt] text-slate-500 font-bold uppercase leading-none">{content.signatureRole || 'Responsável'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {pages.map((page, pageIndex) => (
        <PageWrapper key={pageIndex} state={stateNoWatermark} pageIndex={pageIndex} totalPages={pages.length} isGenerating={isGenerating}>
          {page.type === 'diaria-form' ? (
            <>
              <h1 className="font-black mb-4 leading-tight tracking-tighter uppercase text-[18pt] text-center border-b-2 pb-2" style={{ color: branding.primaryColor || '#4f46e5', borderColor: `${branding.primaryColor || '#4f46e5'}10` }}>{content.title}</h1>
              {renderDiariaPage1()}
            </>
          ) : page.type === 'extra-flow' ? (
            <div className="flex flex-col h-full">
              <div className="px-3 py-1 rounded-t-lg" style={{ backgroundColor: branding.secondaryColor || '#475569' }}><span className="font-black text-[7.5pt] text-white uppercase tracking-widest">Informações Adicionais / Anexo - Cont.</span></div>
              <div className="flex-1 p-6 border border-slate-300 border-t-0 rounded-b-lg bg-slate-50/30 text-[10.5pt] leading-relaxed text-justify whitespace-pre-wrap">{page.content}</div>
            </div>
          ) : (
            <div className="flex flex-col h-full gap-6">
              <div className="px-3 py-1 rounded-t-lg" style={{ backgroundColor: branding.primaryColor || '#4f46e5' }}><span className="font-black text-[7.5pt] text-white uppercase tracking-widest">06. Evidências / Comprovantes</span></div>
              <div className={`flex-1 grid ${(page.content as EvidenceItem[]).length === 1 ? 'grid-rows-1' : 'grid-rows-2'} gap-4`}>
                {(page.content as EvidenceItem[]).map((item, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-slate-50/20 p-2 relative h-full">
                    <div className="mb-2 border-b border-slate-200 pb-1 shrink-0"><span className="text-[7pt] font-black text-slate-400 uppercase">Item: {item.title || 'Sem título'}</span></div>
                    <div className="flex-1 flex items-center justify-center bg-white rounded-lg border border-slate-100 overflow-hidden relative min-h-0">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="absolute inset-0 w-full h-full object-contain p-1" /> : <div className="text-slate-200 flex flex-col items-center"><div className="w-16 h-16 border-4 border-dashed border-slate-100 rounded-full mb-2"></div><span className="text-[10pt] font-bold">Sem imagem</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PageWrapper>
      ))}
    </>
  );
};
