export interface LicitacaoDocumento {
    id: string;
    processo_id: string;
    nome_documento: string;
    url: string;
    criado_por?: string;
    criado_em?: string;
}

export interface LicitacaoProcesso {
    id: string;
    protocolo: string;
    finalidade: string;
    prioridade: 'Urgente' | 'Normal';
    solicitante_nome: string;
    solicitante_cargo: string;
    solicitante_setor: string;
    status: 'Rascunho' | 'Aguardando Assinatura' | 'Assinado' | 'Em Análise' | 'Concluído' | 'Rejeitado';
    criado_por: string;
    criado_em: string;
    atualizado_em: string;
    fase?: string;
    checkin_finalizado?: any;
    resolucao_descricao?: string;
    resolucao_numero?: string;
    ficha_orcamentaria?: string;
    itens?: LicitacaoItem[];
    justificativa?: LicitacaoJustificativa;
    assinatura?: LicitacaoAssinatura;
    documentos?: LicitacaoDocumento[];
}

export interface LicitacaoItem {
    id: string;
    processo_id: string;
    descricao: string;
    quantidade: number;
    observacoes?: string;
    criado_em?: string;
}

export interface LicitacaoJustificativa {
    id: string;
    processo_id: string;
    texto: string;
    criado_em?: string;
}

export interface LicitacaoAssinatura {
    id: string;
    processo_id: string;
    usuario_id: string;
    data_assinatura: string;
    hash_assinatura: string;
    ip_address?: string;
}

export interface LicitacaoPermissao {
    id: string;
    usuario_id: string;
    tipo_permissao: 'admin' | 'aprovador' | 'comum';
    criado_em?: string;
}
