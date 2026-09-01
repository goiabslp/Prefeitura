import React, { useState, useRef, useEffect } from 'react';
import { JornalMateria } from '../../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  X,
  Download,
  FileDown,
  Loader2,
  Newspaper,
  Calendar,
  Clock,
  Building2,
  Quote,
  ShieldCheck,
  Smartphone,
  CheckCircle2
} from 'lucide-react';

interface MateriaJornalPngModalProps {
  materia: JornalMateria | null;
  isOpen: boolean;
  onClose: () => void;
  logoUrl?: string;
  onNotify?: (msg: string) => void;
}

/**
 * Componente do Template Visual 1080x1920 (Jornal Editorial em Formato Story)
 */
export const StoryMateriaJornalTemplate: React.FC<{ materia: JornalMateria; logoUrl?: string }> = ({
  materia,
  logoUrl
}) => {
  // Estado para detecção de orientação da imagem (horizontal vs vertical)
  const [imageRatio, setImageRatio] = useState<number>(1.5);
  const [isLandscape, setIsLandscape] = useState<boolean>(true);

  useEffect(() => {
    if (materia.imagemUrl) {
      const img = new Image();
      img.src = materia.imagemUrl;
      img.onload = () => {
        const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        setImageRatio(ratio);
        // Se a proporção for >= 1.15, consideramos imagem horizontal (landscape); senão vertical/quadrada (portrait)
        setIsLandscape(ratio >= 1.15);
      };
    }
  }, [materia.imagemUrl]);

  // Obtenção da Logomarca Oficial da Prefeitura com fallback inteligente
  const effectiveLogoUrl = logoUrl ||
    localStorage.getItem('cached_img_branding_logo') ||
    localStorage.getItem('cached_img_ui_header_logo') ||
    localStorage.getItem('cached_img_ui_login_logo') ||
    localStorage.getItem('prefeitura_logo_url') ||
    localStorage.getItem('cached_img_logoUrl') ||
    '';

  const dataFormatada = materia.dataEvento 
    ? materia.dataEvento.split('-').reverse().join('/') 
    : new Date(materia.dataPublicacao || Date.now()).toLocaleDateString('pt-BR');

  const dataPublicacaoExtensa = new Date(materia.dataPublicacao || Date.now()).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Limpeza de marcações Markdown brutas e aspas duplicadas
  const cleanConteudo = (materia.conteudo || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1');

  const cleanDestaqueFrase = (materia.destaqueFrase || '')
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim();

  // -------------------------------------------------------------
  // ALGORITMO RIGOROSO DE CALIBRAÇÃO TIPOGRÁFICA E BLINDAGEM DO RODAPÉ
  // Garante que o texto e a imagem fiquem no MAIOR tamanho possível SEM NUNCA ultrapassar ou tocar o rodapé
  // -------------------------------------------------------------
  const hasImage = !!materia.imagemUrl;
  const hasSubtitle = !!materia.subtitulo;
  const titleLength = (materia.titulo || '').length;

  // 1. Cálculo de espaço ocupado pela Manchete (Título)
  let titleFontSizeNum = 48;
  let titleLines = Math.ceil(titleLength / 34);
  if (titleLength > 115) {
    titleFontSizeNum = 37;
    titleLines = Math.ceil(titleLength / 44);
  } else if (titleLength > 70) {
    titleFontSizeNum = 42;
    titleLines = Math.ceil(titleLength / 38);
  }
  const titleEstimatedHeight = (titleLines * titleFontSizeNum * 1.38) + 48;

  // 2. Cálculo de espaço ocupado pelo Subtítulo (Lead)
  let subtitleHeight = 0;
  let subtitleFontSizeNum = 24;
  if (hasSubtitle && materia.subtitulo) {
    const subLen = materia.subtitulo.length;
    subtitleFontSizeNum = subLen > 110 ? 20 : 23;
    const subLines = Math.ceil(subLen / (subLen > 110 ? 54 : 46));
    subtitleHeight = (subLines * subtitleFontSizeNum * 1.62) + 42;
  }

  // Altura máxima real útil para o corpo dentro dos 1920px
  // 1920px - 104px (padding vertical) - 255px (masthead completo) - 85px (rodapé completo) - 75px (gaps e margens estruturais) = 1401px
  const availableBodyHeight = 1401 - titleEstimatedHeight - subtitleHeight;

  // Parágrafos do texto limpo
  const rawParagraphs = cleanConteudo.split('\n').map(p => p.trim()).filter(p => p.length > 0);
  const paragraphs = rawParagraphs.length > 0 ? rawParagraphs : [cleanConteudo];
  const numParagraphs = paragraphs.length;
  const totalChars = cleanConteudo.length;

  // Altura da imagem calculada conforme orientação e volume de texto
  let estimatedImageHeight = 0;
  if (hasImage) {
    if (isLandscape) {
      // Horizontal: largura total de 960px. Altura proporcional com teto de segurança
      const naturalAspectHeight = 960 / Math.max(1, imageRatio);
      if (totalChars > 1100 || numParagraphs >= 4) {
        estimatedImageHeight = Math.min(availableBodyHeight * 0.40, naturalAspectHeight, 440);
      } else if (totalChars > 650) {
        estimatedImageHeight = Math.min(availableBodyHeight * 0.48, naturalAspectHeight, 520);
      } else {
        estimatedImageHeight = Math.min(availableBodyHeight * 0.58, naturalAspectHeight, 620);
      }
    } else {
      // Vertical: fica à esquerda com float
      if (totalChars > 1200 || numParagraphs >= 5) {
        estimatedImageHeight = Math.min(availableBodyHeight * 0.44, 480);
      } else if (totalChars > 750 || numParagraphs >= 3) {
        estimatedImageHeight = Math.min(availableBodyHeight * 0.52, 580);
      } else {
        estimatedImageHeight = Math.min(availableBodyHeight * 0.68, 760);
      }
    }
  }

  // Lista decrescente de opções tipográficas calibradas
  const candidateFontSizes = [
    { size: 34, lineHeight: 1.80, spacing: 26, spacingClass: 'space-y-6.5' },
    { size: 31, lineHeight: 1.76, spacing: 22, spacingClass: 'space-y-6' },
    { size: 28, lineHeight: 1.72, spacing: 19, spacingClass: 'space-y-5' },
    { size: 25, lineHeight: 1.68, spacing: 16, spacingClass: 'space-y-4.5' },
    { size: 22.5, lineHeight: 1.62, spacing: 14, spacingClass: 'space-y-4' },
    { size: 20.5, lineHeight: 1.56, spacing: 12, spacingClass: 'space-y-3.5' },
    { size: 19, lineHeight: 1.50, spacing: 10, spacingClass: 'space-y-3' },
    { size: 17.5, lineHeight: 1.45, spacing: 8, spacingClass: 'space-y-2.5' },
    { size: 16, lineHeight: 1.40, spacing: 6, spacingClass: 'space-y-2' },
    { size: 14.5, lineHeight: 1.36, spacing: 5, spacingClass: 'space-y-1.5' }
  ];

  let chosenTypography = candidateFontSizes[candidateFontSizes.length - 1];

  for (const candidate of candidateFontSizes) {
    const fs = candidate.size;
    const lh = candidate.lineHeight;
    const linePixelHeight = fs * lh;

    if (hasImage && isLandscape) {
      // Horizontal: o texto fica inteiramente abaixo da imagem
      const charsPerLine = Math.max(25, Math.floor(960 / (fs * 0.60)));
      let totalTextLines = 0;
      for (const p of paragraphs) {
        totalTextLines += Math.max(1, Math.ceil(p.length / charsPerLine));
      }
      const textHeight = (totalTextLines * linePixelHeight) + (Math.max(0, numParagraphs - 1) * candidate.spacing);
      const totalOccupied = estimatedImageHeight + textHeight + 40;

      if (totalOccupied <= (availableBodyHeight - 45)) {
        chosenTypography = candidate;
        break;
      }
    } else {
      // Vertical ou sem imagem: texto ao lado e fluindo abaixo
      const charsPerLineSide = Math.max(12, Math.floor(420 / (fs * 0.60)));
      const charsPerLineFull = Math.max(25, Math.floor(960 / (fs * 0.60)));

      const sideLinesMax = hasImage ? Math.floor(estimatedImageHeight / linePixelHeight) : 0;
      let usedSideLines = 0;
      let linesBelowImage = 0;

      for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        const pLen = paragraphs[pIdx].length;
        let remainingChars = pLen;

        while (remainingChars > 0 && usedSideLines < sideLinesMax) {
          remainingChars -= charsPerLineSide;
          usedSideLines++;
        }

        while (remainingChars > 0) {
          remainingChars -= charsPerLineFull;
          linesBelowImage++;
        }
      }

      const textHeightBelowImage = (linesBelowImage * linePixelHeight) + (Math.max(0, numParagraphs - 1) * candidate.spacing);
      const totalOccupiedHeight = hasImage
        ? estimatedImageHeight + textHeightBelowImage + (linesBelowImage > 0 ? 16 : 0)
        : (usedSideLines + linesBelowImage) * linePixelHeight + (Math.max(0, numParagraphs - 1) * candidate.spacing);

      if (totalOccupiedHeight <= (availableBodyHeight - 50)) {
        chosenTypography = candidate;
        break;
      }
    }
  }

  const bodyFontSize = `${chosenTypography.size}px`;
  const bodyLineHeight = `${chosenTypography.lineHeight}`;
  const bodySpacing = chosenTypography.spacingClass;
  const titleFontSize = `${titleFontSizeNum}px`;
  const subtitleFontSize = `${subtitleFontSizeNum}px`;

  return (
    <div
      style={{
        width: '1080px',
        height: '1920px',
        maxWidth: '1080px',
        maxHeight: '1920px',
        backgroundColor: '#fcfaf7',
        color: '#0f172a',
        padding: '56px 60px 48px 60px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Playfair Display, Georgia, serif'
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. CABEÇALHO DO JORNAL VERTICAL (MASTHEAD) */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4 shrink-0 pb-3">
        
        {/* Faixa Superior Preta */}
        <div className="bg-slate-900 text-white px-6 py-2.5 rounded-xl flex items-center justify-between text-xs font-sans font-black uppercase tracking-widest">
          <span>EDIÇÃO ESPECIAL DOS STORIES</span>
          <span>SÃO JOSÉ DO GOIABAL - MG</span>
          <span>CIRCULAÇÃO MUNICIPAL</span>
        </div>

        {/* Bloco Central do Jornal */}
        <div className="py-3 border-b-4 border-slate-950 flex items-center justify-between gap-6">
          
          {/* Logo / Brasão à Esquerda */}
          <div className="flex items-center gap-7 shrink-0">
            {effectiveLogoUrl ? (
              <img
                src={effectiveLogoUrl}
                alt="Logo Prefeitura"
                className="h-20 w-auto max-w-[170px] object-contain shrink-0"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-2xl font-bold shrink-0">
                🏛️
              </div>
            )}
            <div className="pl-1">
              <p className="text-[11px] font-sans font-black tracking-widest uppercase text-slate-500">PREFEITURA DE</p>
              <p className="text-xl font-serif font-black tracking-tight text-slate-900 leading-tight">SÃO JOSÉ DO GOIABAL</p>
              <p className="text-[10px] font-sans font-bold text-slate-400 mt-0.5">ADM 2025 - 2028</p>
            </div>
          </div>

          {/* Nome do Jornal */}
          <div className="text-right">
            <h1 className="text-5xl font-serif font-black tracking-tight uppercase text-slate-950 leading-none">
              GAZETA MUNICIPAL
            </h1>
            <p className="text-[11px] font-sans font-bold uppercase tracking-[0.2em] text-slate-600 mt-1.5">
              INFORMAÇÃO • TRANSPARÊNCIA • CIDADANIA
            </p>
          </div>

        </div>

        {/* Faixa com Data e Editoria */}
        <div className="flex items-center justify-between font-sans text-xs font-bold text-slate-500 border-b-2 border-slate-300 pb-3">
          <span className="capitalize">{dataPublicacaoExtensa}</span>
          <span className="px-3.5 py-1 rounded-md bg-indigo-900 text-white font-black text-[11px] uppercase tracking-wider">
            {materia.categoria || 'NOTÍCIA OFICIAL'}
          </span>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. CORPO DA NOTÍCIA COM DIAGRAMAÇÃO JORNALÍSTICA */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 my-3 pb-2 flex flex-col justify-between overflow-hidden gap-4">
        
        {/* Bloco de Manchete e Lead */}
        <div className="space-y-3 shrink-0 pt-1">
          <div className="flex items-center gap-2.5 font-sans mb-2">
            <span className="w-3.5 h-3.5 rounded-full bg-indigo-600"></span>
            <span className="text-[13px] font-black tracking-widest uppercase text-indigo-900">
              {materia.setor ? `AÇÃO MUNICIPAL: ${materia.setor.toUpperCase()}` : 'COMUNICADO OFICIAL'}
            </span>
          </div>

          {/* Manchete Principal */}
          <h2
            style={{ fontSize: titleFontSize, lineHeight: '1.35' }}
            className="font-serif font-black text-slate-950 tracking-tight my-2.5"
          >
            {materia.titulo}
          </h2>

          {/* Subtítulo / Lead com Destaque Editorial */}
          {materia.subtitulo && (
            <div className="border-l-4 border-indigo-600 pl-5 pr-4 py-3 bg-indigo-50/70 rounded-r-2xl mt-3 mb-2">
              <p
                style={{ fontSize: subtitleFontSize, lineHeight: '1.58' }}
                className="font-serif text-slate-800 italic font-medium"
              >
                "{materia.subtitulo}"
              </p>
            </div>
          )}
        </div>

        {/* LAYOUT CASO A: IMAGEM HORIZONTAL (LANDSCAPE) - Imagem em foco na largura total e texto abaixo */}
        {hasImage && isLandscape ? (
          <div className="flex-1 flex flex-col justify-between overflow-hidden gap-3.5 py-1">
            {/* Foto Panorâmica em Largura Total */}
            <div className="w-full space-y-1.5 shrink-0">
              <div className="relative w-full rounded-2xl overflow-hidden shadow-md border-2 border-slate-900 bg-slate-900/5 flex items-center justify-center">
                <img
                  src={materia.imagemUrl}
                  alt={materia.titulo}
                  className="w-full h-auto object-contain block"
                  style={{
                    maxWidth: '960px',
                    maxHeight: `${Math.round(estimatedImageHeight)}px`,
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                  }}
                  crossOrigin="anonymous"
                />
                {effectiveLogoUrl && (
                  <div className="absolute bottom-3 right-3 p-1.5 rounded-xl bg-white/95 backdrop-blur-sm shadow-md border border-slate-200">
                    <img src={effectiveLogoUrl} alt="Logo" className="h-5 max-w-[85px] object-contain" crossOrigin="anonymous" />
                  </div>
                )}
              </div>
              <p className="text-[11px] font-sans text-slate-500 italic text-center font-medium">
                Foto oficial: Assessoria de Comunicação & Imprensa
              </p>
            </div>

            {/* Texto da Matéria Abaixo da Foto em Largura Total */}
            <div
              style={{
                fontSize: bodyFontSize,
                lineHeight: bodyLineHeight,
                textAlign: 'justify'
              }}
              className={`text-slate-900 font-serif flex-1 ${bodySpacing} whitespace-pre-line font-normal`}
            >
              {cleanConteudo}
            </div>
          </div>
        ) : (
          /* LAYOUT CASO B: IMAGEM VERTICAL (PORTRAIT) OU SEM IMAGEM - Texto fluindo ao lado e abaixo */
          <div
            style={{
              fontSize: bodyFontSize,
              lineHeight: bodyLineHeight,
              textAlign: 'justify',
              columnCount: materia.imagemUrl ? undefined : 2,
              columnGap: materia.imagemUrl ? undefined : '46px'
            }}
            className={`text-slate-900 font-serif flex-1 py-1 my-1 ${bodySpacing}`}
          >
            {/* Foto Vertical à Esquerda com Proporção Original */}
            {hasImage && (
              <div
                style={{
                  float: 'left',
                  marginRight: '36px',
                  marginBottom: '20px',
                  maxWidth: '480px'
                }}
                className="space-y-2 shrink-0"
              >
                <div className="relative inline-block max-w-full rounded-2xl overflow-hidden shadow-md border-2 border-slate-900 bg-slate-900/5">
                  <img
                    src={materia.imagemUrl}
                    alt={materia.titulo}
                    className="w-auto h-auto object-contain block"
                    style={{
                      maxWidth: '480px',
                      maxHeight: `${Math.round(estimatedImageHeight || 560)}px`,
                      width: 'auto',
                      height: 'auto',
                      display: 'block'
                    }}
                    crossOrigin="anonymous"
                  />
                  {effectiveLogoUrl && (
                    <div className="absolute bottom-3 right-3 p-1.5 rounded-xl bg-white/95 backdrop-blur-sm shadow-md border border-slate-200">
                      <img src={effectiveLogoUrl} alt="Logo" className="h-5 max-w-[85px] object-contain" crossOrigin="anonymous" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-sans text-slate-500 italic text-center font-medium pt-0.5">
                  Foto oficial: Assessoria de Comunicação & Imprensa
                </p>
              </div>
            )}

            {/* Texto da Matéria */}
            <div className="whitespace-pre-line font-normal">
              {cleanConteudo}
            </div>
          </div>
        )}

      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. RODAPÉ DO JORNAL VERTICAL COM CERTIFICAÇÃO */}
      {/* ------------------------------------------------------------- */}
      <div className="pt-4 border-t-2 border-slate-900 flex items-center justify-between font-sans text-xs text-slate-500 font-bold shrink-0 mt-2 relative z-20 bg-[#fcfaf7]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Publicado por: <strong className="text-slate-900">{materia.autor || 'Assessoria de Comunicação Oficial'}</strong></span>
        </div>

        <div className="font-mono text-[11px] text-slate-400">
          AUTENTICIDADE: DOC-SJGOIABAL-{Date.now().toString(36).toUpperCase()}
        </div>

        <div>
          www.saojosedogoiabal.mg.gov.br
        </div>
      </div>

    </div>
  );
};

/**
 * Função utilitária para renderizar e disparar o download imediato do PNG
 */
export const generateAndDownloadStoryPng = async (
  materia: JornalMateria,
  element: HTMLElement,
  onNotify?: (msg: string) => void
): Promise<boolean> => {
  try {
    if (onNotify) onNotify('Gerando imagem em alta resolução (1080x1920)...');
    
    // Pequena pausa para garantir renderização de fontes e imagens
    await new Promise(resolve => setTimeout(resolve, 350));

    const canvas = await html2canvas(element, {
      scale: 1, // 1080x1920 nativo
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#fcfaf7',
      width: 1080,
      height: 1920,
      windowWidth: 1080,
      windowHeight: 1920,
      logging: false
    });

    const image = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    const sanitized = (materia.titulo || 'Materia').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 35);
    link.download = `Jornal_Story_1080x1920_${sanitized}.png`;
    link.href = image;
    link.click();

    if (onNotify) onNotify('✨ Imagem do Jornal (1080x1920) baixada com sucesso!');
    return true;
  } catch (err) {
    console.error('Erro ao exportar PNG do jornal:', err);
    if (onNotify) onNotify('Erro ao gerar imagem PNG. Tente novamente.');
    return false;
  }
};

export const MateriaJornalPngModal: React.FC<MateriaJornalPngModalProps> = ({
  materia,
  isOpen,
  onClose,
  logoUrl,
  onNotify
}) => {
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const offscreenRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !materia) return null;

  const handleDownloadPng = async () => {
    if (!offscreenRef.current) return;
    setDownloading(true);
    if (onNotify) onNotify('Renderizando Story em 1080x1920 PNG...');

    try {
      await new Promise(resolve => setTimeout(resolve, 600));

      const canvas = await html2canvas(offscreenRef.current, {
        scale: 1, // Resolução nativa exata 1080x1920
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fcfaf7',
        width: 1080,
        height: 1920,
        windowWidth: 1080,
        windowHeight: 1920,
        logging: false
      });

      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const sanitized = materia.titulo.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      link.download = `Jornal_Story_1080x1920_${sanitized}.png`;
      link.href = image;
      link.click();

      if (onNotify) onNotify('✨ Story em PNG (1080x1920) baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PNG do jornal:', err);
      if (onNotify) onNotify('Erro ao gerar imagem PNG. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!offscreenRef.current) return;
    setDownloadingPdf(true);
    if (onNotify) onNotify('Gerando documento PDF vertical...');

    try {
      await new Promise(resolve => setTimeout(resolve, 600));

      const canvas = await html2canvas(offscreenRef.current, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fcfaf7',
        width: 1080,
        height: 1920,
        windowWidth: 1080,
        windowHeight: 1920,
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [1080, 1920] });
      pdf.addImage(imgData, 'JPEG', 0, 0, 1080, 1920);
      
      const sanitized = materia.titulo.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      pdf.save(`Jornal_Story_1080x1920_${sanitized}.pdf`);

      if (onNotify) onNotify('✨ Download do PDF concluído!');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      if (onNotify) onNotify('Erro ao gerar PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3500] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in font-sans">
      
      {/* Modal Container */}
      <div className="bg-slate-900 text-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-800 flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* Header do Modal com Controles */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-black shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Exportar Matéria no Formato Story</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                  Vertical 1080 × 1920 px
                </span>
              </div>
              <p className="text-xs text-slate-400">Jornal em formato vertical perfeito para Instagram Stories e WhatsApp Status.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || downloading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-rose-400" />}
              <span className="hidden sm:inline">Baixar PDF</span>
            </button>

            <button
              onClick={handleDownloadPng}
              disabled={downloading || downloadingPdf}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{downloading ? 'Gerando Story PNG...' : 'Baixar Story PNG (1080x1920)'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área de Visualização Centralizada com Aspect Ratio 9:16 Vertical */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar flex items-center justify-center bg-slate-950/70">
          
          {/* Container Responsivo de Prévia Vertical com escala suave */}
          <div 
            className="relative bg-slate-900 rounded-[2.5rem] p-1 shadow-2xl ring-1 ring-white/20 flex items-center justify-center overflow-hidden"
            style={{
              height: '70vh',
              width: 'calc(70vh * 9 / 16)',
              maxHeight: '620px',
              maxWidth: '350px'
            }}
          >
            {/* Viewport escalado contendo o template 1080x1920 */}
            <div
              className="w-[1080px] h-[1920px] origin-top-left select-none pointer-events-none"
              style={{
                transform: `scale(${350 / 1080})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: '0',
                left: '0'
              }}
            >
              <StoryMateriaJornalTemplate materia={materia} logoUrl={logoUrl} />
            </div>
          </div>

        </div>

      </div>

      {/* ELEMENTO OFF-SCREEN PURO (1080x1920 SEM ESCALA) PARA CAPTURA DO HTML2CANVAS */}
      <div
        style={{
          position: 'fixed',
          left: '-20000px',
          top: '0',
          width: '1080px',
          height: '1920px',
          overflow: 'hidden',
          zIndex: -9999
        }}
      >
        <div ref={offscreenRef} style={{ width: '1080px', height: '1920px' }}>
          <StoryMateriaJornalTemplate materia={materia} logoUrl={logoUrl} />
        </div>
      </div>

    </div>
  );
};
