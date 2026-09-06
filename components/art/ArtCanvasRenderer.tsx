import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Download, Sparkles, Shield, Maximize2, RefreshCw, ZoomIn, ZoomOut, Check,
  Calendar, Clock, MapPin, Tag, ArrowRight
} from 'lucide-react';
import { ArtPublication, ArtVariation, ArtFormatType, ArtLogoItem, ArtLogoPosition } from '../../types';
import { getHaikeiWaveSvgPath } from '../../services/artAssetLibraries';

interface ArtCanvasRendererProps {
  publication: Partial<ArtPublication>;
  variation: ArtVariation;
  format: ArtFormatType;
  logo?: ArtLogoItem | null;
  primaryImage?: string | null;
  interactiveScale?: boolean;
  className?: string;
  onExportDone?: () => void;
}

// Função helper para transformar o título em palavras com destaque visual cromático, 3D e hierarquia de tamanho
export const getTitleWordsStructure = (title: string, highlightWords?: string[]) => {
  const words = (title || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  
  const normalizedHighlights = (highlightWords || []).map(w => w.toLowerCase().replace(/[^\wÀ-ú]/g, ''));
  
  return words.map((word, index) => {
    const cleanWord = word.toLowerCase().replace(/[^\wÀ-ú]/g, '');
    const isExplicitHighlight = normalizedHighlights.includes(cleanWord);
    // Se não houver destaque explícito da IA, a 1ª palavra (ou as 2 primeiras se houver mais de 2) recebe destaque de cor + 3D
    const isDefaultHighlight = (!highlightWords || highlightWords.length === 0) && (index === 0 || (words.length > 2 && index === 1));
    const isHighlight = isExplicitHighlight || isDefaultHighlight;
    return {
      text: word,
      isHighlight
    };
  });
};

export const ArtCanvasRenderer: React.FC<ArtCanvasRendererProps> = ({
  publication,
  variation,
  format,
  logo,
  primaryImage,
  interactiveScale = true,
  className = '',
  onExportDone
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(0.25);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Dimensões nativas oficiais
  const nativeWidth = 1080;
  const nativeHeight = format === 'vertical' ? 1920 : 1080;

  // Ajusta a escala visual responsiva baseada no container pai
  const updateScale = useCallback(() => {
    if (!containerRef.current || !interactiveScale) return;
    const parentWidth = containerRef.current.parentElement?.clientWidth || 360;
    const parentHeight = containerRef.current.parentElement?.clientHeight || 600;

    const scaleX = (parentWidth - 32) / nativeWidth;
    const scaleY = (parentHeight - 48) / nativeHeight;
    const fitScale = Math.min(scaleX, scaleY, 0.45);
    setScale(Math.max(0.15, fitScale));
  }, [interactiveScale, nativeWidth, nativeHeight]);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  // Função para exportar em resolução nativa 1080x1920 ou 1080x1080 em PNG nítido
  const exportToPNG = async () => {
    setIsExporting(true);
    try {
      // Cria canvas offscreen na resolução real nativa
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = nativeWidth;
      offscreenCanvas.height = nativeHeight;
      const ctx = offscreenCanvas.getContext('2d');

      if (!ctx) throw new Error('Não foi possível inicializar o contexto 2D');

      // 1. Fundo com gradiente ou cor sólida
      if (variation.gradientBackground) {
        const grad = ctx.createLinearGradient(0, 0, nativeWidth, nativeHeight);
        if (variation.styleName.toLowerCase().includes('moderna')) {
          grad.addColorStop(0, '#090d16');
          grad.addColorStop(0.6, variation.primaryColor);
          grad.addColorStop(1, '#1e1b4b');
        } else if (variation.styleName.toLowerCase().includes('impactante')) {
          grad.addColorStop(0, '#18181b');
          grad.addColorStop(0.6, '#09090b');
          grad.addColorStop(1, '#27272a');
        } else {
          grad.addColorStop(0, '#090d16');
          grad.addColorStop(0.6, variation.primaryColor);
          grad.addColorStop(1, '#0f172a');
        }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = variation.backgroundColor || '#0f172a';
      }
      ctx.fillRect(0, 0, nativeWidth, nativeHeight);

      // 2. Foto principal se fornecida
      if (primaryImage) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = primaryImage;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });

          // Desenha imagem com tratamento fotográfico profissional adaptada para cada formato
          ctx.save();
          const brightness = variation.photoTreatment?.brightness || 1.05;
          const contrast = variation.photoTreatment?.contrast || 1.1;
          const saturate = variation.photoTreatment?.saturation || 1.15;
          ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;

          // REGRA PRINCIPAL: NÃO DIVIDIR A IMAGEM — FOTOGRAFIA PRINCIPAL ÚNICA PREENCHENDO 100% DA COMPOSIÇÃO
          // Calcula aspecto para 'object-fit: cover' perfeito no canvas sem deformar a foto
          const imgAspect = img.width / img.height;
          const canvasAspect = nativeWidth / nativeHeight;
          let drawWidth = nativeWidth;
          let drawHeight = nativeHeight;
          let drawX = 0;
          let drawY = 0;

          if (imgAspect > canvasAspect) {
            drawWidth = nativeHeight * imgAspect;
            drawX = (nativeWidth - drawWidth) / 2;
          } else {
            drawHeight = nativeWidth / imgAspect;
            drawY = (nativeHeight - drawHeight) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          ctx.filter = 'none';

          // Vinheta Cinematográfica suave sobre a fotografia inteira
          const vig = ctx.createRadialGradient(nativeWidth / 2, nativeHeight * 0.45, nativeWidth * 0.2, nativeWidth / 2, nativeHeight * 0.45, nativeWidth * 0.85);
          vig.addColorStop(0, 'rgba(0,0,0,0)');
          vig.addColorStop(1, `rgba(0,0,0,${variation.photoTreatment?.vignetteStrength || 0.35})`);
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, nativeWidth, nativeHeight);

          // Scrim de legibilidade superior para contraste da logo
          const topScrim = ctx.createLinearGradient(0, 0, 0, 280);
          topScrim.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
          topScrim.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = topScrim;
          ctx.fillRect(0, 0, nativeWidth, 280);

          // Scrim de legibilidade inferior para os textos e informações SOBRE a fotografia
          const bottomScrim = ctx.createLinearGradient(0, nativeHeight * 0.32, 0, nativeHeight);
          bottomScrim.addColorStop(0, 'rgba(15, 23, 42, 0)');
          bottomScrim.addColorStop(0.5, 'rgba(15, 23, 42, 0.65)');
          bottomScrim.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
          ctx.fillStyle = bottomScrim;
          ctx.fillRect(0, nativeHeight * 0.32, nativeWidth, nativeHeight * 0.68);
          ctx.restore();
        } catch (e) {
          console.warn('Erro ao renderizar imagem no canvas offscreen:', e);
        }
      }

      // 3. Elementos gráficos e molduras decorativas
      // 3. Elementos gráficos, luzes e moldura cívica dinâmica
      ctx.save();
      // Barra cívica superior com gradiente
      const barGrad = ctx.createLinearGradient(48, 40, nativeWidth - 48, 40);
      barGrad.addColorStop(0, variation.accentColor || '#f59e0b');
      barGrad.addColorStop(0.5, variation.secondaryColor || '#4f46e5');
      barGrad.addColorStop(1, variation.primaryColor || '#06b6d4');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(48, 38, nativeWidth - 96, 12, 6);
      ctx.fill();

      // Partículas luminosas decorativas
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(120, 180, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(nativeWidth - 140, 260, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Categoria & Palavra de Ação/Impacto Obrigatória
      const catText = (publication.category || 'COMUNICAÇÃO OFICIAL').toUpperCase();
      ctx.save();
      ctx.font = '900 22px Montserrat, Inter, sans-serif';
      ctx.fillStyle = variation.accentColor || '#f59e0b';
      ctx.fillText(`•  ${catText}`, 64, format === 'vertical' ? 120 : 100);

      // Palavra de impacto obrigatória com efeito de selo tridimensional
      const effectiveImpact = variation.impactWord || (
        publication.eventDate ? 'VEM AÍ!' :
        (publication.category?.toLowerCase().includes('saúde') ? 'ATENÇÃO!' :
        (publication.category?.toLowerCase().includes('esporte') ? 'GRANDE EVENTO!' :
        (publication.category?.toLowerCase().includes('obra') ? 'NOVIDADE!' : 'PARTICIPE!')))
      );

      const impactStr = `⚡ ${effectiveImpact.toUpperCase()}`;
      ctx.font = '900 22px Montserrat, Inter, sans-serif';
      const impWidth = ctx.measureText(impactStr).width;
      const impX = 64 + ctx.measureText(`•  ${catText}`).width + 24;
      const impY = format === 'vertical' ? 95 : 75;
      
      // Sombra e fundo da pílula de impacto
      ctx.shadowColor = variation.accentColor || 'rgba(245, 158, 11, 0.6)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = variation.secondaryColor || '#4f46e5';
      ctx.beginPath();
      ctx.roundRect(impX, impY, impWidth + 28, 40, 14);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.fillText(impactStr, impX + 14, impY + 28);
      ctx.restore();

      // 5. TÍTULO PRINCIPAL PROTAGONISTA — FÓRMULA VISUAL (COR DIFERENTE + TAMANHO MAIOR + EFEITO 3D + SOMBRA + APOIO GRÁFICO)
      const titleText = variation.headlineSummary || publication.title || 'COMUNICADO OFICIAL';
      const wordsStructure = getTitleWordsStructure(titleText, variation.titleHighlightWords);
      
      let curX = 64;
      let curY = format === 'vertical' ? (primaryImage ? nativeHeight * 0.52 : 290) : (primaryImage ? 230 : 190);
      const maxWidth = nativeWidth - 128;
      const lineHeight = 94;

      ctx.save();
      for (let n = 0; n < wordsStructure.length; n++) {
        const item = wordsStructure[n];
        const isHigh = item.isHighlight;
        const fontStr = isHigh 
          ? '900 82px Montserrat, Outfit, sans-serif'
          : '900 68px Montserrat, Outfit, sans-serif';
        
        ctx.font = fontStr;
        const wordText = item.text.toUpperCase();
        const metrics = ctx.measureText(wordText + ' ');

        if (curX + metrics.width > maxWidth && n > 0) {
          curX = 64;
          curY += lineHeight;
        }

        // 1ª Camada: Sombra e Chanfro 3D Profundo
        ctx.save();
        ctx.font = fontStr;
        ctx.fillStyle = '#000000';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.98)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.fillText(wordText, curX + 4, curY + 6);

        // 2ª Camada: Cor de Destaque Vibrante (ou Branco) com Glow Integrado
        ctx.fillStyle = isHigh ? (variation.accentColor || '#f59e0b') : (variation.textColor || '#ffffff');
        ctx.shadowColor = isHigh ? (variation.accentColor || '#f59e0b') : 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = isHigh ? 28 : 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText(wordText, curX, curY);
        ctx.restore();

        curX += metrics.width;
      }
      ctx.restore();

      // Linha gráfica decorativa integrada conectada ao título
      ctx.save();
      ctx.fillStyle = variation.accentColor || '#f59e0b';
      ctx.shadowColor = variation.accentColor || '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.roundRect(64, curY + 22, 160, 6, 3);
      ctx.fill();
      ctx.restore();

      curY += 72;

      // 6. SUBTÍTULO / CHAMADA SECUNDÁRIA PROTAGONISTA — COMBINAÇÃO DE TAMANHO + COR + PESO + SOMBRA + FORMAS
      const subText = variation.subtitleSummary || publication.subtitle;
      if (subText) {
        ctx.save();
        ctx.font = '900 32px Montserrat, Inter, sans-serif';
        const subUpper = subText.toUpperCase();
        const subMetrics = ctx.measureText(subUpper);
        const badgeW = Math.min(nativeWidth - 128, subMetrics.width + 48);
        const badgeH = 58;

        // Fundo em cápsula translúcida com borda de destaque
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = variation.accentColor || 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.roundRect(64, curY, badgeW, badgeH, 16);
        ctx.fill();
        ctx.stroke();

        // Barra gráfica vertical de acento
        ctx.fillStyle = variation.accentColor || '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(70, curY + 8, 8, badgeH - 16, 4);
        ctx.fill();

        // Texto do subtítulo nítido com sombra
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(subUpper, 90, curY + 41);
        curY += 85;
        ctx.restore();
      }

      // 7. Bloco Oficial de Informações Físicas (Data, Horário, Local) com Glassmorphism
      if (publication.eventDate || publication.eventTime || publication.eventLocation) {
        const boxY = format === 'vertical' ? nativeHeight - 440 : nativeHeight - 340;
        ctx.save();
        // Fundo com vidro translúcido escuro
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.beginPath();
        ctx.roundRect(60, boxY, nativeWidth - 120, 175, 28);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.font = '800 28px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';

        let infoY = boxY + 52;
        if (publication.eventDate) {
          ctx.fillText(`📅  DATA: ${publication.eventDate}`, 90, infoY);
          infoY += 46;
        }
        if (publication.eventTime) {
          ctx.fillText(`⏰  HORÁRIO: ${publication.eventTime}`, 90, infoY);
          infoY += 46;
        }
        if (publication.eventLocation) {
          ctx.fillText(`📍  LOCAL: ${publication.eventLocation}`, 90, infoY);
        }
        ctx.restore();
      }

      // CTA Oficial em 3D
      if (publication.ctaText) {
        const ctaStr = `${publication.ctaText.toUpperCase()} →`;
        ctx.save();
        ctx.font = '900 24px Montserrat, Inter, sans-serif';
        const ctaW = ctx.measureText(ctaStr).width + 50;
        const ctaY = format === 'vertical' ? nativeHeight - 220 : nativeHeight - 140;

        ctx.fillStyle = variation.secondaryColor || '#4f46e5';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;
        ctx.beginPath();
        ctx.roundRect(60, ctaY, ctaW, 58, 20);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ctaStr, 85, ctaY + 38);
        ctx.restore();
      }

      // 8. Logo Institucional (Preservando Proporção Rigorosa)
      if (logo?.dataUrl) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          logoImg.src = logo.dataUrl;
          await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve;
          });

          // Calcula dimensões preservando proporção
          const logoWidth = (nativeWidth * (variation.logoSizePercent || 20)) / 100;
          const aspect = logoImg.height / logoImg.width;
          const logoHeight = logoWidth * aspect;

          let logoX = nativeWidth - logoWidth - 60;
          let logoY = 60;

          // Posições
          if (variation.logoPosition === 'top_left') {
            logoX = 60;
            logoY = 60;
          } else if (variation.logoPosition === 'bottom_right') {
            logoX = nativeWidth - logoWidth - 60;
            logoY = nativeHeight - logoHeight - 60;
          } else if (variation.logoPosition === 'bottom_left') {
            logoX = 60;
            logoY = nativeHeight - logoHeight - 60;
          } else if (variation.logoPosition === 'center_bottom') {
            logoX = (nativeWidth - logoWidth) / 2;
            logoY = nativeHeight - logoHeight - 60;
          }

          ctx.save();
          ctx.globalAlpha = variation.logoOpacity || 1;
          ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
          ctx.restore();
        } catch (e) {
          console.warn('Erro ao renderizar logo no exportador:', e);
        }
      }

      // 9. Download automático do arquivo PNG gerado
      const dataUrl = offscreenCanvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const cleanTitle = (publication.title || 'arte_prefeitura')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 30);
      link.download = `${cleanTitle}_${format}_${nativeWidth}x${nativeHeight}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onExportDone?.();
    } catch (error) {
      console.error('Falha na exportação PNG:', error);
      alert('Não foi possível exportar a arte no momento.');
    } finally {
      setIsExporting(false);
    }
  };

  // Posicionamento da logo para o CSS do preview
  const getLogoPositionStyles = (pos: ArtLogoPosition) => {
    const basePadding = 60;
    switch (pos) {
      case 'top_left':
        return { top: `${basePadding}px`, left: `${basePadding}px` };
      case 'bottom_left':
        return { bottom: `${basePadding}px`, left: `${basePadding}px` };
      case 'bottom_right':
        return { bottom: `${basePadding}px`, right: `${basePadding}px` };
      case 'center_top':
        return { top: `${basePadding}px`, left: '50%', transform: 'translateX(-50%)' };
      case 'center_bottom':
        return { bottom: `${basePadding}px`, left: '50%', transform: 'translateX(-50%)' };
      case 'top_right':
      default:
        return { top: `${basePadding}px`, right: `${basePadding}px` };
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Barra de Ações Rápidas de Visualização e Download */}
      <div className="flex items-center justify-between w-full max-w-[440px] mb-3 px-2 gap-2">
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-700 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{format === 'vertical' ? '1080 × 1920 (Stories)' : '1080 × 1080 (Feed)'}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScale(prev => Math.max(0.15, prev - 0.05))}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            title="Reduzir zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono font-bold text-slate-500">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale(prev => Math.min(0.5, prev + 0.05))}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={exportToPNG}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer disabled:opacity-50 ml-2"
          >
            {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Baixar PNG</span>
          </button>
        </div>
      </div>

      {/* Frame Visual com Escala Exata */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden rounded-3xl border border-slate-300/80 shadow-2xl bg-slate-900 flex items-center justify-center select-none"
        style={{
          width: `${nativeWidth * scale}px`,
          height: `${nativeHeight * scale}px`
        }}
      >
        {/* Camada Nativa em 1080x1920 ou 1080x1080 escalonada via CSS transform */}
        <div
          className="absolute top-0 left-0 origin-top-left flex flex-col justify-between overflow-hidden"
          style={{
            width: `${nativeWidth}px`,
            height: `${nativeHeight}px`,
            transform: `scale(${scale})`,
            background: variation.gradientBackground || variation.backgroundColor || '#0f172a',
            fontFamily: variation.fontFamilyBody || 'Inter, sans-serif'
          }}
        >
          {/* 1. Imagem do Usuário como Fotografia Principal Única (100% da Composição — SEM DIVISÕES) */}
          {primaryImage && (
            <div className="absolute inset-0 w-full h-full overflow-hidden">
              <img
                src={primaryImage}
                alt="Fotografia Principal da Publicação"
                className="w-full h-full object-cover"
                style={{
                  filter: `brightness(${variation.photoTreatment?.brightness || 1.05}) contrast(${variation.photoTreatment?.contrast || 1.1}) saturate(${variation.photoTreatment?.saturation || 1.15})`
                }}
              />
              
              {/* Vinheta Cinematográfica Suave */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 45%, transparent 40%, rgba(0, 0, 0, ${variation.photoTreatment?.vignetteStrength || 0.35}) 100%)`
                }}
              />

              {/* Efeito de Iluminação Cênica Suave */}
              {variation.photoTreatment?.lightingEffect && variation.photoTreatment.lightingEffect !== 'none' && (
                <div 
                  className="absolute inset-0 pointer-events-none mix-blend-screen opacity-35"
                  style={{
                    background: variation.photoTreatment.lightingEffect === 'sunlight_leak'
                      ? 'radial-gradient(circle at 15% 10%, rgba(251, 191, 36, 0.5) 0%, transparent 60%)'
                      : variation.photoTreatment.lightingEffect === 'stage_light'
                      ? 'radial-gradient(circle at 85% 15%, rgba(56, 189, 248, 0.45) 0%, transparent 65%)'
                      : 'radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.35) 0%, transparent 70%)'
                  }}
                />
              )}

              {/* Scrim Superior Suave para Legibilidade do Topo/Logo */}
              <div 
                className="absolute inset-x-0 top-0 h-64 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)'
                }}
              />

              {/* Scrim Inferior Suave para Legibilidade de Título e Informações SOBRE a Foto */}
              <div 
                className="absolute inset-x-0 bottom-0 h-[60%] pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.6) 45%, rgba(0, 0, 0, 0.2) 75%, transparent 100%)'
                }}
              />

              {/* Tonalidade Institucional Suave Integrada (Sem esconder a fotografia) */}
              <div 
                className="absolute inset-0 pointer-events-none mix-blend-color opacity-20"
                style={{
                  background: variation.backgroundColor || '#0f172a'
                }}
              />
            </div>
          )}

          {/* 2. Barra / Linha Cívica Superior com Gradiente Dinâmico */}
          <div 
            className="absolute top-10 left-12 right-12 h-3 rounded-full z-20 shadow-lg"
            style={{ 
              background: `linear-gradient(90deg, ${variation.accentColor || '#f59e0b'} 0%, ${variation.secondaryColor || '#4f46e5'} 50%, ${variation.primaryColor || '#06b6d4'} 100%)`,
              boxShadow: `0 0 20px ${variation.accentColor || 'rgba(245, 158, 11, 0.4)'}`
            }}
          />

          {/* 3. Elementos Gráficos Decorativos Dinâmicos (Partículas, Círculos e Luz) */}
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
            {/* Círculo de Luz / Glow Superior Esquerdo */}
            <div 
              className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-30 mix-blend-screen"
              style={{ background: variation.primaryColor || '#4f46e5' }}
            />
            {/* Círculo de Luz / Glow Inferior Direito */}
            <div 
              className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-35 mix-blend-screen"
              style={{ background: variation.accentColor || '#f59e0b' }}
            />
            {/* Arcos Geométricos Sutis de Movimento */}
            <div 
              className="absolute top-28 right-10 w-48 h-48 rounded-full border-2 border-dashed opacity-20 pointer-events-none"
              style={{ borderColor: variation.accentColor || '#f59e0b' }}
            />
            <div 
              className="absolute bottom-40 left-8 w-32 h-32 rounded-full border border-white/20 opacity-25 pointer-events-none"
            />
            {/* Partículas de Brilho */}
            <div className="absolute top-44 left-32 w-2 h-2 rounded-full bg-white/70 shadow-[0_0_8px_#ffffff] animate-ping" />
            <div className="absolute top-64 right-40 w-3 h-3 rounded-full bg-amber-300/80 shadow-[0_0_12px_#fbbf24]" />
            <div className="absolute bottom-96 right-16 w-2.5 h-2.5 rounded-full bg-sky-300/70 shadow-[0_0_10px_#7dd3fc]" />

            {/* Onda Fluida de Base (Haikei Shape Engine - Licença CC0 Livre) */}
            <div className="absolute inset-x-0 bottom-0 h-44 pointer-events-none opacity-20 mix-blend-screen overflow-hidden">
              <svg viewBox="0 0 1080 300" className="w-full h-full" fill="none">
                <path
                  d={getHaikeiWaveSvgPath(1)}
                  fill={variation.primaryColor || '#1d4ed8'}
                />
              </svg>
            </div>
          </div>

          {/* 4. Logo da Prefeitura — Elemento Independente com Preservação Rigorosa de Aspect Ratio */}
          {logo?.dataUrl && (
            <div 
              className="absolute z-30 flex items-center"
              style={{
                ...getLogoPositionStyles(variation.logoPosition),
                width: `${(nativeWidth * (variation.logoSizePercent || 20)) / 100}px`,
                opacity: variation.logoOpacity || 1
              }}
            >
              <img
                src={logo.dataUrl}
                alt={logo.name || 'Logo Oficial'}
                className="w-full h-auto object-contain drop-shadow-2xl"
              />
            </div>
          )}

          {/* 5. Cabeçalho / Categoria e Palavra de Ação/Impacto */}
          <div className="relative z-20 px-16 pt-24 flex items-center gap-3 flex-wrap">
            {/* Tag da Categoria */}
            <div 
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[20px] font-black uppercase tracking-widest border backdrop-blur-md shadow-xl"
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                borderColor: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff'
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span>
              <span>{publication.category || 'Comunicação Oficial'}</span>
            </div>

            {/* Palavra de Impacto com Super Destaque Visual 3D */}
            {(() => {
              const impact = variation.impactWord || (
                publication.eventDate ? 'VEM AÍ!' :
                (publication.category?.toLowerCase().includes('saúde') ? 'ATENÇÃO!' :
                (publication.category?.toLowerCase().includes('esporte') ? 'GRANDE EVENTO!' :
                (publication.category?.toLowerCase().includes('obra') ? 'NOVIDADE!' : 'PARTICIPE!')))
              );
              return (
                <div 
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[20px] font-black uppercase tracking-wider text-white shadow-2xl border border-white/30 transform hover:scale-105 transition-transform"
                  style={{
                    background: variation.impactWordEffect === 'metallic'
                      ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 50%, #f59e0b 100%)'
                      : variation.impactWordEffect === 'glow'
                      ? `linear-gradient(135deg, ${variation.accentColor || '#f59e0b'} 0%, #ea580c 100%)`
                      : `linear-gradient(135deg, ${variation.secondaryColor || '#4f46e5'} 0%, #7c3aed 100%)`,
                    boxShadow: `0 4px 0 rgba(0,0,0,0.4), 0 8px 25px ${variation.accentColor || 'rgba(245, 158, 11, 0.5)'}, 0 0 35px rgba(255, 255, 255, 0.2)`
                  }}
                >
                  <span className="text-xl">⚡</span>
                  <span className="tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">{impact}</span>
                </div>
              );
            })()}
          </div>

          {/* 6. Selo Oficial Estilizado Flutuante & Badge de Confirmação em Estilo Sticker */}
          <div className="absolute top-28 right-16 z-20 pointer-events-none hidden sm:flex items-center gap-3">
            {variation.badgeLabel && (
              <div 
                className="px-4 py-2 rounded-2xl border-2 border-white flex items-center gap-2 backdrop-blur-md shadow-2xl -rotate-2 transform"
                style={{
                  background: `linear-gradient(135deg, ${variation.accentColor || '#f59e0b'} 0%, ${variation.secondaryColor || '#4f46e5'} 100%)`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.4)'
                }}
              >
                <span className="text-[12px] font-black text-white uppercase tracking-wider leading-tight drop-shadow-md">
                  {variation.badgeLabel}
                </span>
              </div>
            )}

            <div 
              className="w-18 h-18 rounded-full border-2 border-white/60 flex flex-col items-center justify-center text-center p-1 backdrop-blur-md shadow-2xl rotate-12 transform"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.5) 100%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 0 10px rgba(255,255,255,0.2)'
              }}
            >
              <Shield className="w-5 h-5 text-amber-300 drop-shadow mb-0.5" />
              <span className="text-[8px] font-black text-white uppercase tracking-tighter leading-tight">
                OFICIAL
              </span>
            </div>
          </div>

          {/* 7. Corpo Central de Textos — FOCO ABSOLUTO NO TÍTULO E SUBTÍTULO COM PROTAGONISMO GRÁFICO */}
          <div className="relative z-20 px-16 pb-12 flex flex-col justify-end flex-1">
            {/* TÍTULO PRINCIPAL: FÓRMULA VISUAL (COR DIFERENTE + TAMANHO MAIOR + EFEITO 3D + SOMBRA + APOIO GRÁFICO) */}
            <div className="relative mb-5 z-20">
              {/* Glow radial dinâmico envolvendo o título */}
              <div 
                className="absolute -inset-x-10 -inset-y-8 rounded-3xl opacity-40 blur-3xl pointer-events-none -z-10"
                style={{
                  background: `radial-gradient(circle, ${variation.accentColor || '#f59e0b'} 0%, transparent 70%)`
                }}
              />

              <h1 
                className="font-black tracking-tight leading-[1.04] flex flex-wrap items-baseline gap-x-4 gap-y-2 select-none mb-3"
                style={{
                  fontFamily: variation.fontFamilyTitle || 'Montserrat, sans-serif',
                }}
              >
                {getTitleWordsStructure(variation.headlineSummary || publication.title || 'Título da Publicação', variation.titleHighlightWords).map((w, idx) => {
                  if (w.isHighlight) {
                    return (
                      <span 
                        key={idx}
                        className="text-[72px] md:text-[84px] uppercase font-black transform inline-block"
                        style={{
                          color: variation.accentColor || '#f59e0b',
                          textShadow: '0 4px 0 #000, 0 8px 0 rgba(0,0,0,0.85), 0 16px 32px rgba(0,0,0,0.95), 0 0 35px ' + (variation.accentColor || 'rgba(245,158,11,0.6)'),
                          filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.8))'
                        }}
                      >
                        {w.text}
                      </span>
                    );
                  }
                  return (
                    <span 
                      key={idx}
                      className="text-[60px] md:text-[70px] font-black uppercase text-white inline-block"
                      style={{
                        textShadow: '0 3px 0 #000, 0 7px 0 rgba(0,0,0,0.8), 0 14px 28px rgba(0,0,0,0.95)'
                      }}
                    >
                      {w.text}
                    </span>
                  );
                })}
              </h1>
              
              {/* Linha gráfica de acento integrada ao título */}
              <div 
                className="h-2 w-36 rounded-full shadow-lg"
                style={{
                  background: `linear-gradient(90deg, ${variation.accentColor || '#f59e0b'}, transparent)`,
                  boxShadow: `0 0 14px ${variation.accentColor || '#f59e0b'}`
                }}
              />
            </div>

            {/* SUBTÍTULO / CHAMADA SECUNDÁRIA COM TRATAMENTO GRÁFICO PRÓPRIO PROTAGONISTA */}
            {(variation.subtitleSummary || publication.subtitle) && (
              <div className="relative mb-6 max-w-4xl z-20">
                <div 
                  className="inline-flex items-center gap-3.5 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-2xl"
                  style={{
                    background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.65) 100%)',
                    borderColor: `${variation.accentColor || 'rgba(245, 158, 11, 0.5)'}`,
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <span 
                    className="w-2.5 h-8 rounded-full shrink-0"
                    style={{
                      background: variation.accentColor || '#f59e0b',
                      boxShadow: `0 0 12px ${variation.accentColor || '#f59e0b'}`
                    }}
                  />
                  <p 
                    className="text-[30px] md:text-[34px] font-black uppercase tracking-wide text-white leading-tight"
                    style={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 4px 12px rgba(0,0,0,0.8)'
                    }}
                  >
                    {variation.subtitleSummary || publication.subtitle}
                  </p>
                </div>
              </div>
            )}

            {/* Resumo do Texto com preservação de detalhes */}
            {(variation.bodySummary || publication.description) && (
              <p className="text-[23px] font-medium leading-relaxed text-slate-200/90 mb-6 max-w-3xl line-clamp-3 drop-shadow-md">
                {variation.bodySummary || publication.description}
              </p>
            )}

            {/* Caixa Oficial de Dados do Evento (Data, Horário, Local) com Glassmorphism Refinado */}
            {(publication.eventDate || publication.eventTime || publication.eventLocation) && (
              <div 
                className="p-7 rounded-3xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-3 mb-5 transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.6) 100%)',
                  borderColor: 'rgba(255, 255, 255, 0.25)',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
              >
                {publication.eventDate && (
                  <div className="flex items-center gap-4 text-[26px] font-black text-white">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Calendar className="w-6 h-6 text-amber-400" />
                    </div>
                    <span>{publication.eventDate}</span>
                  </div>
                )}
                {publication.eventTime && (
                  <div className="flex items-center gap-4 text-[26px] font-bold text-slate-100">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-sky-400" />
                    </div>
                    <span>{publication.eventTime}</span>
                  </div>
                )}
                {publication.eventLocation && (
                  <div className="flex items-center gap-4 text-[26px] font-bold text-slate-100">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6 text-rose-400" />
                    </div>
                    <span className="truncate">{publication.eventLocation}</span>
                  </div>
                )}
              </div>
            )}

            {/* CTA Final com Efeito 3D de Alto Impacto */}
            {publication.ctaText && (
              <div 
                className="inline-flex items-center gap-3.5 px-8 py-3.5 rounded-2xl text-[24px] font-black uppercase tracking-wider self-start text-white shadow-2xl border border-white/30 transform hover:translate-y-[-2px] transition-transform"
                style={{
                  background: `linear-gradient(135deg, ${variation.secondaryColor || '#4f46e5'} 0%, ${variation.primaryColor || '#1e3a8a'} 100%)`,
                  boxShadow: `0 6px 0 rgba(0, 0, 0, 0.4), 0 12px 30px ${variation.secondaryColor || 'rgba(79, 70, 229, 0.5)'}`
                }}
              >
                <span className="drop-shadow-sm">{publication.ctaText}</span>
                <ArrowRight className="w-6 h-6" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
