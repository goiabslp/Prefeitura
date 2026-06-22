
import React, { forwardRef } from 'react';
import { AppState, BlockType } from '../types';
import { OficioPreview } from './OficioPreview';
import { ComprasPreview } from './ComprasPreview';
import { DiariasPreview } from './DiariasPreview';
import { LicitacaoPreview } from './LicitacaoPreview';

interface DocumentPreviewProps {
  state: AppState;
  isGenerating?: boolean;
  mode?: 'admin' | 'editor';
  blockType?: BlockType | null;
  customId?: string;
  scale?: number;
  onRemoveImage?: (id: string) => void;
}

export const DocumentPreview = forwardRef<HTMLDivElement, DocumentPreviewProps>(({
  state,
  isGenerating = false,
  mode = 'editor',
  blockType,
  customId = "preview-scaler",
  scale,
  onRemoveImage
}, ref) => {

  // Decide qual componente de visualização renderizar
  const renderPreviewContent = () => {
    if (!state || !state.content) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-slate-400">
          <p>Documento indisponível para visualização.</p>
        </div>
      );
    }
    const effectiveBlock = blockType || (state.content.subType ? 'diarias' : 'oficio');

    switch (effectiveBlock) {
      case 'diarias':
        return <DiariasPreview state={state} isGenerating={isGenerating} />;
      case 'compras':
        return <ComprasPreview state={state} isGenerating={isGenerating} />;
      case 'licitacao':
        return <LicitacaoPreview state={state} isGenerating={isGenerating} />;

      case 'oficio':
      default:
        return <OficioPreview state={state} isGenerating={isGenerating} onRemoveImage={onRemoveImage} />;
    }
  };

  return (
    <div className={`flex justify-center items-start overflow-auto w-full h-full ${isGenerating ? 'bg-white p-0 m-0' : 'bg-slate-200/40 backdrop-blur-sm pt-8 pb-20 px-4'}`}>
      <div id={customId} ref={ref} className={`origin-top transition-transform duration-300 ${isGenerating ? 'scale-100 transform-none' : (scale ? '' : 'scale-[0.45] md:scale-[0.55] lg:scale-[0.6] desktop:scale-[0.7] xl:scale-[0.7] 2xl:scale-[0.8]')}`} style={!isGenerating && scale ? { transform: `scale(${scale})` } : {}}>
        <div id={`${customId}-container`} className={isGenerating ? 'block w-[210mm] mx-auto p-0 bg-white' : 'flex flex-col items-center'}>
          {renderPreviewContent()}
        </div>
      </div>
    </div>
  );
});

DocumentPreview.displayName = 'DocumentPreview';
