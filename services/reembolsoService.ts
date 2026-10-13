import { supabase } from './supabaseClient';
import { formatarMoedaBRL, numeroParaMoedaPorExtenso, somarDespesas, parseMoedaBRL } from '../utils/currencyUtils';

export interface ComprovanteDespesa {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  uploadedAt?: string;
}

export interface DespesaReembolso {
  id: string;
  descricao: string;
  valor: number;
  dataDespesa: string;
  comprovantes: ComprovanteDespesa[];
}

export interface SolicitacaoReembolso {
  id: string;
  protocol: string;
  servidorId: string;
  servidorNome: string;
  servidorCpf: string;
  servidorMatricula?: string;
  servidorCargo: string;
  servidorSetor: string;
  dadosBancarios: {
    banco?: string;
    agencia?: string;
    conta?: string;
    tipoConta?: string;
    pix?: string;
  };
  viagemId?: string;
  destino?: string;
  dataViagemInicio?: string;
  dataViagemFim?: string;
  motivo: string;
  despesas: DespesaReembolso[];
  valorTotal: number;
  valorTotalExtenso: string;
  anexosGerais?: ComprovanteDespesa[];
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'pago';
  createdAt: string;
  updatedAt?: string;
  statusHistory?: any[];
  justificativaRejeicao?: string;
  aprovadoPor?: string;
  aprovadoEm?: string;
}

const LOCAL_STORAGE_KEY = 'prefeitura_reembolsos_cache_v1';

const getLocalCache = (): SolicitacaoReembolso[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setLocalCache = (list: SolicitacaoReembolso[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Erro ao salvar cache de reembolsos:', e);
  }
};

export const getSolicitacoesReembolso = async (): Promise<SolicitacaoReembolso[]> => {
  try {
    // 1. Consulta solicitações com subType reembolso no service_requests
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[reembolsoService] Erro ao buscar service_requests, usando cache:', error.message);
      return getLocalCache();
    }

    const reembolsos: SolicitacaoReembolso[] = [];

    for (const item of (data || [])) {
      const snap = item.document_snapshot || {};
      const c = snap.content || snap || {};
      const isReembolso = c.subType === 'reembolso' || 
                          String(item.protocol || '').startsWith('RMB-') ||
                          String(item.title || '').toLowerCase().includes('reembolso');

      if (!isReembolso) continue;

      const despesasRaw: any[] = Array.isArray(c.despesas) ? c.despesas : [];
      const despesas: DespesaReembolso[] = despesasRaw.map((d: any, idx: number) => ({
        id: d.id || `desp-${idx + 1}`,
        descricao: d.descricao || d.description || 'Despesa sem descrição',
        valor: typeof d.valor === 'number' ? d.valor : parseMoedaBRL(String(d.valor || 0)),
        dataDespesa: d.dataDespesa || d.data || d.date || item.created_at?.split('T')[0] || '',
        comprovantes: Array.isArray(d.comprovantes) ? d.comprovantes : []
      }));

      const valorTotal = somarDespesas(despesas);

      reembolsos.push({
        id: item.id,
        protocol: item.protocol,
        servidorId: c.servidorId || item.user_id || '',
        servidorNome: c.requesterName || c.servidorNome || item.user_name || '',
        servidorCpf: c.servidorCpf || '',
        servidorMatricula: c.servidorMatricula || '',
        servidorCargo: c.requesterRole || c.servidorCargo || '',
        servidorSetor: c.requesterSector || c.servidorSetor || '',
        dadosBancarios: c.dadosBancarios || {
          banco: c.banco,
          agencia: c.agencia,
          conta: c.conta,
          tipoConta: c.tipoConta,
          pix: c.pix
        },
        viagemId: c.viagemId,
        destino: c.destination || c.destino || '',
        dataViagemInicio: c.departureDateTime || c.dataViagemInicio || '',
        dataViagemFim: c.returnDateTime || c.dataViagemFim || '',
        motivo: c.descriptionReason || c.motivo || '',
        despesas,
        valorTotal,
        valorTotalExtenso: c.valorTotalExtenso || numeroParaMoedaPorExtenso(valorTotal),
        anexosGerais: Array.isArray(c.anexosGerais) ? c.anexosGerais : [],
        status: item.status === 'approved' ? 'aprovado' :
                item.status === 'rejected' ? 'rejeitado' :
                item.status === 'completed' ? 'pago' : 'pendente',
        createdAt: item.created_at,
        updatedAt: item.created_at,
        statusHistory: item.status_history || [],
        justificativaRejeicao: c.justificativaRejeicao,
        aprovadoPor: c.aprovadoPor,
        aprovadoEm: c.aprovadoEm
      });
    }

    // Mesclar com cache local se houver itens que ainda não foram sincronizados
    const cached = getLocalCache();
    const map = new Map<string, SolicitacaoReembolso>();
    cached.forEach(r => map.set(r.id, r));
    reembolsos.forEach(r => map.set(r.id, r));

    const finalResult = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    setLocalCache(finalResult);
    return finalResult;
  } catch (err) {
    console.error('[reembolsoService] Erro fatal ao carregar reembolsos:', err);
    return getLocalCache();
  }
};

export const saveSolicitacaoReembolso = async (
  dados: Omit<SolicitacaoReembolso, 'id' | 'protocol' | 'valorTotal' | 'valorTotalExtenso' | 'createdAt'> & {
    id?: string;
    protocol?: string;
  }
): Promise<SolicitacaoReembolso> => {
  // 1. Validação estrita dos lançamentos de despesas (Backend Validation)
  if (!dados.despesas || dados.despesas.length === 0) {
    throw new Error('A solicitação deve conter ao menos uma despesa cadastrada.');
  }

  const despesasValidadas: DespesaReembolso[] = [];
  for (let i = 0; i < dados.despesas.length; i++) {
    const d = dados.despesas[i];
    const desc = (d.descricao || '').trim();
    if (!desc) {
      throw new Error(`A despesa #${i + 1} deve conter uma descrição obrigatória.`);
    }

    const valorNum = typeof d.valor === 'number' ? d.valor : parseMoedaBRL(String(d.valor));
    if (isNaN(valorNum) || valorNum <= 0) {
      throw new Error(`A despesa "${desc}" possui um valor inválido ou zerado (${d.valor}).`);
    }

    // Precisão de 2 casas decimais
    const valorArredondado = Math.round(valorNum * 100) / 100;

    despesasValidadas.push({
      id: d.id || `desp-${Date.now()}-${i}`,
      descricao: desc,
      valor: valorArredondado,
      dataDespesa: d.dataDespesa || new Date().toISOString().split('T')[0],
      comprovantes: Array.isArray(d.comprovantes) ? d.comprovantes : []
    });
  }

  // 2. Cálculo automático do valor total com precisão monetária (centavos)
  const valorTotal = somarDespesas(despesasValidadas);
  if (valorTotal <= 0) {
    throw new Error('O valor total do reembolso solicitado deve ser maior que zero.');
  }

  const valorTotalExtenso = numeroParaMoedaPorExtenso(valorTotal);
  const now = new Date().toISOString();
  const id = dados.id || `rmb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const protocol = dados.protocol || `RMB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const solicitacaoCompleta: SolicitacaoReembolso = {
    ...dados,
    id,
    protocol,
    despesas: despesasValidadas,
    valorTotal,
    valorTotalExtenso,
    status: dados.status || 'pendente',
    createdAt: now,
    updatedAt: now,
    statusHistory: dados.statusHistory || [
      {
        statusLabel: 'Solicitação Criada',
        date: now,
        userName: dados.servidorNome || 'Servidor'
      }
    ]
  };

  // 3. Persistência no Supabase (service_requests com snapshot JSONB)
  const docSnapshot = {
    branding: {
      logoUrl: null,
      primaryColor: '#4f46e5',
      secondaryColor: '#0f172a',
      fontFamily: 'font-sans'
    },
    document: {
      headerText: 'PREFEITURA MUNICIPAL',
      title: 'SOLICITAÇÃO DE REEMBOLSO DE DESPESAS',
      city: '',
      showDate: true
    },
    content: {
      subType: 'reembolso',
      protocol,
      requesterName: dados.servidorNome,
      requesterRole: dados.servidorCargo,
      requesterSector: dados.servidorSetor,
      servidorId: dados.servidorId,
      servidorCpf: dados.servidorCpf,
      servidorMatricula: dados.servidorMatricula,
      dadosBancarios: dados.dadosBancarios,
      destination: dados.destino || 'Viagem a serviço',
      descriptionReason: dados.motivo,
      departureDateTime: dados.dataViagemInicio,
      returnDateTime: dados.dataViagemFim,
      requestedValue: formatarMoedaBRL(valorTotal),
      valorTotal,
      valorTotalExtenso,
      despesas: despesasValidadas,
      anexosGerais: dados.anexosGerais || []
    }
  };

  const dbPayload = {
    id,
    protocol,
    title: `Reembolso de Despesas - ${dados.servidorNome} (${formatarMoedaBRL(valorTotal)})`,
    status: solicitacaoCompleta.status === 'aprovado' ? 'approved' :
            solicitacaoCompleta.status === 'rejeitado' ? 'rejected' :
            solicitacaoCompleta.status === 'pago' ? 'completed' : 'pending',
    payment_status: solicitacaoCompleta.status === 'pago' ? 'paid' : 'pending',
    status_history: solicitacaoCompleta.statusHistory,
    created_at: now,
    user_id: dados.servidorId || null,
    user_name: dados.servidorNome,
    document_snapshot: docSnapshot
  };

  try {
    const { error: upsertErr } = await supabase.from('service_requests').upsert(dbPayload);
    if (upsertErr) {
      console.warn('[reembolsoService] Aviso ao persistir em service_requests:', upsertErr.message);
    }

    // 4. Persistir cada despesa individualmente na tabela `diarias_reembolso_despesas`
    try {
      const despesasRows = despesasValidadas.map(d => ({
        id: d.id.includes('-') && d.id.length === 36 ? d.id : undefined,
        solicitacao_id: id,
        descricao: d.descricao,
        valor: d.valor,
        data_despesa: d.dataDespesa,
        comprovantes: d.comprovantes
      }));

      const { error: despErr } = await supabase
        .from('diarias_reembolso_despesas')
        .insert(despesasRows);

      if (despErr) {
        console.warn('[reembolsoService] Tabela individuais ainda não migrada ou RLS (salvo em snapshot):', despErr.message);
      }
    } catch (e) {
      console.warn('[reembolsoService] Erro ao persistir despesas individuais:', e);
    }
  } catch (err: any) {
    console.error('[reembolsoService] Erro ao gravar solicitação:', err);
  }

  // 5. Atualizar cache local
  const currentCache = getLocalCache();
  const filtered = currentCache.filter(r => r.id !== id);
  const updatedCache = [solicitacaoCompleta, ...filtered];
  setLocalCache(updatedCache);

  // Disparar evento para componentes ouvintes
  window.dispatchEvent(new CustomEvent('reembolso_updated', { detail: { solicitacao: solicitacaoCompleta } }));

  return solicitacaoCompleta;
};

export const updateStatusReembolso = async (
  id: string,
  novoStatus: 'pendente' | 'aprovado' | 'rejeitado' | 'pago',
  justificativa?: string,
  userName: string = 'Administrador'
): Promise<void> => {
  const now = new Date().toISOString();
  const statusLabel = novoStatus === 'aprovado' ? 'Reembolso Aprovado' :
                      novoStatus === 'rejeitado' ? `Reembolso Rejeitado: ${justificativa || ''}` :
                      novoStatus === 'pago' ? 'Reembolso Pago' : 'Reembolso em Análise';

  const movement = {
    statusLabel,
    date: now,
    userName,
    justification: justificativa
  };

  // Buscar registro atual
  const { data: current } = await supabase
    .from('service_requests')
    .select('status_history, document_snapshot')
    .eq('id', id)
    .single();

  const prevHistory = current?.status_history || [];
  const updatedHistory = [...prevHistory, movement];
  const snap = current?.document_snapshot || {};
  const snapContent = snap.content || {};

  const updatedSnap = {
    ...snap,
    content: {
      ...snapContent,
      justificativaRejeicao: novoStatus === 'rejeitado' ? justificativa : undefined,
      aprovadoPor: novoStatus === 'aprovado' ? userName : undefined,
      aprovadoEm: novoStatus === 'aprovado' ? now : undefined
    }
  };

  const dbStatus = novoStatus === 'aprovado' ? 'approved' :
                   novoStatus === 'rejeitado' ? 'rejected' :
                   novoStatus === 'pago' ? 'completed' : 'pending';

  await supabase
    .from('service_requests')
    .update({
      status: dbStatus,
      payment_status: novoStatus === 'pago' ? 'paid' : 'pending',
      status_history: updatedHistory,
      document_snapshot: updatedSnap
    })
    .eq('id', id);

  // Atualizar cache local
  const cached = getLocalCache();
  const updated = cached.map(r => {
    if (r.id === id) {
      return {
        ...r,
        status: novoStatus,
        statusHistory: updatedHistory,
        justificativaRejeicao: novoStatus === 'rejeitado' ? justificativa : undefined,
        aprovadoPor: novoStatus === 'aprovado' ? userName : undefined,
        aprovadoEm: novoStatus === 'aprovado' ? now : undefined
      };
    }
    return r;
  });
  setLocalCache(updated);

  window.dispatchEvent(new CustomEvent('reembolso_updated', { detail: { id, status: novoStatus } }));
};

export const deleteSolicitacaoReembolso = async (id: string): Promise<void> => {
  try {
    await supabase.from('service_requests').delete().eq('id', id);
    try {
      await supabase.from('diarias_reembolso_despesas').delete().eq('solicitacao_id', id);
    } catch {}
  } catch (err) {
    console.warn('[reembolsoService] Erro ao deletar no Supabase:', err);
  }

  const cached = getLocalCache().filter(r => r.id !== id);
  setLocalCache(cached);
  window.dispatchEvent(new CustomEvent('reembolso_updated', { detail: { deletedId: id } }));
};
