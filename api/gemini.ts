import { GoogleGenAI, Type } from '@google/genai';

export const config = {
  runtime: 'edge', // Using Edge runtime for fast, scalable execution on Vercel
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { tipo, dados } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Falha de configuração', details: 'A variável de ambiente GEMINI_API_KEY não está configurada no servidor Vercel.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let promptText = '';

    if (tipo === 'justificativa') {
      promptText = `
        Crie uma justificativa institucional, formal, objetiva e administrativa baseada nos seguintes dados de viagem corporativa. 
        O texto deve ser adequado para um documento oficial governamental/público.
        
        DADOS DA VIAGEM:
        - Solicitante: ${dados.requesterName}
        - Cargo: ${dados.cargo}
        - Setor: ${dados.setor}
        - Modalidade: ${dados.modalidade}
        - Destino: ${dados.destino}
        - Data/Hora Saída: ${dados.saida}
        - Data/Hora Retorno: ${dados.retorno}
        - Qtde Hospedagens: ${dados.hospedagens}
        - Distância KM: ${dados.distancia}
        - Forma de Pagamento: ${dados.pagamento}
        - Autorizado por: ${dados.autorizador}
        - Data Atual do Sistema: ${new Date().toLocaleDateString('pt-BR')}
        
        MOTIVO/CONTEXTO FORNECIDO PELO USUÁRIO (OBRIGATÓRIO INCLUIR NA JUSTIFICATIVA):
        """
        ${dados.promptText}
        """
        
        REGRAS:
        1. O texto DEVE possuir de 1 a 2 parágrafos, sem floreios, direto ao ponto. Não crie informações adicionais que não constam nos dados, mas OBRIGATORIAMENTE observe, detalhe e utilize o "MOTIVO/CONTEXTO FORNECIDO PELO USUÁRIO" como base central para explicar o objetivo da viagem.
        2. TEMPO VERBAL: Analise a "Data/Hora Saída" e "Data/Hora Retorno" em relação à "Data Atual do Sistema". 
           - Se a viagem JÁ OCORREU (datas no passado), escreva o texto obrigatoriamente no tempo PASSADO (ex: "viajou", "participou").
           - Se a viagem AINDA VAI OCORRER (datas no futuro), escreva o texto obrigatoriamente no tempo FUTURO ou PRESENTE DO INDICATIVO focado no futuro (ex: "viajará", "participará", "tem como objetivo participar").
        3. FORMATO TEXTUAL: NÃO utilize marcações ou formatações Markdown (não utilize asteriscos ** para negrito, nem hashtags # para títulos, etc). O retorno deve ser exclusivamente em formato de texto simples (plain text).
        4. Tamanho maximo de 300 caracteres. Explorando diretamente sobre o motivo, não sendo necessario repetir dados como data de retorno, deve ser mais objetivo.
        `;
    } else if (tipo === 'detalhamento') {
      const etapa = dados.etapa || 'completo';

      let instrucaoEtapa = '';
      if (etapa === 'introducao') {
        instrucaoEtapa = 'Concentre-se APENAS em escrever a INTRODUÇÃO do documento, contextualizando quem viajou, para onde, quando e o propósito geral (1 a 2 parágrafos). Não escreva o desenvolvimento nem a conclusão.';
      } else if (etapa === 'desenvolvimento') {
        instrucaoEtapa = 'Concentre-se APENAS em escrever o DESENVOLVIMENTO do documento, detalhando as atividades, custos, justificativas técnicas e contexto fornecido pelo usuário. Não escreva introdução nem conclusão.';
      } else if (etapa === 'conclusao') {
        instrucaoEtapa = 'Concentre-se APENAS em escrever a CONCLUSÃO do documento, informando os resultados esperados, benefícios para a instituição e encerramento formal. Não escreva introdução nem desenvolvimento.';
      } else {
        instrucaoEtapa = 'Escreva o detalhamento completo (introdução, desenvolvimento e conclusão).';
      }

      promptText = `
        Crie uma parte de um detalhamento formal, técnico e com linguagem administrativa para um documento público de viagem/despesa, baseado nos seguintes dados.
        
        DADOS DA VIAGEM:
        - Solicitante: ${dados.requesterName}
        - Modalidade: ${dados.modalidade}
        - Destino: ${dados.destino}
        - Justificativa Resumida Atual: ${dados.justificativa}
        - Data Atual do Sistema: ${new Date().toLocaleDateString('pt-BR')}
        - Data/Hora Saída: ${dados.saida}
        - Data/Hora Retorno: ${dados.retorno}
        
        CONTEXTO LIVRE FORNECIDO PELO USUÁRIO (PROMPT):
        """
        ${dados.promptText}
        """
        
        REGRAS:
        1. ${instrucaoEtapa}
        2. Mantenha tom impessoal e formal. Não adicione campos de assinatura nem local/data. O detalhamento DEVE ser formatado com qualidade técnica e explicar claramente a natureza e o objetivo da viagem.
        3. TEMPO VERBAL: Analise a "Data/Hora Saída" e "Data/Hora Retorno" em relação à "Data Atual do Sistema". Se JÁ OCORREU escreva no PASSADO. Se VAI OCORRER escreva no FUTURO.
        4. FORMATO TEXTUAL: NÃO utilize marcações ou formatações Markdown (não utilize asteriscos ** para negrito, nem hashtags # para títulos, etc). O retorno deve ser exclusivamente em formato de texto simples (plain text).
        5. Não é necessario repetir dados como justificativa da viagem, dados pessoais. Apenas faça o detalhamento do co calculo das despesas e sobre o dispositivel legal que embasa o calculo e regras.
     `;
    } else if (tipo === 'lapidar_motivo') {
      promptText = `
        Você é um assistente de IA especialista em redação administrativa para prefeituras e órgãos públicos.
        
        TAREFA:
        Transforme o texto ou transcrição de voz fornecido pelo usuário em uma justificativa pública de viagem formal, clara, objetiva, profissional e perfeitamente redigida em Português do Brasil.
        
        TEXTO/TRANSCRIÇÃO DO USUÁRIO:
        """
        ${dados.promptText}
        """
        
        REGRAS ESSENCIAIS:
        1. O tom da redação deve ser formal, polido e respeitoso, demonstrando interesse público e justificativa administrativa clara.
        2. A justificativa deve ser detalhada, expondo os objetivos e a relevância administrativa do deslocamento para o município.
        3. Preserve todos os fatos, nomes, destinos e objetivos fornecidos pelo usuário, organizando-os de maneira articulada, coerente e polida.
        4. Corrija erros gramaticais, vícios de linguagem, hesitações da fala (como "tipo", "né", "hã") e termos muito informais.
        5. O texto resultante deve possuir no mínimo 50 caracteres. Caso a entrada seja muito curta, enriqueça-a sutilmente com linguagem institucional formal padrão.
        6. NÃO use marcações Markdown (como asteriscos para negrito ou hashtags). Retorne estritamente o texto puro da justificativa administrativa.
      `;
    } else if (tipo === 'documento') {
      promptText = `
        Atue como um redator profissional especializado em documentos corporativos e governamentais.
        
        TAREFA:
        Escreva um documento do tipo "${dados.docType}" sobre o seguinte contexto: "${dados.topic}".
        
        DIRETRIZES:
        - Tom de voz: ${dados.tone}.
        - Idioma: Português do Brasil.
        - O texto deve ser bem estruturado, com introdução, desenvolvimento (pontos chave) e conclusão.
        - NÃO use formatação Markdown complexa (como **negrito** ou # headers). Use apenas quebras de linha para separar parágrafos.
        - Crie um Título Profissional e conciso para este documento baseado no contexto.
      `;
    } else if (tipo === 'materia_jornal') {
      promptText = `
        Você é o Chefe de Redação e Assessor de Imprensa Oficial da Prefeitura Municipal de São José do Goiabal - Minas Gerais.
        
        TAREFA:
        Escreva uma matéria jornalística institucional vibrante, positiva, profissional e de alto impacto para o Jornal da Prefeitura sobre o seguinte compromisso/evento municipal.
        
        DADOS DO EVENTO:
        - Título do Registro: ${dados.titulo}
        - Tipo de Evento: ${dados.tipoEvento || 'Compromisso Municipal'}
        - Setor / Secretaria Responsável: ${dados.setor || 'Gabinete / Administração Geral'}
        - Data Inicial: ${dados.dataInicio}
        - Data Final: ${dados.dataFim || dados.dataInicio}
        - Horário: ${dados.horaInicio ? `${dados.horaInicio} às ${dados.horaFim || ''}` : 'Horário Comercial / Dia Inteiro'}
        - Descrição / Pauta / Contexto:
        """
        ${dados.descricao || 'Ação da administração municipal em prol do desenvolvimento, bem-estar e atendimento à população de São José do Goiabal.'}
        """
        
        DIRETRIZES DA REDAÇÃO:
        1. A matéria deve exaltar o compromisso público, o trabalho sério da administração municipal, a transparência e os benefícios reais para a população de São José do Goiabal.
        2. Crie uma MANCHETE marcante, impactante e profissional no estilo de grande jornal.
        3. Crie um SUBTÍTULO (Lead) que resuma com clareza o objetivo da iniciativa e instigue a leitura.
        4. O CORPO DA MATÉRIA deve possuir de 2 a 3 parágrafos bem articulados, informativos e fluidos.
        5. LIMITE DE TAMANHO DO TEXTO: O texto completo do corpo da matéria (campo 'corpo') deve ter NO MÁXIMO 1185 caracteres (ideal entre 800 e 1185 caracteres). Seja completo e rico em detalhes, mas NUNCA ultrapasse o limite estrito de 1185 caracteres.
        6. Crie uma FRASE DE DESTAQUE inspiradora (aspas institucionais).
        7. Defina a CATEGORIA considerando o Setor informado (ex: 'SAÚDE PÚBLICA', 'EDUCAÇÃO & ENSINO', 'OBRAS & INFRAESTRUTURA', 'MEIO AMBIENTE', 'GOVERNO & GESTÃO', 'EVENTOS & COMUNIDADE').
        8. Destaque a atuação e o compromisso do setor "${dados.setor || 'Administração Municipal'}" ao longo de toda a matéria.
      `;
    } else {
      return new Response(JSON.stringify({ error: 'Tipo de requisição inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let response;
    
    if (tipo === 'documento') {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'The professional and concise title of the document.',
              },
              body: {
                type: Type.STRING,
                description: 'The body text of the document, separated by line breaks.',
              },
            },
            required: ['title', 'body'],
          },
        }
      });
    } else if (tipo === 'materia_jornal') {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              manchete: {
                type: Type.STRING,
                description: 'Manchete principal chamativa e jornalística em estilo de jornal oficial.',
              },
              subtitulo: {
                type: Type.STRING,
                description: 'Subtítulo / Lead explicativo, engajador e positivo.',
              },
              corpo: {
                type: Type.STRING,
                description: 'Corpo completo da matéria jornalística em 2 a 3 parágrafos, informativo e bem estruturado, com no máximo 1185 caracteres.',
              },
              categoria: {
                type: Type.STRING,
                description: 'Categoria temática da notícia em letras maiúsculas.',
              },
              destaqueFrase: {
                type: Type.STRING,
                description: 'Frase de impacto ou aspas institucionais inspiradoras.',
              },
            },
            required: ['manchete', 'subtitulo', 'corpo', 'categoria', 'destaqueFrase'],
          },
        }
      });
    } else {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
      });
    }

    return new Response(JSON.stringify({ text: response.text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Erro na chamada ao Gemini:', error);
    return new Response(JSON.stringify({
      error: 'Falha ao processar a requisição no servidor.',
      details: error?.message || String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
