import React, { useMemo } from 'react';
import { AppState } from '../types';
import { PageWrapper } from './PageWrapper';

interface LicitacaoPreviewProps {
  state: AppState;
  isGenerating: boolean;
}

export const LicitacaoPreview: React.FC<LicitacaoPreviewProps> = ({ state, isGenerating }) => {
  // Desabilita Marca D'agua especificamente para o módulo de licitação
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

  const { branding, document: docConfig = {} as any, content = {} as any } = state || {};

  const pages = useMemo(() => {
    // Calibração ultra-conservadora para evitar transbordo no rodapé
    const SECURITY_MARGIN_LINES = 4;
    const TOTAL_LINES_CAPACITY = 32;
    const CHARS_PER_LINE = 65;

    // Espaço para assinatura (aprox 9 linhas)
    const SIGNATURE_LINES = 9;

    // Limite para páginas normais (A partir da 2)
    const LIMIT_NORMAL = TOTAL_LINES_CAPACITY - SECURITY_MARGIN_LINES;

    const items = [...(content.itens || []).map((item: any) => ({
      descricao: item.descricao || item.name || '',
      quantidade: item.quantidade || 0,
      unidade: item.observacoes || item.unidade || 'UN'
    }))];

    // SEMPRE começamos com a Página 1 vazia de itens (reservada para justificativas, dados do solicitante, etc.)
    const resultPages: any[][] = [[]];

    if (items.length === 0) {
      return resultPages;
    }

    let currentLinesUsed = 5;
    let currentPageItems: any[] = [];

    while (items.length > 0) {
      const item = items[0];
      const linesForName = Math.max(1, Math.ceil((item.descricao || '').length / CHARS_PER_LINE));
      const totalItemLines = linesForName + 1.2;

      if ((currentLinesUsed + totalItemLines) <= LIMIT_NORMAL) {
        currentPageItems.push(items.shift()!);
        currentLinesUsed += totalItemLines;

        if (items.length === 0) {
          if ((currentLinesUsed + SIGNATURE_LINES) > LIMIT_NORMAL) {
            resultPages.push(currentPageItems);
            resultPages.push([]); // Página extra só para assinatura
          } else {
            resultPages.push(currentPageItems);
          }
        }
      } else {
        resultPages.push(currentPageItems);
        currentPageItems = [];
        currentLinesUsed = 0;
      }
    }

    return resultPages;
  }, [content.itens]);

  const priorityStyles = {
    'Normal': 'bg-slate-100 text-slate-600 border-slate-200',
    'Urgente': 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <>
      {pages.map((itemsOnPage, pageIndex) => (
        <PageWrapper key={pageIndex} state={stateNoWatermark} pageIndex={pageIndex} totalPages={pages.length} isGenerating={isGenerating}>
          {pageIndex === 0 && (
            <div className="mb-6">
              {/* 1. Blocos de Endereçamento (Topo) */}
              <div className="flex justify-between items-start text-[9.5pt]">
                {docConfig.showLeftBlock && content.leftBlockText && (
                  <div
                    className="whitespace-pre-wrap max-w-[45%] leading-snug text-black"
                    style={{
                      fontSize: `${docConfig.leftBlockStyle?.size || 9}pt`,
                      color: '#000000'
                    }}
                  >
                    {content.leftBlockText}
                  </div>
                )}
                {docConfig.showRightBlock && content.rightBlockText && (
                  <div
                    className="whitespace-pre-wrap text-right max-w-[45%] leading-snug text-black"
                    style={{
                      fontSize: `${docConfig.rightBlockStyle?.size || 9}pt`,
                      color: '#000000'
                    }}
                  >
                    {content.rightBlockText}
                  </div>
                )}
              </div>

              <div className="h-6" />

              {/* 2. Cabeçalho de Identificação */}
              <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl flex justify-between items-center">
                <span className="font-black text-[7pt] uppercase tracking-[0.2em] text-blue-800">Pedido de Processo Licitatório</span>
                <span className="font-mono text-[8pt] text-black">
                  Protocolo: <span className="font-normal">{content.protocol || state.content?.protocol || 'AGUARDANDO FINALIZAÇÃO'}</span>
                </span>
              </div>

              {/* 3. Dados do Solicitante */}
              <div className="border border-slate-200 rounded-xl overflow-hidden my-4">
                <div className="bg-slate-50 px-3 py-1 border-b border-slate-200">
                  <span className="font-black text-[6.5pt] text-slate-500 uppercase tracking-wider">Identificação do Solicitante</span>
                </div>
                <div className="p-3 grid grid-cols-12 gap-4">
                  <div className="col-span-6">
                    <span className="text-[5.5pt] font-black text-slate-400 uppercase block leading-none mb-1">Nome Completo</span>
                    <span className="font-bold text-[10pt] text-black leading-none">{content.requesterName || '---'}</span>
                  </div>
                  <div className="col-span-3 border-l border-slate-100 pl-3">
                    <span className="text-[5.5pt] font-black text-slate-400 uppercase block leading-none mb-1">Cargo / Função</span>
                    <span className="font-semibold text-[8.5pt] text-slate-700 leading-none">{content.requesterRole || '---'}</span>
                  </div>
                  <div className="col-span-3 border-l border-slate-100 pl-3">
                    <span className="text-[5.5pt] font-black text-slate-400 uppercase block leading-none mb-1">Setor Origem</span>
                    <span className="font-semibold text-[8.5pt] text-slate-700 leading-none">{content.requesterSector || '---'}</span>
                  </div>
                </div>
              </div>

              {/* 4. Título / Objeto */}
              <div className="flex items-center gap-3 border-b-2 border-blue-100 pb-2 mt-6">
                <div className="flex-1 flex flex-col gap-1">
                  <h1 className="font-bold leading-tight tracking-tight text-[16pt] text-black">
                    {content.objeto || content.title || state.content?.title || 'Processo sem Finalidade/Objeto'}
                  </h1>
                </div>
                <div className={`px-3 py-1 rounded-full text-[8pt] font-black uppercase tracking-widest border shrink-0 ${priorityStyles[(content.prioridade || 'Normal') as keyof typeof priorityStyles]}`}>
                  {content.prioridade || 'Normal'}
                </div>
              </div>

              {/* 5. Dados Extras (Origem e Ficha Orçamentária) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden my-4 bg-slate-50/30">
                <div className="bg-slate-50 px-3 py-1 border-b border-slate-200">
                  <span className="font-black text-[6.5pt] text-slate-500 uppercase tracking-wider">Origem e Destinação de Recursos</span>
                </div>
                <div className="p-3 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[5.5pt] font-black text-slate-400 uppercase block leading-none mb-1">Origem do Recurso</span>
                    <span className="font-bold text-[9.5pt] text-slate-800">
                      {content.resolucaoDescricao && content.resolucaoDescricao !== 'N/A' 
                        ? `${content.resolucaoDescricao} Nº ${content.resolucaoNumero}` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="border-l border-slate-150 pl-4">
                    <span className="text-[5.5pt] font-black text-slate-400 uppercase block leading-none mb-1">Ficha Orçamentária</span>
                    <span className="font-bold text-[9.5pt] text-slate-800">{content.fichaOrcamentaria || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Justificativa Geral */}
              {content.justificativa && (
                <div className="bg-blue-50/20 p-4 rounded-xl border-l-4 border-blue-200 my-4">
                  <p className="text-[7pt] font-black text-blue-800 uppercase tracking-widest mb-1">Justificativa do Pedido:</p>
                  <p className="text-[10pt] text-black leading-relaxed italic whitespace-pre-wrap">
                    {content.justificativa}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 flex flex-col pb-12">
            {pageIndex === 1 && content.itens && content.itens.length > 0 && (
              <div className="bg-slate-50 border border-slate-100 px-4 py-1 rounded-lg mb-10">
                <span className="font-black text-[7pt] uppercase tracking-[0.2em] text-slate-600">Itens da Requisição</span>
              </div>
            )}

            {itemsOnPage.length > 0 && (
              <div className="space-y-3">
                {itemsOnPage.map((item, idx) => {
                  const absoluteIndex = pages.slice(0, pageIndex).reduce((acc, curr) => acc + curr.length, 0) + idx + 1;
                  return (
                    <div key={idx} className="flex items-start gap-3 text-[11pt] border-b border-blue-50 pb-2">
                      <span className="font-black text-blue-700 min-w-[30px]">{absoluteIndex.toString().padStart(2, '0')}.</span>
                      <div className="flex-1">
                        <span className="text-black font-medium leading-relaxed">{item.descricao || '---'}</span>
                        <div className="flex gap-4 mt-0.5 text-[8.5pt] font-bold uppercase tracking-widest text-slate-500">
                          <span>Quantidade: <span className="text-black">{item.quantidade}</span></span>
                          <span>Unidade: <span className="text-black">{item.unidade}</span></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Assinatura na última página */}
            {pageIndex === pages.length - 1 && (
              <div className="mt-auto">
                <div className="pt-24 flex justify-center">
                  <div className="w-72 text-center relative group/sig">
                    {content.digitalSignature?.enabled && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 text-[7pt] text-slate-500 uppercase tracking-widest leading-tight pb-1">
                        <p className="font-bold text-emerald-600">Assinado Digitalmente</p>
                        <p>Autenticador Mobile 2FA</p>
                        <p>IP: {content.digitalSignature.ip}</p>
                        <p>ID: <span className="font-mono">{content.digitalSignature.id}</span></p>
                        <p className="text-[6pt] normal-case opacity-70">{new Date(content.digitalSignature.date).toLocaleString('pt-BR')}</p>
                      </div>
                    )}
                    <div className="border-t-2 border-slate-950 pt-2">
                      <p className="font-black uppercase text-[10pt] text-black">{content.signatureName || 'Solicitante'}</p>
                      <p className="text-[8pt] font-bold text-slate-500 uppercase tracking-widest">{content.signatureRole || 'Cargo não informado'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PageWrapper>
      ))}
    </>
  );
};
