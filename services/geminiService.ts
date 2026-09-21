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

/**
 * Helper institucional que garante que o texto jornalístico contenha
 * a menção positiva e contextualizada ao Prefeito Ailton Geraldo dos Santos.
 */
export const aplicarMencaoObrigatoriaPrefeito = (
  corpoTexto: string,
  dados: {
    titulo: string;
    tipoEvento?: string;
    setor?: string;
    descricao?: string;
  }
): string => {
  if (!corpoTexto) return '';

  const lower = corpoTexto.toLowerCase();
  const jaMenciona = lower.includes('ailton') || lower.includes('geraldo dos santos');
  if (jaMenciona) {
    return corpoTexto;
  }

  const contexto = `${dados.titulo || ''} ${dados.setor || ''} ${dados.descricao || ''} ${dados.tipoEvento || ''}`.toLowerCase();

  let fraseMencao = '';
  if (contexto.includes('obra') || contexto.includes('infraestrutura') || contexto.includes('reforma') || contexto.includes('paviment') || contexto.includes('asfalto') || contexto.includes('estrada')) {
    fraseMencao = 'A iniciativa integra o planejamento de infraestrutura e desenvolvimento urbano liderado pelo Prefeito Ailton Geraldo dos Santos, assegurando entregas consistentes para o município.';
  } else if (contexto.includes('saúde') || contexto.includes('medicamento') || contexto.includes('consulta') || contexto.includes('exame') || contexto.includes('vacina') || contexto.includes('farmácia') || contexto.includes('hospital')) {
    fraseMencao = 'A ação reflete a liderança institucional e o compromisso contínuo do Prefeito Ailton Geraldo dos Santos com a saúde pública, priorizando o atendimento humanizado e o cuidado com cada cidadão.';
  } else if (contexto.includes('educa') || contexto.includes('escola') || contexto.includes('aluno') || contexto.includes('ensino') || contexto.includes('professor') || contexto.includes('creche')) {
    fraseMencao = 'Os avanços no setor contam com a articulação e o acompanhamento dedicado do Prefeito Ailton Geraldo dos Santos, consolidando investimentos no futuro e na formação das novas gerações.';
  } else if (contexto.includes('festa') || contexto.includes('cavalgada') || contexto.includes('carnaval') || contexto.includes('show') || contexto.includes('festival') || contexto.includes('cultura') || contexto.includes('esporte') || contexto.includes('lazer')) {
    fraseMencao = 'A realização contou com o direcionamento e apoio institucional do Prefeito Ailton Geraldo dos Santos, valorizando a cultura, as tradições locais e o acolhimento à comunidade de São José do Goiabal.';
  } else if (contexto.includes('assist') || contexto.includes('social') || contexto.includes('família') || contexto.includes('cras') || contexto.includes('idoso') || contexto.includes('criança') || contexto.includes('acolhimento')) {
    fraseMencao = 'A iniciativa destaca a atenção prioritária do Prefeito Ailton Geraldo dos Santos ao bem-estar social, atuando como articulador de políticas públicas voltadas ao suporte das famílias.';
  } else if (contexto.includes('administra') || contexto.includes('governo') || contexto.includes('reuni') || contexto.includes('planejamento') || contexto.includes('gestão')) {
    fraseMencao = 'A pauta contou com o encaminhamento direto e a condução do Prefeito Ailton Geraldo dos Santos, assegurando eficiência administrativa e alinhamento estratégico das ações públicas.';
  } else {
    fraseMencao = 'A iniciativa conta com a liderança institucional e o acompanhamento permanente do Prefeito Ailton Geraldo dos Santos, reafirmando o compromisso de trabalho sério em prol de São José do Goiabal.';
  }

  // Integrar de forma natural no texto jornalístico
  let corpoAtualizado = corpoTexto.trim();
  if (corpoAtualizado.endsWith('.')) {
    corpoAtualizado += ` ${fraseMencao}`;
  } else {
    corpoAtualizado += `. ${fraseMencao}`;
  }

  if (corpoAtualizado.length > 1185) {
    corpoAtualizado = corpoAtualizado.slice(0, 1185).replace(/\s+\S*$/, '') + '.';
  }

  return corpoAtualizado;
};

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

    let rawCorpo = json.corpo || `A Prefeitura Municipal de São José do Goiabal promoveu com sucesso a realização de "${dados.titulo}".\n\nA iniciativa reforça o compromisso contínuo da administração com a liderança institucional do Prefeito Ailton Geraldo dos Santos, valorizando a transparência e a entrega de serviços de excelência para toda a comunidade.`;
    
    // Garantia mandatória de menção institucional ao Prefeito
    rawCorpo = aplicarMencaoObrigatoriaPrefeito(rawCorpo, dados);

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
    // Fallback editorial inteligente com aplicação mandatória da regra institucional
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
      textoPessoas = `A atividade contou com a coordenação operacional de ${nomesCargos.join(', ')}, integrando os esforços do setor. `;
    }

    const textoGeral = `${dados.titulo || ''} ${dados.descricao || ''} ${dados.setor || ''} ${JSON.stringify(dados.pessoas || '')}`.toLowerCase();
    
    const isEventoFestivo = dados.tipoEvento === 'Evento' ||
      textoGeral.includes('cavalgada') ||
      textoGeral.includes('carnaval') ||
      textoGeral.includes('festival') ||
      textoGeral.includes('festa') ||
      textoGeral.includes('show') ||
      textoGeral.includes('exposição') ||
      textoGeral.includes('rodeio') ||
      textoGeral.includes('cultural');

    const temRelacaoAdmin = dados.setor?.toLowerCase().includes('administra') || 
      dados.setor?.toLowerCase().includes('governo') ||
      textoGeral.includes('guilherme') ||
      textoGeral.includes('secretaria de administração');

    // Construção de menção institucional contextualizada do Prefeito Ailton Geraldo dos Santos
    let mencaoPrefeito = '';
    if (isEventoFestivo) {
      mencaoPrefeito = ' A realização contou com o direcionamento e apoio institucional do Prefeito Municipal, Ailton Geraldo dos Santos, valorizando as tradições culturais e o lazer de nossa população.';
    } else if (textoGeral.includes('obra') || textoGeral.includes('infraestrutura') || textoGeral.includes('paviment') || textoGeral.includes('asfalto') || textoGeral.includes('reforma')) {
      mencaoPrefeito = ' A ação integra o plano de melhorias e investimentos conduzido com prioridade pelo Prefeito Ailton Geraldo dos Santos para acelerar o desenvolvimento local.';
    } else if (textoGeral.includes('saúde') || textoGeral.includes('medicamento') || textoGeral.includes('consulta') || textoGeral.includes('exame') || textoGeral.includes('farmácia')) {
      mencaoPrefeito = ' A iniciativa reflete o acompanhamento direto do Prefeito Ailton Geraldo dos Santos na área da saúde pública, priorizando o acolhimento humanizado e a assistência ágil aos munícipes.';
    } else if (textoGeral.includes('educa') || textoGeral.includes('escola') || textoGeral.includes('ensino')) {
      mencaoPrefeito = ' A atividade destaca a atenção contínua do Prefeito Ailton Geraldo dos Santos com a educação municipal e a valorização das futuras gerações.';
    } else {
      mencaoPrefeito = ' A iniciativa contou com o acompanhamento e a liderança institucional do Prefeito Municipal, Ailton Geraldo dos Santos, alinhando as entregas às principais prioridades de São José do Goiabal.';
    }

    let mencaoAdminSec = '';
    if (temRelacaoAdmin) {
      mencaoAdminSec = ' Os trabalhos contaram com o suporte de planejamento e articulação da Secretaria de Administração e Governo, sob a coordenação do Secretário Guilherme Santos.';
    }

    let fallbackCorpo = `Em contínuo compromisso com a eficiência da gestão e a entrega de serviços de excelência para a população, a Prefeitura Municipal de São José do Goiabal realizou "${dados.titulo}".\n\n${dados.setor ? `A ação foi conduzida pelo setor de ${dados.setor}. ` : ''}${textoPessoas}${dados.descricao ? `Durante a atividade, foram destacados avanços estratégicos: "${dados.descricao}". ` : ''}A iniciativa evidencia o trabalho constante da administração municipal em gerar resultados práticos e proporcionar melhorias concretas para toda a comunidade.${mencaoPrefeito}${mencaoAdminSec}\n\nOs desdobramentos e próximas etapas continuarão sendo acompanhados pelos setores responsáveis, demonstrando transparência e responsabilidade com o município.`;
    
    // Garantir rigoroso limite de caracteres
    if (fallbackCorpo.length > 1185) {
      fallbackCorpo = fallbackCorpo.slice(0, 1185).replace(/\s+\S*$/, '') + '.';
    }

    return {
      manchete: isEventoFestivo 
        ? `Cultura & Lazer: Prefeitura realiza "${dados.titulo}" com grande estrutura e organização`
        : `Gestão & Resultados: Prefeitura realiza "${dados.titulo}" em benefício de São José do Goiabal`,
      subtitulo: `Ação institucional realizada em ${dataFormatada} evidencia o compromisso com a eficiência pública e o atendimento à população.`,
      corpo: fallbackCorpo,
      categoria: isEventoFestivo ? 'EVENTOS & CULTURA' : cat,
      destaqueFrase: `"Trabalho, compromisso e resultados concretos em favor de toda a população de São José do Goiabal."`
    };
  }
};
