import { supabase } from './supabaseClient';
import { ConsultaPaciente, ConsultaAgendamento, FarmaciaMovimentacao, AutoSenhaItem } from '../types';
import { getPacienteById, getPacienteByCpf, getEspecialistas } from './consultasService';

export interface IndicadorTempoEspera {
    dataOriginal: string;
    diasCorridos: number;
    diasPausados: number;
    tempoEfetivoFila: number;
    tempoMedioEspecialidade: number;
    classificacao: 'Dentro do prazo' | 'Atenção' | 'Espera prolongada';
    statusAtual: string;
    concluido: boolean;
}

export interface IndicadoresPaciente {
    totalSolicitacoes: number;
    aguardandoVaga: number;
    agendadas: number;
    realizadas: number;
    pausadas: number;
    canceladas: number;
    comPendencias: number;
    tempoMedioEsperaDias: number;
    solicitacaoMaisAntigaPendente: {
        procedimento: string;
        data: string;
        dias: number;
    } | null;
    totalRetiradasMedicamentos: number;
    totalMedicamentosDiferentes: number;
    totalQuantidadeFisicaEntregue: number;
    dataUltimoAtendimento: string | null;
    dataUltimaMovimentacao: string | null;
    medicamentosMaisRetirados: { nome: string; quantidadeFisica: number; retiradas: number }[];
}

export interface ItemLinhaDoTempo {
    id: string;
    tipo: 'solicitacao' | 'agendamento' | 'realizacao' | 'cancelamento' | 'pausa' | 'retomada' | 'medicamento' | 'atendimento_autosenha';
    titulo: string;
    subtitulo: string;
    detalhes?: string;
    dataHora: string;
    badge: string;
    badgeColor: string;
    origem: 'Regulação' | 'Consultas' | 'Farmácia Popular' | 'AutoSenha';
    dadosOriginais?: any;
}

export interface AlertaGestor {
    id: string;
    tipo: 'espera' | 'pausa' | 'cadastro' | 'agendamento' | 'duplicidade' | 'documento';
    titulo: string;
    descricao: string;
    severidade: 'alta' | 'media' | 'baixa';
    acaoLabel?: string;
    dadosVinculados?: any;
}

/**
 * Normaliza CPF ou Cartão SUS para apenas dígitos numéricos
 */
export const normalizarNumeros = (val?: string | null): string => {
    if (!val) return '';
    return val.replace(/\D/g, '').trim();
};

/**
 * Normaliza texto para comparação sequencial sem acentos e minúsculo
 */
export const normalizarTextoBusca = (val?: string | null): string => {
    if (!val) return '';
    return val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

/**
 * Regra estrita de correspondência sequencial de caracteres no nome:
 * Não utiliza contains genérico. O termo pesquisado deve coincidir sequencialmente
 * do início do nome completo ou do início de algum dos prenomes/sobrenomes.
 */
export const correspondeSequencialNome = (nomeCompleto?: string | null, termoBusca?: string | null): boolean => {
    if (!termoBusca || !termoBusca.trim()) return false;
    if (!nomeCompleto) return false;

    const termoNorm = normalizarTextoBusca(termoBusca);
    if (!termoNorm) return false;

    const nomeNorm = normalizarTextoBusca(nomeCompleto);

    // Correspondência sequencial a partir do início do nome completo
    if (nomeNorm.startsWith(termoNorm)) return true;

    // Correspondência sequencial no início de cada palavra componente do nome
    const palavras = nomeNorm.split(/\s+/);
    return palavras.some(palavra => palavra.startsWith(termoNorm));
};

/**
 * Calcula dias corridos entre duas datas
 */
export const calcularDiasEntre = (dataInicioStr?: string | null, dataFimStr?: string | null): number => {
    if (!dataInicioStr) return 0;
    try {
        const inicio = new Date(dataInicioStr);
        if (isNaN(inicio.getTime())) return 0;

        const fim = dataFimStr ? new Date(dataFimStr) : new Date();
        if (isNaN(fim.getTime())) return 0;

        const diffMs = fim.getTime() - inicio.getTime();
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } catch {
        return 0;
    }
};

/**
 * Calcula o tempo de pausa acumulado de uma solicitação
 */
export const calcularDiasPausados = (item: ConsultaAgendamento): number => {
    let totalMs = 0;
    const history = item.pause_history || [];

    // Itera pelo histórico de pausas/retomadas
    for (let i = 0; i < history.length; i++) {
        if (history[i].action === 'pause') {
            const pauseTime = new Date(history[i].timestamp).getTime();
            // Procura a próxima retomada
            let resumeTime = Date.now();
            for (let j = i + 1; j < history.length; j++) {
                if (history[j].action === 'resume') {
                    resumeTime = new Date(history[j].timestamp).getTime();
                    break;
                }
            }
            if (!isNaN(pauseTime) && !isNaN(resumeTime) && resumeTime >= pauseTime) {
                totalMs += (resumeTime - pauseTime);
            }
        }
    }

    // Se estiver atualmente pausado e sem resume
    if (item.is_paused && item.paused_at && history.length === 0) {
        const pauseTime = new Date(item.paused_at).getTime();
        if (!isNaN(pauseTime)) {
            totalMs += Math.max(0, Date.now() - pauseTime);
        }
    }

    return Math.floor(totalMs / (1000 * 60 * 60 * 24));
};

/**
 * Calcula os indicadores de espera inteligentes para uma solicitação
 */
export const calcularIndicadorTempoEspera = (
    item: ConsultaAgendamento,
    tempoMedioEspecialidadeDias = 30
): IndicadorTempoEspera => {
    const dataOriginal = item.solicitation_date || item.created_at || '';
    const statusLower = (item.status || '').toLowerCase();
    const concluido = statusLower.includes('realizad');

    const dataFinal = concluido ? (item.appointment_date || item.created_at) : null;
    const diasCorridos = calcularDiasEntre(dataOriginal, dataFinal);
    const diasPausados = calcularDiasPausados(item);
    const tempoEfetivoFila = Math.max(0, diasCorridos - diasPausados);

    // Classificação discreta e objetiva
    let classificacao: 'Dentro do prazo' | 'Atenção' | 'Espera prolongada' = 'Dentro do prazo';

    if (concluido) {
        if (tempoEfetivoFila > 60) classificacao = 'Espera prolongada';
        else if (tempoEfetivoFila > 30) classificacao = 'Atenção';
        else classificacao = 'Dentro do prazo';
    } else {
        if (tempoEfetivoFila > 60) classificacao = 'Espera prolongada';
        else if (tempoEfetivoFila > 30) classificacao = 'Atenção';
        else classificacao = 'Dentro do prazo';
    }

    return {
        dataOriginal,
        diasCorridos,
        diasPausados,
        tempoEfetivoFila,
        tempoMedioEspecialidade: tempoMedioEspecialidadeDias,
        classificacao,
        statusAtual: item.status || 'Solicitado',
        concluido
    };
};

/**
 * Busca todas as dispensações de medicamentos registradas para o paciente na Farmácia Popular
 */
export const getDispensacoesDoPaciente = async (
    cpf?: string | null,
    nome?: string | null
): Promise<FarmaciaMovimentacao[]> => {
    try {
        const cleanCpf = normalizarNumeros(cpf);
        const nomeNorm = normalizarTextoBusca(nome);

        const MOVIMENTACAO_COLUMNS = 'id, medicamento_id, medicamento_nome, medicamento_categoria, quantidade, tipo, data, responsavel_id, responsavel_nome, paciente_nome, paciente_cpf, lote, validade, observacoes, criado_em, medico_crm, medico_uf, medico_nome, medico_consulta_data';

        let query = supabase
            .from('farmacia_movimentacoes')
            .select(MOVIMENTACAO_COLUMNS)
            .eq('tipo', 'Saída')
            .order('data', { ascending: false });

        if (cleanCpf && cleanCpf.length === 11) {
            const formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9, 11)}`;
            query = query.or(`paciente_cpf.eq.${cleanCpf},paciente_cpf.eq.${formattedCpf}`);
        } else if (nome && nome.trim()) {
            query = query.ilike('paciente_nome', `%${nome.trim()}%`);
        } else {
            return [];
        }

        const { data, error } = await query;
        if (error) throw error;

        const results = (data as FarmaciaMovimentacao[]) || [];

        // Filtro em memória de segurança para garantir exatidão
        return results.filter(m => {
            if (cleanCpf && cleanCpf.length >= 11) {
                const movCpfClean = normalizarNumeros(m.paciente_cpf);
                if (movCpfClean === cleanCpf) return true;
            }
            if (nomeNorm && m.paciente_nome) {
                const movNomeNorm = normalizarTextoBusca(m.paciente_nome);
                if (movNomeNorm === nomeNorm) return true;
            }
            return false;
        });
    } catch (err) {
        console.error('[pacienteHistoricoService] Erro ao buscar dispensações da farmácia:', err);
        return [];
    }
};

/**
 * Busca todo o histórico de solicitações e agendamentos do paciente na Regulação
 */
export const getSolicitacoesDoPaciente = async (pacienteId: string): Promise<ConsultaAgendamento[]> => {
    try {
        const { data, error } = await supabase
            .from('consultas_agendamentos')
            .select(`
                *,
                procedimento:consultas_procedimentos(*),
                responsavel:profiles(name)
            `)
            .eq('patient_id', pacienteId)
            .order('solicitation_date', { ascending: false, nullsFirst: false });

        if (error) throw error;
        return (data as ConsultaAgendamento[]) || [];
    } catch (err) {
        console.error('[pacienteHistoricoService] Erro ao buscar solicitações do paciente:', err);
        return [];
    }
};

/**
 * Calcula os indicadores consolidados do paciente
 */
export const calcularIndicadoresConsolidados = (
    solicitacoes: ConsultaAgendamento[],
    medicamentos: FarmaciaMovimentacao[]
): IndicadoresPaciente => {
    let aguardandoVaga = 0;
    let agendadas = 0;
    let realizadas = 0;
    let pausadas = 0;
    let canceladas = 0;
    let comPendencias = 0;

    let totalDiasEspera = 0;
    let itensComEspera = 0;

    let maisAntiga: { procedimento: string; data: string; dias: number } | null = null;
    let maiorDias = -1;

    let dataUltimoAtendimento: string | null = null;
    let dataUltimaMovimentacao: string | null = null;

    solicitacoes.forEach(s => {
        const st = (s.status || '').toLowerCase();
        const isPaused = s.is_paused || st === 'pausada';

        if (isPaused) {
            pausadas++;
        } else if (st.includes('realizad')) {
            realizadas++;
        } else if (st.includes('agendad')) {
            agendadas++;
        } else if (st.includes('cancel') || st.includes('não')) {
            canceladas++;
        } else {
            // Aguardando vaga / fila de espera
            aguardandoVaga++;
        }

        if (isPaused || st.includes('aguardando data') || (s.priority === 'Urgência' && !st.includes('realizad'))) {
            comPendencias++;
        }

        const dtOriginal = s.solicitation_date || s.created_at;
        const dias = calcularDiasEntre(dtOriginal, s.appointment_date || null);
        totalDiasEspera += dias;
        itensComEspera++;

        // Solicitação mais antiga ainda pendente (aberta)
        const isPendente = !st.includes('realizad') && !st.includes('cancel');
        if (isPendente && dtOriginal) {
            const diasAguardando = calcularDiasEntre(dtOriginal);
            if (diasAguardando > maiorDias) {
                maiorDias = diasAguardando;
                maisAntiga = {
                    procedimento: s.procedimento?.name || 'Procedimento',
                    data: dtOriginal,
                    dias: diasAguardando
                };
            }
        }

        // Data do último atendimento (agendamento ou realização)
        if (s.appointment_date) {
            if (!dataUltimoAtendimento || new Date(s.appointment_date) > new Date(dataUltimoAtendimento)) {
                dataUltimoAtendimento = s.appointment_date;
            }
        }

        // Data da última movimentação
        const dtMov = s.appointment_date || s.solicitation_date || s.created_at;
        if (dtMov) {
            if (!dataUltimaMovimentacao || new Date(dtMov) > new Date(dataUltimaMovimentacao)) {
                dataUltimaMovimentacao = dtMov;
            }
        }
    });

    // Análise de medicamentos
    const medMap: Record<string, { quantidadeFisica: number; retiradas: number }> = {};
    let totalQuantidadeFisica = 0;

    medicamentos.forEach(m => {
        const nome = (m.medicamento_nome || 'Medicamento').trim().toUpperCase();
        const qtd = Number(m.quantidade) || 0;
        totalQuantidadeFisica += qtd;

        if (!medMap[nome]) {
            medMap[nome] = { quantidadeFisica: 0, retiradas: 0 };
        }
        medMap[nome].quantidadeFisica += qtd;
        medMap[nome].retiradas += 1;

        if (m.data) {
            if (!dataUltimaMovimentacao || new Date(m.data) > new Date(dataUltimaMovimentacao)) {
                dataUltimaMovimentacao = m.data;
            }
        }
    });

    const medicamentosMaisRetirados = Object.entries(medMap)
        .map(([nome, dados]) => ({
            nome,
            quantidadeFisica: dados.quantidadeFisica,
            retiradas: dados.retiradas
        }))
        .sort((a, b) => b.retiradas - a.retiradas);

    const tempoMedioEsperaDias = itensComEspera > 0 ? Math.round(totalDiasEspera / itensComEspera) : 0;

    return {
        totalSolicitacoes: solicitacoes.length,
        aguardandoVaga,
        agendadas,
        realizadas,
        pausadas,
        canceladas,
        comPendencias,
        tempoMedioEsperaDias,
        solicitacaoMaisAntigaPendente: maisAntiga,
        totalRetiradasMedicamentos: medicamentos.length,
        totalMedicamentosDiferentes: Object.keys(medMap).length,
        totalQuantidadeFisicaEntregue: totalQuantidadeFisica,
        dataUltimoAtendimento,
        dataUltimaMovimentacao,
        medicamentosMaisRetirados
    };
};

/**
 * Constrói a linha do tempo cronológica unificada de todas as movimentações
 */
export const construirLinhaDoTempo = (
    solicitacoes: ConsultaAgendamento[],
    medicamentos: FarmaciaMovimentacao[],
    atendimentosAutoSenha?: AutoSenhaItem[]
): ItemLinhaDoTempo[] => {
    const itens: ItemLinhaDoTempo[] = [];

    // Adiciona eventos das solicitações
    solicitacoes.forEach(s => {
        const nomeProc = s.procedimento?.name || 'Procedimento';
        const especialidade = s.procedimento?.type || 'Consulta / Exame';

        // 1. Data da solicitação
        if (s.solicitation_date || s.created_at) {
            itens.push({
                id: `solic-${s.id}`,
                tipo: 'solicitacao',
                titulo: `Solicitação: ${nomeProc}`,
                subtitulo: `${especialidade} • Prioridade ${s.priority || 'Normal'}`,
                detalhes: `Solicitado via sistema municipal. Tipo de atendimento: ${s.tipo_atendimento || 'Interno'}.`,
                dataHora: s.solicitation_date || s.created_at || '',
                badge: 'Solicitação Criada',
                badgeColor: 'sky',
                origem: 'Regulação',
                dadosOriginais: s
            });
        }

        // 2. Pausas e Retomadas
        if (s.pause_history && s.pause_history.length > 0) {
            s.pause_history.forEach((ph, idx) => {
                const isPause = ph.action === 'pause';
                itens.push({
                    id: `pause-${s.id}-${idx}`,
                    tipo: isPause ? 'pausa' : 'retomada',
                    titulo: `${isPause ? 'Pausa' : 'Retomada'}: ${nomeProc}`,
                    subtitulo: ph.reason ? `Motivo: ${ph.reason}` : (isPause ? 'Solicitação temporariamente pausada' : 'Fila retomada'),
                    detalhes: ph.user_name ? `Registrado por ${ph.user_name}` : undefined,
                    dataHora: ph.timestamp,
                    badge: isPause ? 'Solicitação Pausada' : 'Solicitação Retomada',
                    badgeColor: isPause ? 'amber' : 'teal',
                    origem: 'Regulação',
                    dadosOriginais: s
                });
            });
        } else if (s.is_paused && s.paused_at) {
            itens.push({
                id: `pause-current-${s.id}`,
                tipo: 'pausa',
                titulo: `Pausa em Aberto: ${nomeProc}`,
                subtitulo: s.pause_reason ? `Motivo: ${s.pause_reason}` : 'Solicitação pausada pelo gestor',
                detalhes: s.paused_by_name ? `Registrado por ${s.paused_by_name}` : undefined,
                dataHora: s.paused_at,
                badge: 'Solicitação Pausada',
                badgeColor: 'amber',
                origem: 'Regulação',
                dadosOriginais: s
            });
        }

        // 3. Agendamento ou Realização
        const st = (s.status || '').toLowerCase();
        if (s.appointment_date) {
            if (st.includes('realizad')) {
                itens.push({
                    id: `realiz-${s.id}`,
                    tipo: 'realizacao',
                    titulo: `Procedimento Realizado: ${nomeProc}`,
                    subtitulo: `Data da realização: ${new Date(s.appointment_date).toLocaleDateString('pt-BR')}`,
                    detalhes: s.prestador ? `Prestador: ${s.prestador}${s.municipio ? ` (${s.municipio})` : ''}` : undefined,
                    dataHora: s.appointment_date,
                    badge: 'Concluído',
                    badgeColor: 'emerald',
                    origem: 'Consultas',
                    dadosOriginais: s
                });
            } else if (st.includes('agendad')) {
                itens.push({
                    id: `agend-${s.id}`,
                    tipo: 'agendamento',
                    titulo: `Consulta Agendada: ${nomeProc}`,
                    subtitulo: `Data marcada: ${new Date(s.appointment_date).toLocaleDateString('pt-BR')} ${s.appointment_time || ''}`,
                    detalhes: s.prestador ? `Local / Prestador: ${s.prestador}` : 'Atendimento confirmado na rede municipal',
                    dataHora: s.appointment_date,
                    badge: 'Agendado',
                    badgeColor: 'indigo',
                    origem: 'Consultas',
                    dadosOriginais: s
                });
            }
        }

        // 4. Cancelamento
        if (st.includes('cancel') || st.includes('não')) {
            itens.push({
                id: `canc-${s.id}`,
                tipo: 'cancelamento',
                titulo: `Solicitação Cancelada: ${nomeProc}`,
                subtitulo: s.cancellation_reason ? `Motivo: ${s.cancellation_reason}` : 'Cancelado no sistema',
                detalhes: s.canceled_by_name ? `Cancelado por ${s.canceled_by_name}` : undefined,
                dataHora: s.canceled_at || s.appointment_date || s.created_at || '',
                badge: 'Cancelado',
                badgeColor: 'rose',
                origem: 'Regulação',
                dadosOriginais: s
            });
        }
    });

    // Adiciona dispensações de medicamentos
    medicamentos.forEach(m => {
        itens.push({
            id: `med-${m.id}`,
            tipo: 'medicamento',
            titulo: `Dispensação de Medicamento: ${m.medicamento_nome}`,
            subtitulo: `${m.quantidade} unidade(s) • Lote: ${m.lote || 'N/I'} • Validade: ${m.validade ? new Date(m.validade).toLocaleDateString('pt-BR') : 'N/I'}`,
            detalhes: m.medico_nome || m.medico_crm ? `Prescritor: ${m.medico_nome || ''} (CRM ${m.medico_crm || ''} ${m.medico_uf || ''})` : `Dispensado por: ${m.responsavel_nome || 'Farmácia'}`,
            dataHora: m.data || m.criado_em || '',
            badge: 'Farmácia Popular',
            badgeColor: 'purple',
            origem: 'Farmácia Popular',
            dadosOriginais: m
        });
    });

    // Adiciona atendimentos do AutoSenha (UPA, PSF 1, PSF 2)
    if (atendimentosAutoSenha && atendimentosAutoSenha.length > 0) {
        atendimentosAutoSenha.forEach(a => {
            const uNome = a.unidade_id === 'upa' ? 'UPA' : a.unidade_id === 'psf1' ? 'PSF 1' : 'PSF 2';
            itens.push({
                id: `autosenha-${a.id}`,
                tipo: 'atendimento_autosenha',
                titulo: `Passagem pela ${uNome} — Senha ${a.numero}`,
                subtitulo: `Prioridade: ${a.prioridade_categoria || a.prioridade_tipo} • Guichê: ${a.guiche || 'Recepção'}`,
                detalhes: `Status: ${a.status}. Atendente: ${a.atendente_nome || 'Recepção'}. Espera até chamada: ${a.wait_time_first_call_seconds ? `${Math.round(a.wait_time_first_call_seconds / 60)} min` : 'Em andamento'}.`,
                dataHora: a.created_at,
                badge: `AutoSenha • ${uNome}`,
                badgeColor: a.unidade_id === 'upa' ? 'rose' : 'emerald',
                origem: 'AutoSenha',
                dadosOriginais: a
            });
        });
    }

    // Ordenação estrita decrescente (mais recente ao mais antigo)
    return itens.sort((a, b) => {
        const timeA = new Date(a.dataHora).getTime() || 0;
        const timeB = new Date(b.dataHora).getTime() || 0;
        return timeB - timeA;
    });
};

/**
 * Gera os alertas administrativos e objetivos para atenção do gestor
 */
export const gerarAlertasGestor = (
    paciente: ConsultaPaciente,
    solicitacoes: ConsultaAgendamento[]
): AlertaGestor[] => {
    const alertas: AlertaGestor[] = [];

    // 1. Cadastros incompletos
    const camposFaltantes: string[] = [];
    if (!paciente.cpf) camposFaltantes.push('CPF');
    if (!paciente.sus_number) camposFaltantes.push('Cartão SUS');
    if (!paciente.phone) camposFaltantes.push('Telefone');
    if (!paciente.birth_date) camposFaltantes.push('Data de Nascimento');
    if (!paciente.neighborhood || !paciente.street) camposFaltantes.push('Endereço Completo');
    if (!paciente.agente_saude) camposFaltantes.push('Agente de Saúde (ACS)');

    if (camposFaltantes.length > 0) {
        alertas.push({
            id: 'alerta-cadastro-incompleto',
            tipo: 'cadastro',
            titulo: 'Cadastro do Paciente com Pendências',
            descricao: `Campos obrigatórios ausentes: ${camposFaltantes.join(', ')}. Isso pode dificultar contatos e encaminhamentos oficiais.`,
            severidade: camposFaltantes.includes('CPF') || camposFaltantes.includes('Cartão SUS') ? 'alta' : 'media',
            acaoLabel: 'Atualizar Cadastro'
        });
    }

    // 2. Solicitações aguardando há mais tempo (> 60 dias)
    solicitacoes.forEach(s => {
        const st = (s.status || '').toLowerCase();
        const isOpen = !st.includes('realizad') && !st.includes('cancel');
        if (isOpen) {
            const dt = s.solicitation_date || s.created_at;
            const dias = calcularDiasEntre(dt);
            if (dias > 60) {
                alertas.push({
                    id: `alerta-espera-${s.id}`,
                    tipo: 'espera',
                    titulo: `Espera Prolongada: ${s.procedimento?.name || 'Procedimento'}`,
                    descricao: `Paciente aguardando há ${dias} dias corridos (solicitado em ${new Date(dt || '').toLocaleDateString('pt-BR')}). Prioridade: ${s.priority || 'Normal'}.`,
                    severidade: 'alta',
                    acaoLabel: 'Ver Solicitação',
                    dadosVinculados: s
                });
            }
        }
    });

    // 3. Solicitações pausadas
    solicitacoes.forEach(s => {
        if (s.is_paused || (s.status || '').toLowerCase() === 'pausada') {
            alertas.push({
                id: `alerta-pausa-${s.id}`,
                tipo: 'pausa',
                titulo: `Solicitação Pausada: ${s.procedimento?.name || 'Procedimento'}`,
                descricao: s.pause_reason ? `Motivo da pausa: "${s.pause_reason}"` : 'A solicitação está pausada na fila aguardando liberação do gestor.',
                severidade: 'media',
                acaoLabel: 'Gerenciar Pausa',
                dadosVinculados: s
            });
        }
    });

    // 4. Próximos agendamentos (nos próximos 7 dias)
    const hoje = new Date();
    solicitacoes.forEach(s => {
        if (s.appointment_date && (s.status || '').toLowerCase() === 'agendado') {
            const dtApp = new Date(s.appointment_date);
            const diffDias = Math.floor((dtApp.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDias >= 0 && diffDias <= 7) {
                alertas.push({
                    id: `alerta-agendamento-proximo-${s.id}`,
                    tipo: 'agendamento',
                    titulo: `Agendamento Próximo: ${s.procedimento?.name || 'Procedimento'}`,
                    descricao: `Agendado para ${dtApp.toLocaleDateString('pt-BR')} ${s.appointment_time ? `às ${s.appointment_time}` : ''}. Faltam ${diffDias === 0 ? 'poucas horas (Hoje)' : `${diffDias} dia(s)`}.`,
                    severidade: 'baixa',
                    acaoLabel: 'Ver Detalhes',
                    dadosVinculados: s
                });
            }
        }
    });

    // 5. Possíveis solicitações duplicadas em aberto
    const procCount: Record<string, number> = {};
    solicitacoes.forEach(s => {
        const st = (s.status || '').toLowerCase();
        if (!st.includes('realizad') && !st.includes('cancel')) {
            const procId = s.procedimento_id || s.procedimento?.name || 'desconhecido';
            procCount[procId] = (procCount[procId] || 0) + 1;
        }
    });

    Object.entries(procCount).forEach(([procId, count]) => {
        if (count > 1) {
            const procNome = solicitacoes.find(s => s.procedimento_id === procId)?.procedimento?.name || 'Procedimento';
            alertas.push({
                id: `alerta-duplicidade-${procId}`,
                tipo: 'duplicidade',
                titulo: `Possível Solicitação Duplicada: ${procNome}`,
                descricao: `Existem ${count} solicitações em aberto para este mesmo procedimento para o paciente. Verifique se não se trata de duplicidade não intencional.`,
                severidade: 'media',
                acaoLabel: 'Conferir Solicitações'
            });
        }
    });

    return alertas;
};
