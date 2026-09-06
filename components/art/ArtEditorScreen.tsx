import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Send, Sparkles, Sliders, Shield, Download, RefreshCw,
  Copy, Trash2, Check, Layout, Palette, Type, Move, Image as ImageIcon
} from 'lucide-react';
import { ArtPublication, ArtVariation, ArtFormatType, ArtLogoItem, ArtLogoPosition } from '../../types';
import { artStudioService } from '../../services/artStudioService';
import { ArtCanvasRenderer } from './ArtCanvasRenderer';

interface ArtEditorScreenProps {
  publicationId?: string | null;
  onBack: () => void;
  onNavigate: (route: string) => void;
}

export const ArtEditorScreen: React.FC<ArtEditorScreenProps> = ({
  publicationId,
  onBack,
  onNavigate
}) => {
  const [publication, setPublication] = useState<ArtPublication | null>(null);
  const [currentVariation, setCurrentVariation] = useState<ArtVariation | null>(null);
  const [format, setFormat] = useState<ArtFormatType>('vertical');
  const [logos, setLogos] = useState<ArtLogoItem[]>([]);
  const [selectedLogoId, setSelectedLogoId] = useState<string>('');
  
  // Chat com IA
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Olá! Sou o assistente de design da Prefeitura. Peça ajustes como "Deixe o título mais chamativo", "Destaque a data" ou "Mude as cores para azul e dourado".'
    }
  ]);

  // Aba ativa do painel lateral de edição
  const [activeTab, setActiveTab] = useState<'ia' | 'texto' | 'logo' | 'cores'>('ia');

  useEffect(() => {
    const loadedLogos = artStudioService.getLogos();
    setLogos(loadedLogos);

    artStudioService.loadLogosAsync().then((asyncLogos) => {
      if (asyncLogos && asyncLogos.length > 0) {
        setLogos(asyncLogos);
      }
    }).catch(() => {});

    if (publicationId) {
      const pub = artStudioService.getPublicationById(publicationId);
      if (pub) {
        setPublication(pub);
        const selVar = pub.variations[pub.selectedVariationIndex || 0] || pub.variations[0];
        setCurrentVariation(selVar);
        setSelectedLogoId(pub.selectedLogoId || (loadedLogos[0]?.id || ''));
        setFormat(pub.activeFormat || 'vertical');
      }
    }
  }, [publicationId]);

  if (!publication || !currentVariation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <h3 className="text-lg font-black text-slate-900">Publicação não encontrada</h3>
        <p className="text-xs text-slate-500">Selecione uma publicação válida no histórico para editar.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          Voltar ao Painel
        </button>
      </div>
    );
  }

  const selectedLogo = logos.find(l => l.id === selectedLogoId) || logos[0] || null;

  // Enviar comando para o chat da IA
  const handleSendAiCommand = async () => {
    if (!aiPrompt.trim() || isAiProcessing) return;

    const userCmd = aiPrompt.trim();
    setAiPrompt('');
    setChatHistory(prev => [...prev, { role: 'user', text: userCmd }]);
    setIsAiProcessing(true);

    try {
      const updatedVar = await artStudioService.editArtWithAI(currentVariation, userCmd);
      setCurrentVariation(updatedVar);

      // Atualiza a publicação
      const updatedPub: ArtPublication = {
        ...publication,
        variations: publication.variations.map((v, i) =>
          i === publication.selectedVariationIndex ? updatedVar : v
        )
      };
      artStudioService.savePublication(updatedPub);
      setPublication(updatedPub);

      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', text: `Ajuste aplicado com sucesso com base no seu pedido: "${userCmd}".` }
      ]);
    } catch (e) {
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', text: 'Não foi possível processar o ajuste no momento. Tente novamente.' }
      ]);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleUpdateVariationField = (field: keyof ArtVariation, value: any) => {
    const updated = { ...currentVariation, [field]: value };
    setCurrentVariation(updated);

    const updatedPub = {
      ...publication,
      variations: publication.variations.map((v, i) =>
        i === publication.selectedVariationIndex ? updated : v
      )
    };
    artStudioService.savePublication(updatedPub);
    setPublication(updatedPub);
  };

  const handleUpdatePublicationField = (field: keyof ArtPublication, value: any) => {
    const updatedPub = { ...publication, [field]: value };
    setPublication(updatedPub);
    artStudioService.savePublication(updatedPub);
  };

  const handleDuplicate = () => {
    const copy = artStudioService.duplicatePublication(publication.id);
    if (copy) {
      alert('Publicação duplicada com sucesso!');
      onNavigate(`/Art/Editor/${copy.id}`);
    }
  };

  const logoPositions: Array<{ pos: ArtLogoPosition; label: string }> = [
    { pos: 'top_right', label: 'Superior Direito' },
    { pos: 'top_left', label: 'Superior Esquerdo' },
    { pos: 'bottom_right', label: 'Inferior Direito' },
    { pos: 'bottom_left', label: 'Inferior Esquerdo' },
    { pos: 'center_top', label: 'Centro Superior' },
    { pos: 'center_bottom', label: 'Centro Inferior' }
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
      {/* Barra de Navegação Superior com ROTA URL /Art/Editor/:id */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 md:px-8 py-4 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            type="button"
            className="p-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-200/60 cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                /Art/Editor/{publication.id.substring(0, 12)}
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5 truncate max-w-md">
              {publication.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Seletor de Formato */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setFormat('vertical')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                format === 'vertical' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              1080 × 1920
            </button>
            <button
              type="button"
              onClick={() => setFormat('quadrado')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                format === 'quadrado' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              1080 × 1080
            </button>
          </div>

          <button
            type="button"
            onClick={handleDuplicate}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            title="Duplicar Arte"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Área de Trabalho Dividida: Preview à esquerda + Painel de Edição à direita */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Lado Esquerdo: Visualização Nativa em Alta Resolução */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex items-center justify-center bg-slate-100/60">
          <ArtCanvasRenderer
            publication={publication}
            variation={currentVariation}
            format={format}
            logo={selectedLogo}
            primaryImage={publication.userImages?.[publication.primaryImageIndex || 0] || null}
            interactiveScale={true}
            className="w-full h-full"
          />
        </div>

        {/* Lado Direito: Painel de Controles e Chat da IA */}
        <div className="w-full lg:w-[420px] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-lg">
          {/* Abas do Editor */}
          <div className="flex items-center justify-around border-b border-slate-100 p-2 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setActiveTab('ia')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'ia' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>IA Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('texto')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'texto' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Textos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logo')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'logo' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Logo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cores')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'cores' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Cores</span>
            </button>
          </div>

          {/* Conteúdo da Aba */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
            {/* ABA 1: CHAT INTELIGENTE COM A IA */}
            {activeTab === 'ia' && (
              <div className="flex flex-col h-full justify-between space-y-4">
                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white ml-6 font-medium shadow-xs'
                          : 'bg-slate-100 text-slate-800 mr-6 font-medium border border-slate-200/60'
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {isAiProcessing && (
                    <div className="p-3 bg-slate-100 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>IA ajustando a composição...</span>
                    </div>
                  )}
                </div>

                {/* Caixa de Entrada de Comandos */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Deixe o título mais chamativo..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendAiCommand()}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:bg-white focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={!aiPrompt.trim() || isAiProcessing}
                    onClick={handleSendAiCommand}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-md disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ABA 2: EDIÇÃO DE TEXTOS */}
            {activeTab === 'texto' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Título</label>
                  <input
                    type="text"
                    value={currentVariation.headlineSummary || publication.title}
                    onChange={(e) => handleUpdateVariationField('headlineSummary', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Subtítulo</label>
                  <input
                    type="text"
                    value={currentVariation.subtitleSummary || publication.subtitle || ''}
                    onChange={(e) => handleUpdateVariationField('subtitleSummary', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Data do Evento</label>
                  <input
                    type="text"
                    value={publication.eventDate || ''}
                    onChange={(e) => handleUpdatePublicationField('eventDate', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Horário</label>
                  <input
                    type="text"
                    value={publication.eventTime || ''}
                    onChange={(e) => handleUpdatePublicationField('eventTime', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Local</label>
                  <input
                    type="text"
                    value={publication.eventLocation || ''}
                    onChange={(e) => handleUpdatePublicationField('eventLocation', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Chamada / CTA</label>
                  <input
                    type="text"
                    value={publication.ctaText || ''}
                    onChange={(e) => handleUpdatePublicationField('ctaText', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}

            {/* ABA 3: CONTROLES DA LOGO */}
            {activeTab === 'logo' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Troca Rápida da Logo</label>
                  <select
                    value={selectedLogoId}
                    onChange={(e) => {
                      setSelectedLogoId(e.target.value);
                      handleUpdatePublicationField('selectedLogoId', e.target.value);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    {logos.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Posicionamento da Logo</label>
                  <div className="grid grid-cols-2 gap-2">
                    {logoPositions.map(pos => (
                      <button
                        key={pos.pos}
                        type="button"
                        onClick={() => handleUpdateVariationField('logoPosition', pos.pos)}
                        className={`p-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                          currentVariation.logoPosition === pos.pos
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Tamanho da Logo</span>
                    <span>{currentVariation.logoSizePercent || 20}%</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={32}
                    value={currentVariation.logoSizePercent || 20}
                    onChange={(e) => handleUpdateVariationField('logoSizePercent', Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Opacidade</span>
                    <span>{Math.round((currentVariation.logoOpacity || 1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.05}
                    value={currentVariation.logoOpacity || 1}
                    onChange={(e) => handleUpdateVariationField('logoOpacity', Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* ABA 4: CORES E ESTILO */}
            {activeTab === 'cores' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Cor Primária</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentVariation.primaryColor}
                      onChange={(e) => handleUpdateVariationField('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded-xl cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={currentVariation.primaryColor}
                      onChange={(e) => handleUpdateVariationField('primaryColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Cor de Destaque</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentVariation.accentColor}
                      onChange={(e) => handleUpdateVariationField('accentColor', e.target.value)}
                      className="w-10 h-10 rounded-xl cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={currentVariation.accentColor}
                      onChange={(e) => handleUpdateVariationField('accentColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Cor do Texto</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentVariation.textColor}
                      onChange={(e) => handleUpdateVariationField('textColor', e.target.value)}
                      className="w-10 h-10 rounded-xl cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={currentVariation.textColor}
                      onChange={(e) => handleUpdateVariationField('textColor', e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
