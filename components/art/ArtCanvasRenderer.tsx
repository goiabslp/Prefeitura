import React, { useRef, useEffect, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
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
  const artFrameRef = useRef<HTMLDivElement>(null);
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
  // Captura o próprio frame do DOM, garantindo que o arquivo baixado seja 100% idêntico ao exibido na tela
  const exportToPNG = async () => {
    setIsExporting(true);
    try {
      if (artFrameRef.current) {
        const frameEl = artFrameRef.current;

        // Cria clone isolado no body fora da tela para capturar na resolução 1080px nativa sem clipping de overflow ou transform dos pais
        const clone = frameEl.cloneNode(true) as HTMLDivElement;
        clone.style.transform = 'none';
        clone.style.position = 'fixed';
        clone.style.left = '-10000px';
        clone.style.top = '0';
        clone.style.width = `${nativeWidth}px`;
        clone.style.height = `${nativeHeight}px`;
        clone.style.zIndex = '-9999';
        clone.style.overflow = 'hidden';

        document.body.appendChild(clone);

        try {
          // Aguarda estabilização do DOM clonado
          await new Promise((r) => setTimeout(r, 120));

          const canvas = await html2canvas(clone, {
            width: nativeWidth,
            height: nativeHeight,
            scale: 1,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: null,
            imageTimeout: 15000,
            windowWidth: nativeWidth,
            windowHeight: nativeHeight
          });

          if (document.body.contains(clone)) {
            document.body.removeChild(clone);
          }

          const dataUrl = canvas.toDataURL('image/png', 1.0);
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
          return;
        } catch (domErr) {
          if (document.body.contains(clone)) {
            document.body.removeChild(clone);
          }
          console.warn('Captura DOM direta via html2canvas falhou, recorrendo ao exportador 2D sincronizado:', domErr);
        }
      }

      // Fallback: Cria canvas offscreen na resolução real nativa rigorosamente idêntico ao DOM
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

          // Scrim de legibilidade superior suave para contraste do sticker e selos sobre o céu/topo
          const topScrim = ctx.createLinearGradient(0, 0, 0, 500);
          topScrim.addColorStop(0, 'rgba(15, 23, 42, 0.40)');
          topScrim.addColorStop(0.65, 'rgba(15, 23, 42, 0.12)');
          topScrim.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = topScrim;
          ctx.fillRect(0, 0, nativeWidth, 500);
          ctx.restore();
        } catch (e) {
          console.warn('Erro ao renderizar imagem no canvas offscreen:', e);
        }
      }

      // 3. BARRA OU MOLDURA CÍVICA SUPERIOR SUAVE
      ctx.save();
      const barGrad = ctx.createLinearGradient(48, 30, nativeWidth - 48, 30);
      barGrad.addColorStop(0, '#facc15');
      barGrad.addColorStop(0.5, '#76b82a');
      barGrad.addColorStop(1, '#0ea5e9');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(48, 28, nativeWidth - 96, 10, 5);
      ctx.fill();
      ctx.restore();

      // 4. SELO / STICKER TEMÁTICO DE TOPO (ESTILO #TAPA TUDO / TÁ PAGO / CATEGORIA)
      let curY = format === 'vertical' ? 120 : 80;
      const catClean = (publication.category || 'MUNICIPAL').toUpperCase().replace(/[^\wÀ-ú]/g, '');
      const badgeStr = `#${catClean}`;

      ctx.save();
      ctx.font = '900 24px Montserrat, Inter, sans-serif';
      const badgeMetrics = ctx.measureText(badgeStr);
      const badgeW = badgeMetrics.width + 36;
      const badgeH = 46;

      // Sombra e Borda do Selo Sticker
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(64, curY, badgeW, badgeH, 14);
      ctx.fill();

      // Preenchimento do Selo com cor vibrante
      ctx.fillStyle = variation.accentColor || '#facc15';
      ctx.beginPath();
      ctx.roundRect(66, curY + 2, badgeW - 4, badgeH - 4, 12);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#0f172a';
      ctx.fillText(badgeStr, 82, curY + 32);
      ctx.restore();

      curY += 75;

      // 5. TÍTULO PRINCIPAL PROTAGONISTA — ESTILO STICKER DIE-CUT COM BORDA BRANCA GROSSA (REFERÊNCIAS PREFEITURA)
      const titleText = variation.headlineSummary || publication.title || 'COMUNICADO OFICIAL';
      const wordsStructure = getTitleWordsStructure(titleText, variation.titleHighlightWords);

      let curX = 64;
      const maxWidth = nativeWidth - 128;
      const lineHeight = 105;

      ctx.save();
      for (let n = 0; n < wordsStructure.length; n++) {
        const item = wordsStructure[n];
        const isHigh = item.isHighlight;
        const fontStr = isHigh
          ? '900 90px Montserrat, Outfit, Impact, sans-serif'
          : '900 76px Montserrat, Outfit, Impact, sans-serif';

        ctx.font = fontStr;
        const wordText = item.text.toUpperCase();
        const metrics = ctx.measureText(wordText + ' ');

        if (curX + metrics.width > maxWidth && n > 0) {
          curX = 64;
          curY += lineHeight;
        }

        // Camada 1: Contorno Branco Grosso Die-Cut (Adesivo Recortado) com Sombra Suave
        ctx.save();
        ctx.font = fontStr;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 10;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isHigh ? 20 : 16;
        ctx.strokeText(wordText, curX, curY);

        // Camada 2: Preenchimento com Cores Vibrantes (Verde-limão das referências e Amarelo Sol)
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = isHigh
          ? (variation.accentColor || '#facc15')
          : (variation.primaryColor && !['#0f172a', '#18181b', '#090d16'].includes(variation.primaryColor) ? variation.primaryColor : '#76b82a');
        ctx.fillText(wordText, curX, curY);
        ctx.restore();

        curX += metrics.width;
      }
      ctx.restore();

      curY += 45;

      // 6. SUBTÍTULO / CHAMADA SECUNDÁRIA — FAIXA BRANCA RETANGULAR COM CANTOS LEVEMENTE ARREDONDADOS (ESTILO PREFEITURA)
      const subText = variation.subtitleSummary || publication.subtitle;
      if (subText) {
        ctx.save();
        ctx.font = '900 32px Montserrat, Inter, sans-serif';
        const subUpper = subText.toUpperCase();
        const subMetrics = ctx.measureText(subUpper);
        const subBadgeW = Math.min(nativeWidth - 128, subMetrics.width + 56);
        const subBadgeH = 64;

        // Fundo Branco Sólido Retangular com Sombra Limpa
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.30)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 8;
        ctx.beginPath();
        ctx.roundRect(64, curY, subBadgeW, subBadgeH, 14);
        ctx.fill();

        // Texto em Verde Escuro ou Azul Escuro de Alta Legibilidade
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#15803d'; // Verde floresta institucional de Governador Valadares
        ctx.fillText(subUpper, 92, curY + 44);
        curY += 85;
        ctx.restore();
      }

      // 7. PÍLULA DE LOCALIZAÇÃO (PIN AMARELO + CHECKMARK VERDE DAS REFERÊNCIAS)
      if (publication.eventLocation) {
        ctx.save();
        ctx.font = '900 26px Montserrat, Inter, sans-serif';
        const locStr = `📍 ${publication.eventLocation.toUpperCase()}  ✅`;
        const locMetrics = ctx.measureText(locStr);
        const locBadgeW = Math.min(nativeWidth - 128, locMetrics.width + 48);
        const locBadgeH = 54;

        // Fundo Azul Celeste / Ciano das referências
        ctx.fillStyle = '#0ea5e9';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;
        ctx.beginPath();
        ctx.roundRect(64, curY, locBadgeW, locBadgeH, 14);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(locStr, 88, curY + 37);
        curY += 75;
        ctx.restore();
      }

      // 7. PÍLULA DE DATA & HORÁRIO (IDENTICA AO DOM DA TELA)
      if (publication.eventDate || publication.eventTime) {
        ctx.save();
        ctx.font = '900 21px Montserrat, Inter, sans-serif';
        let dtStr = '';
        if (publication.eventDate && publication.eventTime) {
          dtStr = `📅  ${publication.eventDate}    •    ⏰  ${publication.eventTime}`;
        } else if (publication.eventDate) {
          dtStr = `📅  ${publication.eventDate}`;
        } else {
          dtStr = `⏰  ${publication.eventTime}`;
        }

        const dtMetrics = ctx.measureText(dtStr);
        const dtBadgeW = Math.min(nativeWidth - 128, dtMetrics.width + 48);
        const dtBadgeH = 50;

        // Fundo escuro translúcido com borda suave idêntico ao DOM
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;
        ctx.beginPath();
        ctx.roundRect(64, curY, dtBadgeW, dtBadgeH, 14);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fef08a';
        ctx.fillText(dtStr, 88, curY + 33);
        ctx.restore();
      }

      // 8. PLACA OFICIAL DA LOGO DA PREFEITURA NO RODAPÉ CENTRALIZADO (FIEL ÀS REFERÊNCIAS E AO DOM)
      const plaqueW = 380;
      const plaqueH = 82;
      const plaqueX = (nativeWidth - plaqueW) / 2;
      const plaqueY = nativeHeight - plaqueH - 28;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      ctx.beginPath();
      ctx.roundRect(plaqueX, plaqueY, plaqueW, plaqueH, 20);
      ctx.fill();

      ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (logo?.dataUrl) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          logoImg.src = logo.dataUrl;
          await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve;
          });

          const maxImgH = 64;
          const maxImgW = plaqueW - 48;
          const aspect = logoImg.width / logoImg.height;
          let lW = maxImgH * aspect;
          let lH = maxImgH;
          if (lW > maxImgW) {
            lW = maxImgW;
            lH = lW / aspect;
          }
          const lX = plaqueX + (plaqueW - lW) / 2;
          const lY = plaqueY + (plaqueH - lH) / 2;
          ctx.drawImage(logoImg, lX, lY, lW, lH);
        } catch (e) {
          console.warn('Erro ao carregar logo na placa do canvas:', e);
        }
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 18px Montserrat, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏛️  PREFEITURA MUNICIPAL', nativeWidth / 2, plaqueY + 48);
        ctx.textAlign = 'left';
      }
      ctx.restore();

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
          ref={artFrameRef}
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
                crossOrigin="anonymous"
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
                className="absolute inset-x-0 top-0 h-80 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.40) 0%, rgba(15, 23, 42, 0.12) 60%, transparent 100%)'
                }}
              />

              {/* Tonalidade Suave Opcional de Integração */}
              <div
                className="absolute inset-0 pointer-events-none mix-blend-color opacity-10"
                style={{
                  background: variation.backgroundColor || '#0f172a'
                }}
              />
            </div>
          )}

          {/* 2. Barra Cívica Superior com Gradiente Dinâmico */}
          <div
            className="absolute top-7 left-12 right-12 h-2.5 rounded-full z-20 shadow-md"
            style={{
              background: `linear-gradient(90deg, #facc15 0%, #76b82a 50%, #0ea5e9 100%)`,
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}
          />

          {/* 3. CORPO PRINCIPAL DE TEXTOS — POSICIONADO NO TOPO / CENTRO-SUPERIOR FIEL ÀS REFERÊNCIAS */}
          <div className="relative z-20 px-14 pt-14 pb-8 flex flex-col justify-start items-start w-full select-none">
            {/* Selo / Sticker Temático de Topo (Estilo #TAPA TUDO / TÁ PAGO / CATEGORIA) */}
            <div className="inline-flex items-center gap-2 mb-4">
              <div
                className="px-5 py-2 rounded-2xl border-[3px] border-white shadow-xl flex items-center gap-2 transform -rotate-1 hover:rotate-0 transition-transform"
                style={{
                  background: variation.accentColor || '#facc15',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.8)'
                }}
              >
                <span className="text-xl">⚡</span>
                <span className="text-[20px] font-black uppercase tracking-wider text-slate-950 drop-shadow-2xs">
                  #{((publication.category || 'MUNICIPAL')).toUpperCase().replace(/[^\wÀ-ú]/g, '')}
                </span>
              </div>

              {variation.badgeLabel && (
                <div
                  className="px-4 py-1.5 rounded-2xl border-2 border-white bg-emerald-600 text-white font-black text-[16px] uppercase tracking-wider shadow-lg flex items-center gap-1.5"
                >
                  <span>{variation.badgeLabel}</span>
                </div>
              )}
            </div>

            {/* TÍTULO PRINCIPAL: LETREIRO STICKER DIE-CUT COM BORDA BRANCA GROSSA (ESTILO REFERÊNCIAS PREFEITURA) */}
            <div className="relative mb-4 w-full">
              <h1
                className="font-black tracking-tight leading-[0.98] flex flex-wrap items-baseline gap-x-4 gap-y-2 select-none mb-3"
                style={{
                  fontFamily: variation.fontFamilyTitle || 'Montserrat, Impact, Outfit, sans-serif',
                }}
              >
                {getTitleWordsStructure(variation.headlineSummary || publication.title || 'Título da Publicação', variation.titleHighlightWords).map((w, idx) => {
                  const isHigh = w.isHighlight;
                  const wordColor = isHigh
                    ? (variation.accentColor || '#facc15')
                    : (variation.primaryColor && !['#0f172a', '#18181b', '#090d16'].includes(variation.primaryColor) ? variation.primaryColor : '#76b82a');

                  return (
                    <span
                      key={idx}
                      className="font-black uppercase tracking-tight transform inline-block"
                      style={{
                        fontSize: isHigh
                          ? (format === 'vertical' ? '88px' : '76px')
                          : (format === 'vertical' ? '76px' : '64px'),
                        color: wordColor,
                        WebkitTextStroke: '7px #ffffff',
                        paintOrder: 'stroke fill',
                        filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.38))'
                      }}
                    >
                      {w.text}
                    </span>
                  );
                })}
              </h1>
            </div>

            {/* SUBTÍTULO / CHAMADA SECUNDÁRIA — FAIXA BRANCA RETANGULAR COM CANTOS LEVEMENTE ARREDONDADOS */}
            {(variation.subtitleSummary || publication.subtitle) && (
              <div className="relative mb-3.5 max-w-4xl z-20">
                <div
                  className="inline-flex items-center px-6 py-2.5 rounded-xl bg-white shadow-2xl border-2 border-white/95 transform hover:scale-[1.01] transition-transform"
                  style={{
                    boxShadow: '0 10px 28px rgba(0,0,0,0.35)'
                  }}
                >
                  <p
                    className="text-[28px] md:text-[34px] font-black uppercase tracking-wide text-emerald-800 leading-tight"
                    style={{
                      color: '#15803d'
                    }}
                  >
                    {variation.subtitleSummary || publication.subtitle}
                  </p>
                </div>
              </div>
            )}

            {/* PÍLULA DE LOCALIZAÇÃO (PIN AMARELO + CHECKMARK VERDE DAS REFERÊNCIAS) */}
            {publication.eventLocation && (
              <div className="mb-4">
                <div
                  className="inline-flex items-center gap-2.5 px-5 py-2 rounded-xl bg-sky-500 shadow-xl border-2 border-white/90 text-white font-black text-[22px] uppercase tracking-wide"
                  style={{
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                  }}
                >
                  <span className="text-amber-300">📍</span>
                  <span>{publication.eventLocation}</span>
                  <span className="text-emerald-300 ml-1">✅</span>
                </div>
              </div>
            )}

            {/* Data & Horário em Cartões Estilizados e Limpos */}
            {(publication.eventDate || publication.eventTime) && (
              <div className="inline-flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-5 py-2 rounded-xl border border-white/30 text-white text-[19px] font-black uppercase tracking-wider shadow-lg mb-2">
                {publication.eventDate && (
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Calendar className="w-4 h-4" />
                    {publication.eventDate}
                  </span>
                )}
                {publication.eventDate && publication.eventTime && <span className="opacity-40">•</span>}
                {publication.eventTime && (
                  <span className="flex items-center gap-1.5 text-sky-300">
                    <Clock className="w-4 h-4" />
                    {publication.eventTime}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 4. PLACA OFICIAL DA LOGO DA PREFEITURA NO RODAPÉ CENTRALIZADO (FIEL ÀS 4 REFERÊNCIAS) */}
          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-30 px-8 py-3 rounded-2xl bg-white shadow-2xl border border-slate-200/90 flex items-center justify-center min-w-[280px] max-w-[440px]">
            {logo?.dataUrl ? (
              <img
                src={logo.dataUrl}
                crossOrigin="anonymous"
                alt={logo.name || 'Logo Oficial da Prefeitura'}
                className="max-h-16 w-auto object-contain drop-shadow-xs"
              />
            ) : (
              <div className="flex items-center gap-2.5 text-slate-800 font-black text-sm uppercase tracking-wider">
                <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>PREFEITURA MUNICIPAL</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
