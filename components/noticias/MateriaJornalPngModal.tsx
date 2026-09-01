import React, { useState, useRef } from 'react';
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

  // Ajuste inteligente do tamanho da fonte e espaçamento para que o texto ocupe o espaço com elegância, equilíbrio e máxima legibilidade
  const contentLength = cleanConteudo.length;
  let bodyFontSize = '21px';
  let bodyLineHeight = '1.65';
  let bodySpacing = 'space-y-4';

  if (contentLength > 1100) {
    bodyFontSize = '18px';
    bodyLineHeight = '1.54';
    bodySpacing = 'space-y-3';
  } else if (contentLength > 850) {
    bodyFontSize = '19.5px';
    bodyLineHeight = '1.6';
    bodySpacing = 'space-y-3.5';
  } else if (contentLength > 600) {
    bodyFontSize = '21px';
    bodyLineHeight = '1.65';
    bodySpacing = 'space-y-4';
  } else if (contentLength > 400) {
    bodyFontSize = '23px';
    bodyLineHeight = '1.72';
    bodySpacing = 'space-y-4.5';
  } else {
    bodyFontSize = '25px';
    bodyLineHeight = '1.78';
    bodySpacing = 'space-y-5';
  }

  // Ajuste do título com proporção elegante
  const titleLength = (materia.titulo || '').length;
  const titleFontSize = titleLength > 120 ? '33px' : titleLength > 80 ? '37px' : titleLength > 50 ? '41px' : '45px';

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
            {logoUrl ? (
              <img src={logoUrl} alt="Logo Prefeitura" className="h-20 w-auto object-contain shrink-0" />
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
      {/* 2. CORPO DA NOTÍCIA COM ESPAÇAMENTO EQUILIBRADO ENTRE AS SEÇÕES */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 my-6 flex flex-col justify-between overflow-hidden gap-7">
        
        {/* Bloco de Manchete e Lead com Amplo Respiro e Entrelinhamento Arejado */}
        <div className="space-y-4 shrink-0 pt-1">
          <div className="flex items-center gap-2.5 font-sans mb-3">
            <span className="w-3.5 h-3.5 rounded-full bg-indigo-600"></span>
            <span className="text-[13px] font-black tracking-widest uppercase text-indigo-900">
              {materia.setor ? `AÇÃO MUNICIPAL: ${materia.setor.toUpperCase()}` : 'COMUNICADO OFICIAL'}
            </span>
          </div>

          {/* Manchete Principal com Excelente Espaçamento de Linha */}
          <h2
            style={{ fontSize: titleFontSize, lineHeight: '1.4' }}
            className="font-serif font-black text-slate-950 tracking-tight my-4"
          >
            {materia.titulo}
          </h2>

          {/* Subtítulo / Lead com Linhas Arejadas e Margens Generosas */}
          {materia.subtitulo && (
            <div className="border-l-4 border-indigo-600 pl-6 pr-4 py-4 bg-indigo-50/70 rounded-r-2xl mt-6 mb-3">
              <p className="text-[21px] font-serif text-slate-800 italic font-medium leading-[1.65]">
                "{materia.subtitulo}"
              </p>
            </div>
          )}
        </div>

        {/* Foto do Evento (Formato Original Proporcional, Sem Achatar) */}
        {materia.imagemUrl ? (
          <div className="space-y-2 shrink-0 w-full my-2">
            <div className="w-full max-h-[500px] rounded-3xl overflow-hidden shadow-md border-2 border-slate-900 bg-slate-950/5 relative flex items-center justify-center">
              <img
                src={materia.imagemUrl}
                alt={materia.titulo}
                className="w-full max-h-[500px] object-contain block mx-auto"
                style={{ aspectRatio: 'auto' }}
              />
              {logoUrl && (
                <div className="absolute bottom-3.5 right-3.5 p-2 rounded-xl bg-white/95 backdrop-blur-sm shadow-md border border-slate-200">
                  <img src={logoUrl} alt="Logo" className="h-6 max-w-[90px] object-contain" />
                </div>
              )}
            </div>
            <p className="text-xs font-sans text-slate-500 italic text-center font-medium pt-1">
              Foto oficial: Assessoria de Comunicação & Imprensa
            </p>
          </div>
        ) : null}

        {/* Texto da Matéria em 2 Colunas Jornalísticas com Tipografia Encorpada e Legível */}
        <div
          style={{
            fontSize: bodyFontSize,
            lineHeight: bodyLineHeight,
            columnCount: 2,
            columnGap: '50px',
            textAlign: 'justify'
          }}
          className={`text-slate-900 font-serif flex-1 py-3 my-1 ${bodySpacing}`}
        >
          <div className="whitespace-pre-line font-normal">
            {cleanConteudo}
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. RODAPÉ DO JORNAL VERTICAL COM CERTIFICAÇÃO */}
      {/* ------------------------------------------------------------- */}
      <div className="pt-5 border-t-2 border-slate-900 flex items-center justify-between font-sans text-xs text-slate-500 font-bold shrink-0 mt-4">
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
