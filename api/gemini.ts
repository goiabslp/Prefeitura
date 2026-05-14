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
      `;
    } else if (tipo === 'detalhamento') {
      promptText = `
        Crie um detalhamento formal, técnico, bem estruturado e com linguagem administrativa para um documento público de viagem/despesa, baseado nos seguintes dados e no prompt fornecido pelo usuário.
        
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
        1. O detalhamento DEVE ser formatado com qualidade técnica e explicar claramente a natureza e o objetivo da viagem baseado primariamente no contexto livre fornecido. Mantenha tom impessoal e formal. Não adicione campos de assinatura nem local/data.
        2. TEMPO VERBAL: Analise a "Data/Hora Saída" e "Data/Hora Retorno" em relação à "Data Atual do Sistema". 
           - Se a viagem JÁ OCORREU (datas no passado), escreva o texto obrigatoriamente no tempo PASSADO.
           - Se a viagem AINDA VAI OCORRER (datas no futuro), escreva o texto obrigatoriamente no tempo FUTURO.
        3. FORMATO TEXTUAL: NÃO utilize marcações ou formatações Markdown (não utilize asteriscos ** para negrito, nem hashtags # para títulos, etc). O retorno deve ser exclusivamente em formato de texto simples (plain text).
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
    } else {
      return new Response(JSON.stringify({ error: 'Tipo de requisição inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let response;
    if (tipo === 'documento') {
      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
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
    } else {
      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
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
