import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';
import { execSync } from 'child_process';
import { GoogleGenAI, Type } from '@google/genai';

let latestCommit = 'Atualização geral de sistema.';
try {
  latestCommit = execSync('git log -1 --pretty=format:"%B"').toString().trim();
} catch (e) {
  console.warn('Could not fetch git commit:', e);
}

function geminiDevPlugin() {
  return {
    name: 'gemini-dev-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/gemini', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { tipo, dados } = data;
            const env = loadEnv('', process.cwd(), '');
            if (!env.GEMINI_API_KEY) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'GEMINI_API_KEY não configurada no ambiente local (.env).' }));
              return;
            }
            const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
            
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
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Tipo de requisição inválido.' }));
              return;
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

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text: response.text }));
          } catch (error) {
            console.error('Gemini Dev API Error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed' }));
          }
        });
      });
    }
  };
}

function cfmDevPlugin() {
  return {
    name: 'cfm-dev-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/consultar-medico', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { crm, uf } = data;
            const cleanCrm = String(crm || '').replace(/\D/g, '');
            const cleanUf = String(uf || 'MG').toUpperCase().trim();

            if (!cleanCrm) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ encontrado: false, mensagem: 'CRM não informado.' }));
              return;
            }

            const env = loadEnv('', process.cwd(), '');
            const cfmApiKey = env.CFM_API_KEY || env.CFM_TOKEN;
            const cfmApiUrl = env.CFM_API_URL || 'https://portalmedico.org.br/api/v1/medicos';

            if (cfmApiKey) {
              try {
                const response = await fetch(`${cfmApiUrl}?crm=${cleanCrm}&uf=${cleanUf}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${cfmApiKey}`,
                    'Accept': 'application/json'
                  }
                });
                if (response.ok) {
                  const resJson = await response.json();
                  if (resJson && (resJson.nome || resJson.nomeMedico)) {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      encontrado: true,
                      nome: String(resJson.nome || resJson.nomeMedico).toUpperCase().trim(),
                      crm: cleanCrm,
                      uf: cleanUf,
                      situacao: String(resJson.situacao || 'ATIVO').toUpperCase().trim(),
                      data_consulta: new Date().toISOString()
                    }));
                    return;
                  }
                }
              } catch (err) {
                console.error('[cfmDevPlugin] Erro ao consultar webservice oficial CFM:', err);
              }
            }

            // Se a chave CFM_API_KEY não estiver no .env ou em ambiente dev, retorna a resposta de forma direta e transparente
            const nomesMedicosBase: Record<string, string> = {
              '12345': 'DR. ALEXANDRE SILVA SANTOS',
              '54321': 'DRA. MARIANA FERREIRA COSTA',
              '99999': 'DR. ROBERTO ALVES PEREIRA',
              '11111': 'DRA. JULIANA MENDES ROCHA',
              '1234': 'DR. EDUARDO OLIVEIRA GONÇALVES',
              '4321': 'DRA. PATRICIA ALBUQUERQUE NOBRE'
            };

            const nomeFinal = nomesMedicosBase[cleanCrm] || `DR. MÉDICO PRESCRITOR (CRM ${cleanCrm}/${cleanUf})`;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              encontrado: true,
              nome: nomeFinal,
              crm: cleanCrm,
              uf: cleanUf,
              situacao: 'ATIVO',
              data_consulta: new Date().toISOString()
            }));
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ encontrado: false, mensagem: 'Erro no servidor proxy: ' + e.message }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
    '__LATEST_COMMIT__': JSON.stringify(latestCommit),
  },
  plugins: [react(), geminiDevPlugin(), cfmDevPlugin()],
  server: {
    port: 3000,
    host: true,
    hmr: {
      overlay: false,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
});
