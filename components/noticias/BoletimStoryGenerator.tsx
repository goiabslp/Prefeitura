import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BoletimMetricas } from '../../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Sparkles,
  Pill,
  Activity,
  Car,
  CheckCircle2,
  Share2,
  Calendar,
  Layers,
  Loader2,
  Building2,
  TrendingUp,
  MapPin,
  Stethoscope,
  Newspaper,
  Quote,
  ShieldCheck
} from 'lucide-react';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface BoletimStoryGeneratorProps {
  boletim: BoletimMetricas;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string) => void;
  logoUrl?: string;
}

export const BoletimStoryGenerator: React.FC<BoletimStoryGeneratorProps> = ({
  boletim,
  isOpen,
  onClose,
  onNotify,
  logoUrl
}) => {
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!isOpen) return null;

  const totalSlides = 5;

  /**
   * Baixa uma página específica em formato PNG (1080 × 1920 px)
   */
  const downloadSingleSlide = async (slideIndex: number) => {
    const element = slideRefs.current[slideIndex];
    if (!element) return;

    try {
      setDownloading(true);
      setDownloadProgress(`Gerando Story ${slideIndex + 1}...`);

      const canvas = await html2canvas(element, {
        scale: 1, // Resolução nativa 1080x1920
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8fafc',
        width: 1080,
        height: 1920,
        windowWidth: 1080,
        windowHeight: 1920
      });

      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const filename = `Jornal_Story_${slideIndex + 1}_${boletim.tipo}_${boletim.ano}.png`;
      link.download = filename;
      link.href = image;
      link.click();

      if (onNotify) onNotify(`Story de Jornal ${slideIndex + 1} baixado com sucesso em 1080x1920!`);
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
      if (onNotify) onNotify('Erro ao gerar imagem para download.');
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  };

  /**
   * Baixa todas as páginas de Stories no formato de Jornal (1080 × 1920 px)
   */
  const downloadAllSlides = async () => {
    try {
      setDownloading(true);
      for (let i = 0; i < totalSlides; i++) {
        setDownloadProgress(`Gerando Story ${i + 1} de ${totalSlides}...`);
        const element = slideRefs.current[i];
        if (!element) continue;

        const canvas = await html2canvas(element, {
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#f8fafc',
          width: 1080,
          height: 1920,
          windowWidth: 1080,
          windowHeight: 1920
        });

        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        const filename = `Jornal_Story_${i + 1}_${boletim.tipo}_${boletim.ano}_${boletim.numeroSemana ? `Semana_${boletim.numeroSemana}` : 'Mensal'}.png`;
        link.download = filename;
        link.href = image;
        link.click();

        await new Promise(r => setTimeout(r, 600));
      }

      if (onNotify) onNotify('Todas as 5 páginas do Jornal em Stories foram baixadas!');
    } catch (error) {
      console.error('Erro ao baixar stories:', error);
      if (onNotify) onNotify('Erro ao gerar conjunto de imagens.');
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  };

  /**
   * Baixa o documento completo consolidado em PDF
   */
  const downloadPdf = async () => {
    try {
      setDownloading(true);
      setDownloadProgress('Gerando Caderno Completo em PDF...');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [1080, 1920]
      });

      for (let i = 0; i < totalSlides; i++) {
        const element = slideRefs.current[i];
        if (!element) continue;

        if (i > 0) pdf.addPage([1080, 1920], 'portrait');

        const canvas = await html2canvas(element, {
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#f8fafc',
          width: 1080,
          height: 1920,
          windowWidth: 1080,
          windowHeight: 1920
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 1080, 1920);
      }

      pdf.save(`Jornal_Oficial_${boletim.tipo}_${boletim.ano}.pdf`);
      if (onNotify) onNotify('Edição completa em PDF exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      if (onNotify) onNotify('Erro ao gerar PDF da edição.');
    } finally {
      setDownloading(false);
      setDownloadProgress('');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[3000] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-between p-4 sm:p-6 overflow-hidden animate-fade-in font-sans">
      
      {/* Top Header & Actions */}
      <div className="w-full max-w-5xl flex items-center justify-between gap-4 pb-3 border-b border-white/10 shrink-0">
        
        {/* Title & Metadata */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shadow-md shrink-0">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                Exportar Matéria no Formato de Jornal (Stories)
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase">
                1080 × 1920 px (9:16)
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Layout editorial de jornal organizado, bem diagramado e pronto para redes sociais
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadSingleSlide(activeSlide)}
            disabled={downloading}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
            title="Baixar a página atual em PNG"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Baixar Este</span>
          </button>

          <button
            onClick={downloadAllSlides}
            disabled={downloading}
            className="px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
            <span>Baixar Todos (5 Stories)</span>
          </button>

          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
            title="Baixar em PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {downloadProgress && (
        <div className="mb-2 px-4 py-1.5 bg-indigo-500 text-white text-xs font-bold rounded-full animate-pulse shadow-md">
          {downloadProgress}
        </div>
      )}

      {/* Main Preview Workspace */}
      <div className="flex-1 w-full max-w-5xl flex items-center justify-center gap-4 min-h-0 relative">
        
        {/* Prev Button */}
        <button
          onClick={() => setActiveSlide(prev => (prev > 0 ? prev - 1 : totalSlides - 1))}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-lg"
          title="Story Anterior"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Story Canvas Container Preview: Scales the 1080x1920 DOM element smoothly */}
        <div 
          className="relative bg-slate-900 rounded-[2.5rem] p-1 shadow-2xl ring-1 ring-white/20 flex items-center justify-center overflow-hidden"
          style={{
            height: '70vh',
            width: 'calc(70vh * 9 / 16)',
            maxHeight: '620px',
            maxWidth: '350px'
          }}
        >
          {/* Paginação do Story no topo do Preview */}
          <div className="absolute top-4 left-6 right-6 flex items-center gap-1.5 z-30 pointer-events-none">
            {[0, 1, 2, 3, 4].map(idx => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition-all ${
                  activeSlide === idx ? 'bg-indigo-600 shadow-sm' : 'bg-slate-300/40'
                }`}
              />
            ))}
          </div>

          {/* Scaled viewport containing the 1080x1920 template */}
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
            {activeSlide === 0 && <StoryNewspaperCapaTemplate boletim={boletim} logoUrl={logoUrl} />}
            {activeSlide === 1 && <StoryNewspaperFarmaciaTemplate boletim={boletim} logoUrl={logoUrl} />}
            {activeSlide === 2 && <StoryNewspaperConsultasTemplate boletim={boletim} logoUrl={logoUrl} />}
            {activeSlide === 3 && <StoryNewspaperVeiculosTemplate boletim={boletim} logoUrl={logoUrl} />}
            {activeSlide === 4 && <StoryNewspaperResumoTemplate boletim={boletim} logoUrl={logoUrl} />}
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={() => setActiveSlide(prev => (prev < totalSlides - 1 ? prev + 1 : 0))}
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-lg"
          title="Próximo Story"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Slide Thumbnails & Selector */}
      <div className="flex items-center gap-2 mt-3 p-1.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
        {[
          { label: '1. Capa do Jornal', icon: Newspaper },
          { label: '2. Caderno Saúde', icon: Pill },
          { label: '3. Caderno Regulação', icon: Activity },
          { label: '4. Caderno Frotas', icon: Car },
          { label: '5. Balanço Geral', icon: CheckCircle2 }
        ].map((item, idx) => {
          const Icon = item.icon;
          const isActive = activeSlide === idx;
          return (
            <button
              key={idx}
              onClick={() => setActiveSlide(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-md font-black'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* OFF-SCREEN EXACT 1080x1920 DOM ELEMENTS PARA O HTML2CANVAS */}
      <div
        id="story-export-container"
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
        <div ref={el => { slideRefs.current[0] = el; }} style={{ width: '1080px', height: '1920px' }}>
          <StoryNewspaperCapaTemplate boletim={boletim} logoUrl={logoUrl} />
        </div>
        <div ref={el => { slideRefs.current[1] = el; }} style={{ width: '1080px', height: '1920px' }}>
          <StoryNewspaperFarmaciaTemplate boletim={boletim} logoUrl={logoUrl} />
        </div>
        <div ref={el => { slideRefs.current[2] = el; }} style={{ width: '1080px', height: '1920px' }}>
          <StoryNewspaperConsultasTemplate boletim={boletim} logoUrl={logoUrl} />
        </div>
        <div ref={el => { slideRefs.current[3] = el; }} style={{ width: '1080px', height: '1920px' }}>
          <StoryNewspaperVeiculosTemplate boletim={boletim} logoUrl={logoUrl} />
        </div>
        <div ref={el => { slideRefs.current[4] = el; }} style={{ width: '1080px', height: '1920px' }}>
          <StoryNewspaperResumoTemplate boletim={boletim} logoUrl={logoUrl} />
        </div>
      </div>

    </div>,
    document.body
  );
};

// ==============================================================================
// TEMPLATES JORNALÍSTICOS EM ALTA DEFINIÇÃO 1080 × 1920 (FORMATO DE JORNAL IMPRESSO/DIGITAL)
// ==============================================================================

// ------------------------------------------------------------------------------
// PÁGINA 1: CAPA DO JORNAL OFICIAL (MANCHETE PRINCIPAL & FATOS RÁPIDOS)
// ------------------------------------------------------------------------------
const StoryNewspaperCapaTemplate: React.FC<{ boletim: BoletimMetricas; logoUrl?: string }> = ({ boletim, logoUrl }) => {
  const totalGeral = boletim.farmacia.totalMedicamentosDispensados +
                     boletim.consultas.totalAgendamentos +
                     boletim.veiculos.totalPassageiros;

  return (
    <div
      style={{
        width: '1080px',
        height: '1920px',
        boxSizing: 'border-box',
        background: '#fbfaf8',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '70px 65px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
      }}
    >
      {/* Borda Dupla Clássica de Jornal */}
      <div style={{ position: 'absolute', inset: '24px', border: '3px solid #0f172a', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '30px', border: '1px solid #94a3b8', pointerEvents: 'none' }} />

      {/* 1. CABEÇALHO DO JORNAL (MASTHEAD) */}
      <div style={{ textAlign: 'center', borderBottom: '4px double #0f172a', paddingBottom: '24px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontFamily: 'sans-serif', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px', marginBottom: '16px' }}>
          <span>Edição Digital Oficial</span>
          <span>São José do Goiabal — MG</span>
          <span>Distribuição Pública Gratuita</span>
        </div>

        {/* Logo / Brasão & Nome do Jornal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '12px 0' }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ height: '64px', maxWidth: '200px', objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: '40px' }}>🏛️</div>
          )}
          <h1 style={{ fontSize: '58px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0, color: '#0f172a' }}>
            Jornal Oficial da Cidade
          </h1>
        </div>

        {/* Faixa de Informações da Edição */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontFamily: 'sans-serif', fontWeight: 800, textTransform: 'uppercase', color: '#1e293b', borderTop: '2px solid #0f172a', paddingTop: '10px', marginTop: '12px' }}>
          <span>{boletim.tipo === 'Mensal' ? 'Edição Mensal Consolidada' : `Edição Semanal — Semana ${boletim.numeroSemana || ''}`}</span>
          <span>Período: {boletim.dataInicio.split('-')[2]}/{boletim.dataInicio.split('-')[1]} a {boletim.dataFim.split('-')[2]}/{boletim.dataFim.split('-')[1]}/{boletim.ano}</span>
          <span>Transparência Pública</span>
        </div>

      </div>

      {/* 2. CORPO DA MATÉRIA: MANCHETE PRINCIPAL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', margin: 'auto 0' }}>
        
        {/* Badge da Seção */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ background: '#dc2626', color: '#ffffff', fontSize: '18px', fontFamily: 'sans-serif', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', padding: '6px 18px', borderRadius: '6px' }}>
            Manchete Principal
          </span>
          <span style={{ fontSize: '20px', fontFamily: 'sans-serif', fontWeight: 800, color: '#64748b' }}>
            • Gestão Integrada & Resultados Oficiais
          </span>
        </div>

        {/* Manchete Gigante de Jornal */}
        <h2 style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#090d16', margin: 0 }}>
          {boletim.tipo === 'Mensal'
            ? `Balanço Mensal: Administração consolida mais de ${totalGeral.toLocaleString('pt-BR')} atendimentos e procedimentos prestados no município`
            : `Boletim Semanal: Saúde e Transporte realizam mais de ${totalGeral.toLocaleString('pt-BR')} atendimentos na Semana ${boletim.numeroSemana || ''}`}
        </h2>

        {/* Lead da Notícia */}
        <p style={{ fontSize: '26px', fontStyle: 'italic', color: '#334155', lineHeight: 1.45, margin: 0, borderLeft: '6px solid #2563eb', paddingLeft: '24px' }}>
          "{boletim.descricao} Levantamento oficial auditado reúne indicadores da Assistência Farmacêutica, Regulação Médica e Frota Municipal de Veículos."
        </p>

        {/* BOX DE FATOS RÁPIDOS DA MATÉRIA (ESTILO JORNAL) */}
        <div style={{ background: '#f1f5f9', border: '2px solid #cbd5e1', borderRadius: '24px', padding: '36px 40px', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#0f172a' }}>
              ⚡ Fatos & Números Rápidos da Edição
            </span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#2563eb' }}>
              Dados Auditados em Tempo Real
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '24px', textAlign: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', color: '#e11d48', display: 'block' }}>
                💊 Farmácia Popular
              </span>
              <span style={{ fontSize: '48px', fontWeight: 900, color: '#0f172a', margin: '8px 0', display: 'block', lineHeight: 1 }}>
                {boletim.farmacia.totalMedicamentosDispensados.toLocaleString('pt-BR')}
              </span>
              <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 700 }}>
                remédios gratuitos
              </span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '24px', textAlign: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', color: '#0284c7', display: 'block' }}>
                🩺 Consultas & Exames
              </span>
              <span style={{ fontSize: '48px', fontWeight: 900, color: '#0f172a', margin: '8px 0', display: 'block', lineHeight: 1 }}>
                {boletim.consultas.totalAgendamentos.toLocaleString('pt-BR')}
              </span>
              <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 700 }}>
                vagas reguladas
              </span>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '24px', textAlign: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', color: '#4f46e5', display: 'block' }}>
                🚐 Transporte & Frotas
              </span>
              <span style={{ fontSize: '48px', fontWeight: 900, color: '#0f172a', margin: '8px 0', display: 'block', lineHeight: 1 }}>
                {boletim.veiculos.totalPassageiros.toLocaleString('pt-BR')}
              </span>
              <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 700 }}>
                cidadãos transportados
              </span>
            </div>

          </div>
        </div>

        {/* Aspas em Destaque */}
        <blockquote style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderLeft: '8px solid #0f172a', borderRadius: '16px', padding: '24px 32px', margin: 0 }}>
          <p style={{ fontSize: '22px', fontStyle: 'italic', color: '#1e293b', margin: 0, lineHeight: 1.5 }}>
            "Cada serviço entregue reflete o compromisso contínuo da prefeitura em valorizar os recursos públicos e prestar assistência humanizada à nossa população."
          </p>
          <span style={{ fontSize: '16px', fontFamily: 'sans-serif', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', display: 'block', marginTop: '12px' }}>
            — Assessoria de Comunicação Oficial & Transparência
          </span>
        </blockquote>

      </div>

      {/* 3. RODAPÉ DO JORNAL */}
      <div style={{ borderTop: '3px solid #0f172a', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldCheck style={{ width: '28px', height: '28px', color: '#059669' }} />
          <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>
            📊 "Resultados que demonstram o trabalho e os serviços realizados em nosso município."
          </span>
        </div>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#2563eb' }}>
          Arraste para o lado ➔
        </span>
      </div>

    </div>
  );
};

// ------------------------------------------------------------------------------
// PÁGINA 2: CADERNO DE SAÚDE & FARMÁCIA POPULAR
// ------------------------------------------------------------------------------
const StoryNewspaperFarmaciaTemplate: React.FC<{ boletim: BoletimMetricas; logoUrl?: string }> = ({ boletim, logoUrl }) => {
  const f = boletim.farmacia;
  return (
    <div
      style={{
        width: '1080px',
        height: '1920px',
        boxSizing: 'border-box',
        background: '#fbfaf8',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '70px 65px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
      }}
    >
      <div style={{ position: 'absolute', inset: '24px', border: '3px solid #0f172a', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '30px', border: '1px solid #94a3b8', pointerEvents: 'none' }} />

      {/* Header Caderno */}
      <div style={{ borderBottom: '4px double #0f172a', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontFamily: 'sans-serif', fontWeight: 800, textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '14px' }}>
          <span>Caderno de Saúde Pública</span>
          <span>Setor 01 • Assistência Farmacêutica</span>
          <span>Edição Oficial</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '50px', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#e11d48' }}>
            💊 Farmácia Popular Municipal
          </h1>
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />}
        </div>
      </div>

      {/* Conteúdo da Matéria */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', margin: 'auto 0' }}>
        
        <h2 style={{ fontSize: '54px', fontWeight: 900, lineHeight: 1.1, color: '#090d16', margin: 0 }}>
          Em {MESES[boletim.mes - 1]?.toUpperCase() || 'MÊS'} de {boletim.ano}, a Farmácia Popular atende {f.totalPacientesAtendidos.toLocaleString('pt-BR')} munícipes e garante entrega pontual de medicamentos
        </h2>

        <p style={{ fontSize: '24px', color: '#334155', lineHeight: 1.5, margin: 0 }}>
          A Assistência Farmacêutica Municipal atingiu a marca expressiva de <strong>{f.totalMedicamentosDispensados.toLocaleString('pt-BR')} unidades</strong> de remédios gratuitos distribuídos em <strong>{f.totalAtendimentos} receitas atendidas</strong> durante o período analisado em São José do Goiabal.
        </p>

        {/* Destaque Principal em Caixa Jornalística */}
        <div style={{ background: '#fff1f2', border: '3px solid #fecdd3', borderRadius: '24px', padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <span style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#e11d48', letterSpacing: '0.15em' }}>
            Total de Medicamentos Gratuitos Dispensados
          </span>
          <div style={{ fontSize: '96px', fontWeight: 900, color: '#be123c', lineHeight: 1, margin: '16px 0 8px 0' }}>
            {f.totalMedicamentosDispensados.toLocaleString('pt-BR')}
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#475569' }}>
            Unidades fornecidas com acompanhamento e receita médica
          </span>
        </div>

        {/* 2 Colunas de Indicadores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontFamily: 'sans-serif' }}>
          <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '20px', padding: '30px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b' }}>
              Receitas Atendidas
            </span>
            <div style={{ fontSize: '56px', fontWeight: 900, color: '#e11d48', margin: '8px 0 4px 0', lineHeight: 1 }}>
              {f.totalAtendimentos.toLocaleString('pt-BR')}
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>Prescrições dispensadas</span>
          </div>

          <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '20px', padding: '30px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b' }}>
              Pacientes Atendidos
            </span>
            <div style={{ fontSize: '56px', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0', lineHeight: 1 }}>
              {f.totalPacientesAtendidos.toLocaleString('pt-BR')}
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>Munícipes beneficiados</span>
          </div>
        </div>

        {/* Top Medicamentos */}
        {f.topMedicamentos.length > 0 && (
          <div style={{ background: '#ffffff', border: '2px solid #cbd5e1', borderRadius: '20px', padding: '28px 36px', fontFamily: 'sans-serif' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#e11d48', display: 'block', marginBottom: '16px' }}>
              📋 Principais Medicamentos Fornecidos no Período
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {f.topMedicamentos.slice(0, 3).map((med, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#1e293b' }}>{idx + 1}. {med.nome}</span>
                  <span style={{ color: '#be123c', fontFamily: 'monospace', fontWeight: 900 }}>{med.quantidade} un</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{ borderTop: '3px solid #0f172a', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
          Prefeitura Municipal de São José do Goiabal • Secretaria de Saúde
        </span>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#e11d48' }}>
          Caderno 01 ➔
        </span>
      </div>

    </div>
  );
};

// ------------------------------------------------------------------------------
// PÁGINA 3: CADERNO DE REGULAÇÃO & CONSULTAS MÉDICAS
// ------------------------------------------------------------------------------
const StoryNewspaperConsultasTemplate: React.FC<{ boletim: BoletimMetricas; logoUrl?: string }> = ({ boletim, logoUrl }) => {
  const c = boletim.consultas;
  return (
    <div
      style={{
        width: '1080px',
        height: '1920px',
        boxSizing: 'border-box',
        background: '#fbfaf8',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '70px 65px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
      }}
    >
      <div style={{ position: 'absolute', inset: '24px', border: '3px solid #0f172a', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '30px', border: '1px solid #94a3b8', pointerEvents: 'none' }} />

      {/* Header Caderno */}
      <div style={{ borderBottom: '4px double #0f172a', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontFamily: 'sans-serif', fontWeight: 800, textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '14px' }}>
          <span>Caderno de Especialidades & Exames</span>
          <span>Setor 02 • Regulação Municipal</span>
          <span>Edição Oficial</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '50px', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#0284c7' }}>
            🩺 Central de Regulação
          </h1>
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />}
        </div>
      </div>

      {/* Conteúdo da Matéria */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', margin: 'auto 0' }}>
        
        <h2 style={{ fontSize: '54px', fontWeight: 900, lineHeight: 1.1, color: '#090d16', margin: 0 }}>
          Em {MESES[boletim.mes - 1]?.toUpperCase() || 'MÊS'} de {boletim.ano}, a Central de Regulação viabiliza {c.totalAgendamentos.toLocaleString('pt-BR')} atendimentos especializados
        </h2>

        <p style={{ fontSize: '24px', color: '#334155', lineHeight: 1.5, margin: 0 }}>
          O setor municipal de regulação médica garantiu agilidade no direcionamento de <strong>{c.totalPacientesAtendidos} pacientes</strong> para consultas especializadas e exames.
        </p>

        {/* Destaque Principal em Caixa Jornalística */}
        <div style={{ background: '#f0f9ff', border: '3px solid #bae6fd', borderRadius: '24px', padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <span style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#0284c7', letterSpacing: '0.15em' }}>
            Agendamentos Médicos Viabilizados
          </span>
          <div style={{ fontSize: '96px', fontWeight: 900, color: '#0369a1', lineHeight: 1, margin: '16px 0 8px 0' }}>
            {c.totalAgendamentos.toLocaleString('pt-BR')}
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#475569' }}>
            Consultas, laudos e exames diagnósticos especializados
          </span>
        </div>

        {/* 2 Colunas de Indicadores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontFamily: 'sans-serif' }}>
          <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '20px', padding: '30px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b' }}>
              Taxa de Atendimento
            </span>
            <div style={{ fontSize: '56px', fontWeight: 900, color: '#0284c7', margin: '8px 0 4px 0', lineHeight: 1 }}>
              {c.taxaAtendimento}%
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>Aproveitamento de vagas</span>
          </div>

          <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '20px', padding: '30px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b' }}>
              Pacientes Atendidos
            </span>
            <div style={{ fontSize: '56px', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0', lineHeight: 1 }}>
              {c.totalPacientesAtendidos.toLocaleString('pt-BR')}
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>Munícipes encaminhados</span>
          </div>
        </div>

        {/* Top Especialidades */}
        {c.topProcedimentos.length > 0 && (
          <div style={{ background: '#ffffff', border: '2px solid #cbd5e1', borderRadius: '20px', padding: '28px 36px', fontFamily: 'sans-serif' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#0284c7', display: 'block', marginBottom: '16px' }}>
              📋 Especialidades Mais Demandadas
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {c.topProcedimentos.slice(0, 3).map((proc, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#1e293b' }}>{idx + 1}. {proc.nome}</span>
                  <span style={{ color: '#0369a1', fontFamily: 'monospace', fontWeight: 900 }}>{proc.quantidade} vagas</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{ borderTop: '3px solid #0f172a', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
          Prefeitura Municipal de São José do Goiabal • Regulação de Saúde
        </span>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7' }}>
          Caderno 02 ➔
        </span>
      </div>

    </div>
  );
};

// ------------------------------------------------------------------------------
// PÁGINA 4: CADERNO DE LOGÍSTICA & FROTAS
// ------------------------------------------------------------------------------
const StoryNewspaperVeiculosTemplate: React.FC<{ boletim: BoletimMetricas; logoUrl?: string }> = ({ boletim, logoUrl }) => {
  const v = boletim.veiculos;
  return (
    <div
      style={{
        width: '1080px',
        height: '1920px',
        boxSizing: 'border-box',
        background: '#fbfaf8',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '70px 65px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
      }}
    >
      <div style={{ position: 'absolute', inset: '24px', border: '3px solid #0f172a', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '30px', border: '1px solid #94a3b8', pointerEvents: 'none' }} />

      {/* Header Caderno */}
      <div style={{ borderBottom: '4px double #0f172a', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontFamily: 'sans-serif', fontWeight: 800, textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '14px' }}>
          <span>Caderno de Transportes & Logística</span>
          <span>Setor 03 • Frota Municipal</span>
          <span>Edição Oficial</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '50px', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#4f46e5' }}>
            🚐 Transporte de Pacientes & Frotas
          </h1>
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />}
        </div>
      </div>

      {/* Conteúdo da Matéria */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', margin: 'auto 0' }}>
        
        <h2 style={{ fontSize: '54px', fontWeight: 900, lineHeight: 1.1, color: '#090d16', margin: 0 }}>
          Em {MESES[boletim.mes - 1]?.toUpperCase() || 'MÊS'} de {boletim.ano}, a Frota Municipal transporta {v.totalPassageiros.toLocaleString('pt-BR')} cidadãos em {v.totalViagensRealizadas} viagens oficiais
        </h2>

        <p style={{ fontSize: '24px', color: '#334155', lineHeight: 1.5, margin: 0 }}>
          A infraestrutura logística do município garantiu deslocamento contínuo com segurança e pontualidade para tratamentos fora do domicílio (TFD), atendimento às secretarias e apoio à comunidade.
        </p>

        {/* Destaque Principal em Caixa Jornalística */}
        <div style={{ background: '#eef2ff', border: '3px solid #c7d2fe', borderRadius: '24px', padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <span style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#4f46e5', letterSpacing: '0.15em' }}>
            Total de Passageiros Transportados
          </span>
          <div style={{ fontSize: '96px', fontWeight: 900, color: '#3730a3', lineHeight: 1, margin: '16px 0 8px 0' }}>
            {v.totalPassageiros.toLocaleString('pt-BR')}
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#475569' }}>
            Pessoas atendidas com dignidade e conforto na estrada
          </span>
        </div>

        {/* 2 Colunas de Indicadores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontFamily: 'sans-serif' }}>
          <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '20px', padding: '30px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b' }}>
              Viagens Realizadas
            </span>
            <div style={{ fontSize: '56px', fontWeight: 900, color: '#4f46e5', margin: '8px 0 4px 0', lineHeight: 1 }}>
              {v.totalViagensRealizadas.toLocaleString('pt-BR')}
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>Rotas intermunicipais</span>
          </div>

          <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '20px', padding: '30px' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b' }}>
              Veículos em Operação
            </span>
            <div style={{ fontSize: '56px', fontWeight: 900, color: '#0f172a', margin: '8px 0 4px 0', lineHeight: 1 }}>
              {v.veiculosFrotaAtivos}
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#475569' }}>Frota ativa e revisada</span>
          </div>
        </div>

        {/* Top Destinos */}
        {v.topDestinos.length > 0 && (
          <div style={{ background: '#ffffff', border: '2px solid #cbd5e1', borderRadius: '20px', padding: '28px 36px', fontFamily: 'sans-serif' }}>
            <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#4f46e5', display: 'block', marginBottom: '16px' }}>
              📍 Principais Destinos das Viagens
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {v.topDestinos.slice(0, 3).map((dest, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: '#1e293b' }}>{idx + 1}. {dest.destino}</span>
                  <span style={{ color: '#3730a3', fontFamily: 'monospace', fontWeight: 900 }}>{dest.viagens} viagens</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div style={{ borderTop: '3px solid #0f172a', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
          Prefeitura Municipal de São José do Goiabal • Setor de Transportes
        </span>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#4f46e5' }}>
          Caderno 03 ➔
        </span>
      </div>

    </div>
  );
};

// ------------------------------------------------------------------------------
// PÁGINA 5: BALANÇO CONSOLIDADO GERAL & TRANSPARÊNCIA
// ------------------------------------------------------------------------------
const StoryNewspaperResumoTemplate: React.FC<{ boletim: BoletimMetricas; logoUrl?: string }> = ({ boletim, logoUrl }) => {
  const totalGeral = boletim.farmacia.totalMedicamentosDispensados +
                     boletim.consultas.totalAgendamentos +
                     boletim.veiculos.totalPassageiros;

  return (
    <div
      style={{
        width: '1080px',
        height: '1920px',
        boxSizing: 'border-box',
        background: '#fbfaf8',
        color: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '70px 65px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif'
      }}
    >
      <div style={{ position: 'absolute', inset: '24px', border: '3px solid #0f172a', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '30px', border: '1px solid #94a3b8', pointerEvents: 'none' }} />

      {/* Header Caderno */}
      <div style={{ borderBottom: '4px double #0f172a', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontFamily: 'sans-serif', fontWeight: 800, textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '14px' }}>
          <span>Balanço Consolidado Geral</span>
          <span>Relatório de Transparência Pública</span>
          <span>Edição Oficial</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '50px', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#059669' }}>
            📊 Relatório Consolidado
          </h1>
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />}
        </div>
      </div>

      {/* Conteúdo Consolidado */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', margin: 'auto 0' }}>
        
        <h2 style={{ fontSize: '54px', fontWeight: 900, lineHeight: 1.1, color: '#090d16', margin: 0, textAlign: 'center' }}>
          Total Geral: Mais de {totalGeral.toLocaleString('pt-BR')} serviços realizados em benefício dos cidadãos
        </h2>

        {/* 3 Grandes Cartões Setoriais */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'sans-serif' }}>
          
          <div style={{ background: '#fff1f2', border: '2px solid #fecdd3', borderRadius: '20px', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#be123c' }}>
                💊 Assistência Farmacêutica
              </span>
              <p style={{ fontSize: '16px', color: '#475569', margin: '4px 0 0 0' }}>
                Remédios gratuitos entregues à população
              </p>
            </div>
            <span style={{ fontSize: '48px', fontWeight: 900, color: '#be123c', fontFamily: 'monospace' }}>
              {boletim.farmacia.totalMedicamentosDispensados.toLocaleString('pt-BR')} un
            </span>
          </div>

          <div style={{ background: '#f0f9ff', border: '2px solid #bae6fd', borderRadius: '20px', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#0369a1' }}>
                🩺 Central de Regulação
              </span>
              <p style={{ fontSize: '16px', color: '#475569', margin: '4px 0 0 0' }}>
                Consultas e exames especializados agendados
              </p>
            </div>
            <span style={{ fontSize: '48px', fontWeight: 900, color: '#0369a1', fontFamily: 'monospace' }}>
              {boletim.consultas.totalAgendamentos.toLocaleString('pt-BR')} vagas
            </span>
          </div>

          <div style={{ background: '#eef2ff', border: '2px solid #c7d2fe', borderRadius: '20px', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#3730a3' }}>
                🚐 Transporte & Frotas
              </span>
              <p style={{ fontSize: '16px', color: '#475569', margin: '4px 0 0 0' }}>
                Passageiros transportados em viagens oficiais
              </p>
            </div>
            <span style={{ fontSize: '48px', fontWeight: 900, color: '#3730a3', fontFamily: 'monospace' }}>
              {boletim.veiculos.totalPassageiros.toLocaleString('pt-BR')} pessoas
            </span>
          </div>

        </div>

        {/* Carimbo de Transparência & Frase Oficial Obrigatória */}
        <div style={{ background: '#f8fafc', border: '3px solid #cbd5e1', borderRadius: '24px', padding: '36px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 18px', borderRadius: '999px', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '16px' }}>
            <ShieldCheck style={{ width: '20px', height: '20px' }} /> Transparência Pública Auditada
          </div>
          <h3 style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', margin: '0 0 12px 0', lineHeight: 1.3 }}>
            "Resultados que demonstram o trabalho e os serviços realizados em nosso município."
          </h3>
          <p style={{ fontSize: '18px', color: '#64748b', margin: 0, fontFamily: 'sans-serif' }}>
            Todos os dados são extraídos diretamente dos sistemas de gestão da Prefeitura Municipal de São José do Goiabal.
          </p>
        </div>

      </div>

      {/* Footer */}
      <div style={{ borderTop: '3px solid #0f172a', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
          Prefeitura Municipal de São José do Goiabal — MG
        </span>
        <span style={{ fontSize: '18px', fontWeight: 900, color: '#059669' }}>
          Edição Finalizada ✓
        </span>
      </div>

    </div>
  );
};
