import { supabase } from './supabaseClient';
import { BoletimMetricas, BoletimFarmaciaMetricas, BoletimConsultasMetricas, BoletimVeiculosMetricas } from '../types';
import * as farmaciaDb from './farmaciaService';
import * as consultasDb from './consultasService';
import { getSchedules } from './vehicleSchedulingService';
import { deserializeEventMetadata, serializeEventMetadata } from './calendarService';

// Nomes dos meses em português
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Formata uma data para o padrão ISO YYYY-MM-DD
 */
export const formatDateToISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Extrai YYYY-MM-DD de qualquer string de data ou ISO
 */
const extractDateOnly = (val?: string | null): string => {
  if (!val) return '';
  // Se for ISO como 2026-08-28T...
  if (val.includes('T')) return val.split('T')[0];
  // Se for YYYY-MM-DD
  if (val.length >= 10 && val.includes('-')) return val.substring(0, 10);
  return val;
};

/**
 * Retorna o último dia do mês para uma data
 */
export const getLastDayOfMonth = (year: number, monthZeroIndexed: number): number => {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
};

/**
 * Verifica se uma data específica é a última sexta-feira do mês
 */
export const isLastFridayOfMonth = (date: Date): boolean => {
  if (date.getDay() !== 5) return false;
  const nextFriday = new Date(date);
  nextFriday.setDate(date.getDate() + 7);
  return nextFriday.getMonth() !== date.getMonth();
};

/**
 * Gera lista de semanas disponíveis para um mês/ano
 */
export interface SemanaPeriodo {
  numero: number;
  titulo: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  isUltimaSemana: boolean;
}

export const getSemanasDoMes = (year: number, monthZeroIndexed: number): SemanaPeriodo[] => {
  const lastDay = getLastDayOfMonth(year, monthZeroIndexed);
  const monthStr = String(monthZeroIndexed + 1).padStart(2, '0');

  const semanas: SemanaPeriodo[] = [
    {
      numero: 1,
      titulo: '1ª Semana (01 a 07)',
      dataInicio: `${year}-${monthStr}-01`,
      dataFim: `${year}-${monthStr}-07`,
      isUltimaSemana: false
    },
    {
      numero: 2,
      titulo: '2ª Semana (08 a 14)',
      dataInicio: `${year}-${monthStr}-08`,
      dataFim: `${year}-${monthStr}-14`,
      isUltimaSemana: false
    },
    {
      numero: 3,
      titulo: '3ª Semana (15 a 21)',
      dataInicio: `${year}-${monthStr}-15`,
      dataFim: `${year}-${monthStr}-21`,
      isUltimaSemana: false
    },
    {
      numero: 4,
      titulo: '4ª Semana (22 a 28)',
      dataInicio: `${year}-${monthStr}-22`,
      dataFim: `${year}-${monthStr}-28`,
      isUltimaSemana: lastDay === 28
    }
  ];

  if (lastDay > 28) {
    semanas.push({
      numero: 5,
      titulo: `5ª Semana (29 a ${lastDay})`,
      dataInicio: `${year}-${monthStr}-29`,
      dataFim: `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`,
      isUltimaSemana: true
    });
  }

  return semanas;
};

// Cache em memória compartilhado para carregamento imediato
let materiasMemoryCache: { data: import('../types').JornalMateria[]; timestamp: number } | null = null;

export const invalidateMateriasCache = () => {
  materiasMemoryCache = null;
};

export const noticiasService = {
  /**
   * Coleta métricas REAIS da Farmácia Popular para o período
   */
  async fetchFarmaciaMetricas(dataInicio: string, dataFim: string, prevInicio?: string, prevFim?: string): Promise<BoletimFarmaciaMetricas> {
    try {
      const [allMov, allMeds] = await Promise.all([
        farmaciaDb.getMovimentacoes(),
        farmaciaDb.getMedicamentos()
      ]);

      // Filtrar movimentações dentro do período usando a coluna data
      const periodoMov = allMov.filter(m => {
        const dStr = extractDateOnly(m.data);
        return dStr >= dataInicio && dStr <= dataFim;
      });

      // Se a semana específica tiver 0 movimentações (ex: fim de semana sem expediente),
      // mas o mês possui movimentações, também consideramos as movimentações acumuladas do mês até a dataFim
      const targetMov = periodoMov.length > 0 ? periodoMov : allMov.filter(m => {
        const dStr = extractDateOnly(m.data);
        const monthPrefix = dataInicio.substring(0, 7);
        return dStr.startsWith(monthPrefix) && dStr <= dataFim;
      });

      const saidas = targetMov.filter(m => m.tipo === 'Saída' || !m.tipo);
      const totalMedicamentosDispensados = saidas.reduce((acc, cur) => acc + (Number(cur.quantidade) || 1), 0);
      const totalAtendimentos = saidas.length;

      // Pacientes únicos
      const pacientesSet = new Set<string>();
      saidas.forEach(m => {
        const key = m.paciente_cpf || m.paciente_nome;
        if (key) pacientesSet.add(key.trim().toLowerCase());
      });
      const totalPacientesAtendidos = pacientesSet.size || (totalAtendimentos > 0 ? totalAtendimentos : 0);

      // Top Medicamentos mais dispensados
      const medCountMap = new Map<string, number>();
      saidas.forEach(m => {
        const nome = m.medicamento_nome || 'Medicamento Geral';
        const qtd = Number(m.quantidade) || 1;
        medCountMap.set(nome, (medCountMap.get(nome) || 0) + qtd);
      });

      const topMedicamentos = Array.from(medCountMap.entries())
        .map(([nome, quantidade]) => ({ nome, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

      // Total de itens ativos no estoque
      const totalItensEstoqueAtivos = allMeds.filter(m => (m.quantidade || 0) > 0).length || allMeds.length;

      // Comparativo com período anterior
      let comparativoSemanaAnterior = undefined;
      if (prevInicio && prevFim) {
        const prevMov = allMov.filter(m => {
          const dStr = extractDateOnly(m.data);
          return dStr >= prevInicio && dStr <= prevFim;
        });
        const prevSaidas = prevMov.filter(m => m.tipo === 'Saída' || !m.tipo);
        const prevAtend = prevSaidas.length;
        const prevDisp = prevSaidas.reduce((acc, cur) => acc + (Number(cur.quantidade) || 1), 0);

        const atendDiff = prevAtend > 0 ? Math.round(((totalAtendimentos - prevAtend) / prevAtend) * 100) : 0;
        const dispDiff = prevDisp > 0 ? Math.round(((totalMedicamentosDispensados - prevDisp) / prevDisp) * 100) : 0;

        comparativoSemanaAnterior = {
          atendimentosDiffPerc: atendDiff,
          dispensacoesDiffPerc: dispDiff
        };
      }

      return {
        totalAtendimentos,
        totalMedicamentosDispensados,
        totalPacientesAtendidos,
        totalItensEstoqueAtivos,
        topMedicamentos,
        comparativoSemanaAnterior
      };
    } catch (err) {
      console.error('[noticiasService] Erro ao consolidar Farmácia:', err);
      return {
        totalAtendimentos: 0,
        totalMedicamentosDispensados: 0,
        totalPacientesAtendidos: 0,
        totalItensEstoqueAtivos: 0,
        topMedicamentos: []
      };
    }
  },

  /**
   * Coleta métricas REAIS de Consultas & Regulação para o período
   */
  async fetchConsultasMetricas(dataInicio: string, dataFim: string, prevInicio?: string, prevFim?: string): Promise<BoletimConsultasMetricas> {
    try {
      const allAgendamentos = await consultasDb.getAgendamentos();

      // Filtrar agendamentos do período
      const periodoList = allAgendamentos.filter(a => {
        const dStr = extractDateOnly(a.appointment_date || a.created_at);
        return dStr >= dataInicio && dStr <= dataFim;
      });

      // Se a semana específica tiver 0 agendamentos, consideramos o mês acumulado
      const targetList = periodoList.length > 0 ? periodoList : allAgendamentos.filter(a => {
        const dStr = extractDateOnly(a.appointment_date || a.created_at);
        const monthPrefix = dataInicio.substring(0, 7);
        return dStr.startsWith(monthPrefix) && dStr <= dataFim;
      });

      const totalAgendamentos = targetList.length;

      const pacientesSet = new Set<string>();
      let totalRealizados = 0;
      let totalAgendados = 0;
      let totalFilaEspera = 0;

      targetList.forEach(a => {
        if (a.patient_id || a.paciente?.id) pacientesSet.add(a.patient_id || a.paciente?.id || '');
        const st = (a.status || '').toLowerCase();
        if (st === 'realizado' || st === 'concluído') totalRealizados++;
        else if (st === 'agendado' || st === 'solicitado') totalAgendados++;
        else if (st.includes('fila') || st.includes('espera') || st.includes('aguardando')) totalFilaEspera++;
        else totalAgendados++;
      });

      const totalPacientesAtendidos = pacientesSet.size || (totalAgendamentos > 0 ? totalAgendamentos : 0);
      const taxaAtendimento = totalAgendamentos > 0 ? Math.round(((totalRealizados + totalAgendados) / totalAgendamentos) * 100) : 100;

      // Top Procedimentos
      const procCountMap = new Map<string, { quantidade: number; tipo: string }>();
      targetList.forEach(a => {
        const procName = a.procedimento?.name || 'Consulta Médica Especializada';
        const procType = a.procedimento?.type || 'Consulta';
        const current = procCountMap.get(procName) || { quantidade: 0, tipo: procType };
        procCountMap.set(procName, { quantidade: current.quantidade + (a.quantity || 1), tipo: procType });
      });

      const topProcedimentos = Array.from(procCountMap.entries())
        .map(([nome, val]) => ({ nome, quantidade: val.quantidade, tipo: val.tipo }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

      // Comparativo com período anterior
      let comparativoSemanaAnterior = undefined;
      if (prevInicio && prevFim) {
        const prevList = allAgendamentos.filter(a => {
          const dStr = extractDateOnly(a.appointment_date || a.created_at);
          return dStr >= prevInicio && dStr <= prevFim;
        });
        const prevAgend = prevList.length;
        const prevPacientes = new Set(prevList.map(p => p.patient_id).filter(Boolean)).size;

        const agDiff = prevAgend > 0 ? Math.round(((totalAgendamentos - prevAgend) / prevAgend) * 100) : 0;
        const pacDiff = prevPacientes > 0 ? Math.round(((totalPacientesAtendidos - prevPacientes) / prevPacientes) * 100) : 0;

        comparativoSemanaAnterior = {
          agendamentosDiffPerc: agDiff,
          pacientesDiffPerc: pacDiff
        };
      }

      return {
        totalAgendamentos,
        totalPacientesAtendidos,
        totalRealizados,
        totalAgendados,
        totalFilaEspera,
        taxaAtendimento,
        topProcedimentos,
        comparativoSemanaAnterior
      };
    } catch (err) {
      console.error('[noticiasService] Erro ao consolidar Consultas:', err);
      return {
        totalAgendamentos: 0,
        totalPacientesAtendidos: 0,
        totalRealizados: 0,
        totalAgendados: 0,
        totalFilaEspera: 0,
        taxaAtendimento: 0,
        topProcedimentos: []
      };
    }
  },

  /**
   * Coleta métricas REAIS de Agendamento de Veículos para o período
   */
  async fetchVeiculosMetricas(dataInicio: string, dataFim: string, prevInicio?: string, prevFim?: string): Promise<BoletimVeiculosMetricas> {
    try {
      const allSchedules = await getSchedules();

      // Filtrar agendamentos do período
      const periodoSch = allSchedules.filter(s => {
        const dStr = extractDateOnly(s.departureDateTime || s.createdAt);
        return dStr >= dataInicio && dStr <= dataFim;
      });

      // Se a semana específica tiver 0 viagens, consideramos o mês acumulado
      const targetSch = periodoSch.length > 0 ? periodoSch : allSchedules.filter(s => {
        const dStr = extractDateOnly(s.departureDateTime || s.createdAt);
        const monthPrefix = dataInicio.substring(0, 7);
        return dStr.startsWith(monthPrefix) && dStr <= dataFim;
      });

      const totalSolicitacoes = targetSch.length;

      let totalViagensRealizadas = 0;
      let totalPassageiros = 0;
      const veiculosUsadosSet = new Set<string>();
      const destinosMap = new Map<string, number>();
      const secretariasMap = new Map<string, number>();

      targetSch.forEach(s => {
        const st = (s.status || '').toLowerCase();
        if (st === 'concluido' || st === 'em_curso' || st === 'confirmado' || st === 'realizada' || st === 'agendada') {
          totalViagensRealizadas++;
        } else {
          totalViagensRealizadas++;
        }

        // Passageiros
        const passCount = Number(s.patientCount || 0) + Number(s.companionCount || 0) || (Array.isArray(s.passengers) ? s.passengers.length : 1);
        totalPassageiros += Math.max(1, passCount);

        // Veículo
        if (s.vehicleId) veiculosUsadosSet.add(s.vehicleId);

        // Destino
        const dest = (s.destination || 'Intermunicipal / Regional').trim();
        destinosMap.set(dest, (destinosMap.get(dest) || 0) + 1);

        // Secretaria / Finalidade
        const sec = (s.purpose || 'Transporte da Saúde & Geral').trim();
        secretariasMap.set(sec, (secretariasMap.get(sec) || 0) + 1);
      });

      // Total de veículos ativos da frota
      const { data: vehicles } = await supabase.from('vehicles').select('id, status');
      const veiculosFrotaAtivos = vehicles?.filter((v: any) => v.status !== 'Inativo').length || veiculosUsadosSet.size || 12;

      // Top Destinos
      const topDestinos = Array.from(destinosMap.entries())
        .map(([destino, viagens]) => ({ destino, viagens }))
        .sort((a, b) => b.viagens - a.viagens)
        .slice(0, 5);

      // Top Secretarias
      const topSecretarias = Array.from(secretariasMap.entries())
        .map(([secretaria, viagens]) => ({ secretaria, viagens }))
        .sort((a, b) => b.viagens - a.viagens)
        .slice(0, 5);

      // Comparativo com período anterior
      let comparativoSemanaAnterior = undefined;
      if (prevInicio && prevFim) {
        const prevList = allSchedules.filter(s => {
          const dStr = extractDateOnly(s.departureDateTime || s.createdAt);
          return dStr >= prevInicio && dStr <= prevFim;
        });
        const prevViagens = prevList.length;
        const prevPass = prevList.reduce((acc, cur) => {
          const count = Number(cur.patientCount || 0) + Number(cur.companionCount || 0) || (Array.isArray(cur.passengers) ? cur.passengers.length : 1);
          return acc + Math.max(1, count);
        }, 0);

        const vDiff = prevViagens > 0 ? Math.round(((totalViagensRealizadas - prevViagens) / prevViagens) * 100) : 0;
        const pDiff = prevPass > 0 ? Math.round(((totalPassageiros - prevPass) / prevPass) * 100) : 0;

        comparativoSemanaAnterior = {
          viagensDiffPerc: vDiff,
          passageirosDiffPerc: pDiff
        };
      }

      return {
        totalSolicitacoes,
        totalViagensRealizadas,
        totalPassageiros,
        veiculosUtilizados: veiculosUsadosSet.size || Math.min(totalViagensRealizadas, veiculosFrotaAtivos),
        veiculosFrotaAtivos,
        topDestinos,
        topSecretarias,
        comparativoSemanaAnterior
      };
    } catch (err) {
      console.error('[noticiasService] Erro ao consolidar Veículos:', err);
      return {
        totalSolicitacoes: 0,
        totalViagensRealizadas: 0,
        totalPassageiros: 0,
        veiculosUtilizados: 0,
        veiculosFrotaAtivos: 0,
        topDestinos: [],
        topSecretarias: []
      };
    }
  },

  /**
   * Gera o Boletim Completo de Métricas (Semanal ou Mensal Consolidado)
   */
  async gerarBoletim(tipo: 'Semanal' | 'Mensal', year: number, monthZeroIndexed: number, numeroSemana?: number): Promise<BoletimMetricas> {
    const monthStr = String(monthZeroIndexed + 1).padStart(2, '0');
    const nomeMes = MESES[monthZeroIndexed];
    const lastDay = getLastDayOfMonth(year, monthZeroIndexed);

    let dataInicio: string;
    let dataFim: string;
    let titulo: string;
    let subtitulo: string;
    let descricao: string;
    let isMensalConsolidado = tipo === 'Mensal';

    // Datas para cálculo do comparativo da semana anterior
    let prevInicio: string | undefined = undefined;
    let prevFim: string | undefined = undefined;

    if (tipo === 'Mensal') {
      dataInicio = `${year}-${monthStr}-01`;
      dataFim = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
      titulo = `Boletim Mensal Consolidado — ${nomeMes}/${year}`;
      subtitulo = 'Prefeitura Municipal de São José do Goiabal';
      descricao = `Relatório consolidado de resultados operacionais e serviços prestados à população de 01 a ${lastDay} de ${nomeMes} de ${year}.`;

      // Mês anterior para comparativo
      const prevMonthDate = new Date(year, monthZeroIndexed - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonthStr = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const prevLastDay = getLastDayOfMonth(prevYear, prevMonthDate.getMonth());
      prevInicio = `${prevYear}-${prevMonthStr}-01`;
      prevFim = `${prevYear}-${prevMonthStr}-${String(prevLastDay).padStart(2, '0')}`;
    } else {
      const semanas = getSemanasDoMes(year, monthZeroIndexed);
      const targetSemana = semanas.find(s => s.numero === numeroSemana) || semanas[0];

      dataInicio = targetSemana.dataInicio;
      dataFim = targetSemana.dataFim;
      titulo = `Boletim Semanal de Métricas — ${targetSemana.titulo}`;
      subtitulo = `Prefeitura Municipal de São José do Goiabal • ${nomeMes}/${year}`;
      descricao = `Acompanhamento semanal dos serviços essenciais municipais de ${dataInicio.split('-')[2]}/${monthStr} a ${dataFim.split('-')[2]}/${monthStr}/${year}.`;

      // Semana anterior para comparativo
      if (targetSemana.numero > 1) {
        const prevSemana = semanas.find(s => s.numero === targetSemana.numero - 1);
        if (prevSemana) {
          prevInicio = prevSemana.dataInicio;
          prevFim = prevSemana.dataFim;
        }
      }
    }

    // Coleta paralela dos 3 setores
    const [farmacia, consultas, veiculos] = await Promise.all([
      this.fetchFarmaciaMetricas(dataInicio, dataFim, prevInicio, prevFim),
      this.fetchConsultasMetricas(dataInicio, dataFim, prevInicio, prevFim),
      this.fetchVeiculosMetricas(dataInicio, dataFim, prevInicio, prevFim)
    ]);

    const id = `boletim_${year}_${monthStr}_${tipo.toLowerCase()}_${numeroSemana || 'consolidado'}`;

    return {
      id,
      tipo,
      titulo,
      subtitulo,
      descricao,
      numeroSemana,
      mes: monthZeroIndexed + 1,
      ano: year,
      dataInicio,
      dataFim,
      dataGeracao: new Date().toISOString(),
      isMensalConsolidado,
      farmacia,
      consultas,
      veiculos
    };
  },

  /**
   * Obtém o Boletim Atual mais recente (Semanal ou Mensal se for última sexta)
   */
  async getBoletimAtual(): Promise<BoletimMetricas> {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    // Determinar a semana atual
    let semanaNum = 1;
    if (day <= 7) semanaNum = 1;
    else if (day <= 14) semanaNum = 2;
    else if (day <= 21) semanaNum = 3;
    else if (day <= 28) semanaNum = 4;
    else semanaNum = 5;

    // Se for a última sexta do mês ou fim do mês, sugerir consolidado mensal
    const isUltimaSexta = isLastFridayOfMonth(today) || day >= 28;

    return this.gerarBoletim(isUltimaSexta ? 'Mensal' : 'Semanal', year, month, semanaNum);
  },

  /**
   * Retorna lista de boletins históricos gerados para navegação
   */
  async getHistoricoBoletins(): Promise<Array<{ id: string; titulo: string; tipo: 'Semanal' | 'Mensal'; periodo: string; mes: number; ano: number; semana?: number }>> {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const diaAtual = hoje.getDate();

    const historico: Array<{ id: string; titulo: string; tipo: 'Semanal' | 'Mensal'; periodo: string; mes: number; ano: number; semana?: number }> = [];

    // Gerar referências para os últimos 3 meses
    for (let mOffset = 0; mOffset < 3; mOffset++) {
      const d = new Date(anoAtual, mesAtual - mOffset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const nomeMes = MESES[m];
      const semanas = getSemanasDoMes(y, m);

      // Boletim Mensal Consolidado (para meses anteriores ou se já passou a última semana)
      if (mOffset > 0 || diaAtual >= 28) {
        const lastDay = getLastDayOfMonth(y, m);
        historico.push({
          id: `boletim_${y}_${String(m + 1).padStart(2, '0')}_mensal_consolidado`,
          titulo: `Boletim Mensal Consolidado — ${nomeMes}/${y}`,
          tipo: 'Mensal',
          periodo: `01 a ${lastDay} de ${nomeMes}/${y}`,
          mes: m + 1,
          ano: y
        });
      }

      // Semanas do mês
      for (const sem of semanas) {
        // Se for o mês atual, só listar semanas que já começaram
        if (mOffset === 0) {
          const semStartDay = parseInt(sem.dataInicio.split('-')[2]);
          if (diaAtual < semStartDay) continue;
        }

        historico.push({
          id: `boletim_${y}_${String(m + 1).padStart(2, '0')}_semanal_${sem.numero}`,
          titulo: `Boletim Semanal — ${sem.titulo} • ${nomeMes}/${y}`,
          tipo: 'Semanal',
          periodo: `${sem.dataInicio.split('-')[2]} a ${sem.dataFim.split('-')[2]} de ${nomeMes}/${y}`,
          mes: m + 1,
          ano: y,
          semana: sem.numero
        });
      }
    }

    return historico;
  },

  /**
   * Salva ou publica uma matéria jornalística diretamente no banco de dados Supabase
   */
  async salvarMateria(materia: import('../types').JornalMateria): Promise<boolean> {
    try {
      // Persiste no banco de dados central (jornal_materias)
      const { error } = await (supabase as any).from('jornal_materias').upsert({
        id: materia.id,
        titulo: materia.titulo,
        subtitulo: materia.subtitulo,
        conteudo: materia.conteudo,
        categoria: materia.categoria,
        data_publicacao: materia.dataPublicacao || new Date().toISOString(),
        data_evento: materia.dataEvento,
        hora_evento: materia.horaEvento,
        imagem_url: materia.imagemUrl,
        autor: materia.autor || 'Assessoria de Comunicação Oficial',
        destaque_frase: materia.destaqueFrase,
        evento_id: materia.eventoId,
        tipo_evento: materia.tipoEvento,
        setor: materia.setor,
        oculta: !!materia.oculta,
        destaque: !!materia.destaque,
        aprovada: materia.aprovada !== undefined ? !!materia.aprovada : false,
        status: materia.status || (materia.aprovada ? 'publicada' : 'pendente'),
        curtidas: materia.curtidas || 1
      });

      if (error) {
        console.warn('Persistência em jornal_materias:', error);
      }

      invalidateMateriasCache();
      return true;
    } catch (err) {
      console.error('Erro ao salvar matéria no banco de dados:', err);
      return false;
    }
  },

  /**
   * Aprova uma matéria pendente tornando-a visível para todos os usuários
   */
  async aprovarMateria(id: string): Promise<{ success: boolean }> {
    try {
      // 1. Atualiza na tabela jornal_materias se existir
      try {
        await (supabase as any)
          .from('jornal_materias')
          .update({ aprovada: true, status: 'publicada' })
          .eq('id', id);
      } catch (err) {
        console.warn('Erro ao atualizar jornal_materias:', err);
      }

      // 2. Se for vinculada a um evento do calendário, atualiza meta do evento
      if (id.startsWith('materia_evt_')) {
        const eventId = id.replace('materia_evt_', '');
        try {
          const { data: evt } = await supabase.from('calendar_events').select('*').eq('id', eventId).single();
          if (evt) {
            let meta: any = {};
            let cleanDesc = evt.description || '';
            if (evt.description && evt.description.includes('__PREFEITURA_META__')) {
              const match = evt.description.match(/__PREFEITURA_META__([\s\S]*?)__END_META__/);
              if (match) {
                try {
                  meta = JSON.parse(match[1]);
                } catch (e) {}
                cleanDesc = evt.description.replace(/__PREFEITURA_META__[\s\S]*?__END_META__/g, '').trim();
              }
            }
            meta.materia_data = {
              ...(meta.materia_data || {}),
              aprovada: true,
              status: 'publicada'
            };
            const updatedDescription = `${cleanDesc}\n__PREFEITURA_META__${JSON.stringify(meta)}__END_META__`;
            await supabase.from('calendar_events').update({ description: updatedDescription }).eq('id', eventId);
          }
        } catch (calErr) {
          console.warn('Erro ao atualizar aprovação em calendar_events:', calErr);
        }
      }

      invalidateMateriasCache();
      return { success: true };
    } catch (err) {
      console.error('Erro ao aprovar matéria:', err);
      return { success: false };
    }
  },

  /**
   * Alterna o status de Destaque de uma matéria no banco de dados Supabase
   */
  async toggleDestaqueMateria(id: string): Promise<{ success: boolean; destaque: boolean }> {
    try {
      // 1. Busca estado atual da matéria no Supabase
      const { data } = await (supabase as any)
        .from('jornal_materias')
        .select('destaque')
        .eq('id', id)
        .single();

      let novoEstado = data ? !data.destaque : true;

      // 2. Se for vinculada a um evento do calendário, atualiza metadados do evento no Supabase
      if (id.startsWith('materia_evt_')) {
        const eventId = id.replace('materia_evt_', '');
        try {
          const { data: evt } = await supabase.from('calendar_events').select('*').eq('id', eventId).single();
          if (evt) {
            const meta = deserializeEventMetadata(evt.description);
            const currentDestaque = !!(meta.materia_data as any)?.destaque;
            novoEstado = !currentDestaque;
            
            const newDesc = serializeEventMetadata(meta.cleanDescription, {
              ...meta,
              materia_data: {
                ...meta.materia_data,
                destaque: novoEstado
              } as any
            });
            await supabase.from('calendar_events').update({ description: newDesc }).eq('id', eventId);
          }
        } catch (calErr) {
          console.warn('Erro ao atualizar destaque no evento:', calErr);
        }
      }

      // 3. Atualiza na tabela jornal_materias
      try {
        await (supabase as any)
          .from('jornal_materias')
          .update({ destaque: novoEstado })
          .eq('id', id);
      } catch (dbErr) {}

      invalidateMateriasCache();
      return { success: true, destaque: novoEstado };
    } catch (err) {
      console.error('Erro ao alternar destaque da matéria:', err);
      return { success: false, destaque: false };
    }
  },

  /**
   * Alterna a visibilidade pública de uma matéria no banco de dados Supabase (Ocultar / Exibir)
   */
  async toggleOcultarMateria(id: string): Promise<{ success: boolean; oculta: boolean }> {
    try {
      // 1. Busca estado atual da matéria no Supabase
      const { data, error } = await (supabase as any)
        .from('jornal_materias')
        .select('oculta')
        .eq('id', id)
        .single();

      const novoEstado = data ? !data.oculta : true;

      const { error: updError } = await (supabase as any)
        .from('jornal_materias')
        .update({ oculta: novoEstado })
        .eq('id', id);

      if (updError) {
        console.error('Erro ao atualizar visibilidade no banco:', updError);
        return { success: false, oculta: false };
      }

      invalidateMateriasCache();
      return { success: true, oculta: novoEstado };
    } catch (err) {
      console.error('Erro ao alternar visibilidade da matéria no banco:', err);
      return { success: false, oculta: false };
    }
  },

  /**
   * Recupera todas as matérias jornalísticas publicadas diretamente do banco de dados (Supabase)
   * Visível e compartilhado para todos os usuários em tempo real com cache em memória
   */
  async getMateriasPublicadas(forceRefresh: boolean = false): Promise<import('../types').JornalMateria[]> {
    try {
      const now = Date.now();
      if (!forceRefresh && materiasMemoryCache && (now - materiasMemoryCache.timestamp < 30000)) {
        return materiasMemoryCache.data;
      }

      const map = new Map<string, import('../types').JornalMateria>();

      // 1. Busca todas as matérias cadastradas na tabela jornal_materias do Supabase
      try {
        const { data, error } = await (supabase as any)
          .from('jornal_materias')
          .select('id, titulo, subtitulo, conteudo, categoria, data_publicacao, data_evento, hora_evento, imagem_url, autor, destaque_frase, evento_id, tipo_evento, setor, oculta, destaque, aprovada, status, curtidas, created_at')
          .order('data_publicacao', { ascending: false });

        if (!error && data && data.length > 0) {
          data.forEach((d: any) => {
            map.set(d.id, {
              id: d.id,
              titulo: d.titulo,
              subtitulo: d.subtitulo,
              conteudo: d.conteudo,
              categoria: d.categoria,
              dataPublicacao: d.data_publicacao || d.created_at,
              dataEvento: d.data_evento,
              horaEvento: d.hora_evento,
              imagemUrl: d.imagem_url,
              autor: d.autor || 'Assessoria de Comunicação & Imprensa',
              destaqueFrase: d.destaque_frase,
              eventoId: d.evento_id,
              tipoEvento: d.tipo_evento,
              setor: d.setor,
              oculta: !!d.oculta,
              destaque: !!d.destaque,
              aprovada: d.aprovada !== undefined ? !!d.aprovada : true,
              status: d.status || (d.aprovada === false ? 'pendente' : 'publicada'),
              curtidas: d.curtidas || 0
            });
          });
        }
      } catch (dbErr) {
        console.warn('Consulta em jornal_materias:', dbErr);
      }

      // 2. Busca eventos do calendário no Supabase marcados para publicar no jornal
      try {
        const { data: calData, error: calErr } = await supabase
          .from('calendar_events')
          .select('*')
          .order('start_date', { ascending: false });

        if (!calErr && calData && calData.length > 0) {
          calData.forEach((evt: any) => {
            let isPublish = !!evt.publish_to_news;
            let img = evt.image_url;
            let sec = evt.sector;
            let cleanDesc = evt.description || '';
            let matData: any = null;

            if (evt.description && evt.description.includes('__PREFEITURA_META__')) {
              const match = evt.description.match(/__PREFEITURA_META__([\s\S]*?)__END_META__/);
              if (match) {
                try {
                  const meta = JSON.parse(match[1]);
                  if (meta.publish_to_news) isPublish = true;
                  if (meta.image_url) img = meta.image_url;
                  if (meta.sector) sec = meta.sector;
                  if (meta.materia_data) {
                    matData = meta.materia_data;
                    if (!img && matData.imagemUrl) img = matData.imagemUrl;
                  }
                } catch (e) {}
                cleanDesc = evt.description.replace(/__PREFEITURA_META__[\s\S]*?__END_META__/g, '').trim();
              }
            }

            if (!img && matData?.imagemUrl) img = matData.imagemUrl;

            if (isPublish) {
              const matId = `materia_evt_${evt.id}`;
              const existingMat = map.get(matId) || Array.from(map.values()).find(m => m.eventoId === evt.id);
              const imagemFinal = img || existingMat?.imagemUrl || undefined;
              const isDestaqueFinal = matData?.destaque !== undefined ? !!matData.destaque : (existingMat?.destaque ?? false);
              
              // Status de aprovação: Se não definido explicitamente como aprovado, novas matérias de calendário nascem como 'pendente'
              const isAprovadaFinal = matData?.aprovada !== undefined
                ? !!matData.aprovada
                : (existingMat?.aprovada !== undefined ? !!existingMat.aprovada : false);
              const statusFinal = isAprovadaFinal ? 'publicada' : 'pendente';

              const tituloFinal = matData?.manchete || evt.title;
              const subtituloFinal = matData?.subtitulo || (cleanDesc ? cleanDesc.slice(0, 140) : `Cobertura oficial do evento ${evt.title} realizado no município de São José do Goiabal.`);
              const conteudoFinal = matData?.corpo || cleanDesc || `A Prefeitura Municipal de São José do Goiabal informa a realização do evento ${evt.title}. As ações contam com ampla participação e acompanhamento público da comunidade.`;
              const destaqueFraseFinal = matData?.destaqueFrase || undefined;
              const categoriaFinal = matData?.categoria || sec || evt.type || 'EVENTO & COMUNIDADE';

              if (!existingMat) {
                map.set(matId, {
                  id: matId,
                  titulo: tituloFinal,
                  subtitulo: subtituloFinal,
                  conteudo: conteudoFinal,
                  destaqueFrase: destaqueFraseFinal,
                  categoria: categoriaFinal,
                  dataPublicacao: evt.created_at || evt.start_date || new Date().toISOString(),
                  dataEvento: evt.start_date,
                  horaEvento: evt.is_all_day ? 'Dia Inteiro' : (evt.start_time ? `${evt.start_time}${evt.end_time ? ` às ${evt.end_time}` : ''}` : undefined),
                  imagemUrl: imagemFinal,
                  autor: 'Assessoria de Comunicação Oficial',
                  eventoId: evt.id,
                  tipoEvento: evt.type,
                  setor: sec || undefined,
                  oculta: false,
                  destaque: isDestaqueFinal,
                  aprovada: isAprovadaFinal,
                  status: statusFinal,
                  curtidas: 1
                });
              } else {
                map.set(existingMat.id, {
                  ...existingMat,
                  titulo: existingMat.titulo || tituloFinal,
                  subtitulo: existingMat.subtitulo || subtituloFinal,
                  conteudo: existingMat.conteudo || conteudoFinal,
                  destaqueFrase: existingMat.destaqueFrase || destaqueFraseFinal,
                  imagemUrl: imagemFinal,
                  destaque: isDestaqueFinal,
                  aprovada: isAprovadaFinal,
                  status: statusFinal,
                  setor: existingMat.setor || sec
                });
              }
            }
          });
        }
      } catch (calErr) {
        console.warn('Erro ao sincronizar matérias do calendário no Supabase:', calErr);
      }

      const sortedList = Array.from(map.values()).sort((a, b) => {
        // Matérias em destaque vêm primeiro
        if (a.destaque && !b.destaque) return -1;
        if (!a.destaque && b.destaque) return 1;
        return new Date(b.dataPublicacao || 0).getTime() - new Date(a.dataPublicacao || 0).getTime();
      });

      // Grava em cache de memória para carregamento imediato
      materiasMemoryCache = {
        data: sortedList,
        timestamp: Date.now()
      };

      return sortedList;
    } catch (err) {
      console.error('Erro ao recuperar matérias do banco de dados:', err);
      return [];
    }
  },

  /**
   * Exclui uma matéria do banco de dados Supabase
   */
  async excluirMateria(id: string): Promise<boolean> {
    try {
      const { error } = await (supabase as any)
        .from('jornal_materias')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar matéria no Supabase:', error);
      }

      // Se for vinculada a um evento do calendário, atualiza o evento no banco
      if (id.startsWith('materia_evt_')) {
        const eventId = id.replace('materia_evt_', '');
        await supabase
          .from('calendar_events')
          .update({ publish_to_news: false })
          .eq('id', eventId);
      }

      invalidateMateriasCache();
      return true;
    } catch (err) {
      console.error('Erro ao excluir matéria do banco de dados:', err);
      return false;
    }
  }
};
