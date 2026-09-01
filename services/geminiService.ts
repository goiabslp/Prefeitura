export const generateDocumentContent = async (
  topic: string, 
  tone: string, 
  docType: string
): Promise<{ title: string; body: string }> => {
  try {
    const payload = {
      tipo: 'documento',
      dados: {
        topic,
        tone,
        docType
      }
    };

    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro na comunicação com o servidor (${res.status}).`);
    }

    const data = await res.json();
    const textResponse = data.text;
    
    if (!textResponse) throw new Error("Sem resposta da IA");

    const json = JSON.parse(textResponse);
    
    return {
      title: json.title || "Documento Sem Título",
      body: json.body || textResponse
    };
  } catch (error) {
    console.error("Erro ao gerar conteúdo:", error);
    // Fallback em caso de erro de parse ou conexão
    return {
      title: "Erro na Geração",
      body: "Não foi possível estruturar o documento automaticamente. Verifique sua conexão e tente novamente."
    };
  }
};

export const polishMotivoWithAI = async (rawSpeechText: string): Promise<string> => {
  if (!rawSpeechText || !rawSpeechText.trim()) return '';
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'lapidar_motivo',
        dados: { promptText: rawSpeechText.trim() }
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Erro na requisição da IA.');
    }

    const data = await res.json();
    return data.text ? data.text.trim() : rawSpeechText;
  } catch (error) {
    console.warn('Erro ao lapidar motivo com IA, mantendo transcrição original:', error);
    return rawSpeechText;
  }
};

export interface GeneratedMateriaJornal {
  manchete: string;
  subtitulo: string;
  corpo: string;
  categoria: string;
  destaqueFrase: string;
}

export const generateMateriaJornalWithAI = async (dados: {
  titulo: string;
  tipoEvento: string;
  dataInicio: string;
  dataFim?: string;
  horaInicio?: string;
  horaFim?: string;
  descricao?: string;
  setor?: string;
  pessoas?: Array<{ name: string; role?: string; sector?: string }> | string[];
}): Promise<GeneratedMateriaJornal> => {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'materia_jornal',
        dados
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ao gerar matéria (${res.status}).`);
    }

    const data = await res.json();
    if (!data.text) throw new Error("Sem resposta da IA");

    const json = JSON.parse(data.text);

    let rawCorpo = json.corpo || `A Prefeitura Municipal de São José do Goiabal promoveu com sucesso a realização de "${dados.titulo}".\n\nA iniciativa reforça o compromisso contínuo da administração com a transparência, eficiência e a entrega de serviços de excelência para toda a comunidade.`;
    if (rawCorpo.length > 1185) {
      rawCorpo = rawCorpo.slice(0, 1185).replace(/\s+\S*$/, '') + '.';
    }

    return {
      manchete: json.manchete || `Ação Municipal: ${dados.titulo}`,
      subtitulo: json.subtitulo || `Administração municipal realiza ${dados.titulo} com foco no atendimento e desenvolvimento dos cidadãos.`,
      corpo: rawCorpo,
      categoria: json.categoria || (dados.setor ? dados.setor.toUpperCase() : (dados.tipoEvento === 'Reunião' ? 'GOVERNO & GESTÃO' : 'EVENTOS & COMUNIDADE')),
      destaqueFrase: json.destaqueFrase || 'Trabalhando com seriedade e dedicação constante pelo progresso de São José do Goiabal.'
    };
  } catch (error) {
    console.error("Erro ao gerar matéria com IA, usando gerador editorial nativo:", error);
    // Fallback editorial inteligente em caso de indisponibilidade momentânea da chave/API
    const formatData = (dStr: string) => {
      if (!dStr) return '';
      const parts = dStr.split('-');
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
    };

    const dataFormatada = formatData(dados.dataInicio);
    const cat = dados.setor ? dados.setor.toUpperCase() : (dados.tipoEvento === 'Reunião' ? 'GOVERNO & GESTÃO' : dados.tipoEvento === 'Aniversário' ? 'COMUNIDADE & HOMENAGENS' : 'EVENTOS & CIDADANIA');

    // Formatar pessoas com seus respectivos cargos
    let textoPessoas = '';
    if (dados.pessoas && Array.isArray(dados.pessoas) && dados.pessoas.length > 0) {
      const nomesCargos = dados.pessoas.map(p => {
        if (typeof p === 'string') return p;
        return p.role ? `${p.name} (${p.role})` : p.name;
      });
      textoPessoas = `A atividade contou com a participação e coordenação de ${nomesCargos.join(', ')}, integrando os esforços operacionais do setor. `;
    }

    // Menção institucional ao Prefeito ou Secretaria de Administração quando pertinente
    const isGabineteOuGoverno = dados.setor?.toLowerCase().includes('gabinete') || dados.setor?.toLowerCase().includes('governo') || dados.tipoEvento === 'Reunião';
    const isAdministracao = dados.setor?.toLowerCase().includes('administra') || dados.setor?.toLowerCase().includes('fazenda');

    let mencaoInstitucional = '';
    if (isGabineteOuGoverno) {
      mencaoInstitucional = ' O compromisso contou com o direcionamento estratégico do Prefeito Municipal, Ailton Geraldo dos Santos, reforçando as metas de desenvolvimento sustentável da gestão.';
    } else if (isAdministracao) {
      mencaoInstitucional = ' As ações contam com o suporte de planejamento da Secretaria de Administração e Governo, sob a coordenação do Secretário Guilherme Santos, viabilizando o alinhamento técnico do projeto.';
    }

    let fallbackCorpo = `Em contínuo esforço para garantir a excelência nos serviços prestados à população de São José do Goiabal, a administração municipal realizou com êxito o compromisso "${dados.titulo}".\n\n${dados.setor ? `A ação foi coordenada pelo(a) ${dados.setor}. ` : ''}${textoPessoas}${dados.descricao ? `Durante a atividade, foram destacados pontos estratégicos: "${dados.descricao}". ` : ''}A iniciativa visa aprimorar o fluxo de atendimento, fortalecer as políticas públicas e assegurar resultados positivos diretos para os cidadãos do município.${mencaoInstitucional}\n\nNovas etapas e desdobramentos operacionais continuarão sendo acompanhados pelos setores responsáveis, demonstrando a gestão participativa e o compromisso da prefeitura.`;
    if (fallbackCorpo.length > 1185) {
      fallbackCorpo = fallbackCorpo.slice(0, 1185).replace(/\s+\S*$/, '') + '.';
    }

    return {
      manchete: `Avanço e Planejamento: Prefeitura realiza "${dados.titulo}" em benefício do município`,
      subtitulo: `Compromisso institucional realizado em ${dataFormatada} reforça as ações de desenvolvimento e transparência da administração pública.`,
      corpo: fallbackCorpo,
      categoria: cat,
      destaqueFrase: `"Cada ação planejada e executada reflete o nosso compromisso inegociável com o bem-estar e o futuro de São José do Goiabal."`
    };
  }
};
