import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

describe('Validação da visualização TV do Kanban de Licitações', () => {
  it('Deve conter o arquivo SQL de migração com permissão anon e política RLS de TV', () => {
    const migrationPath = 'supabase/migrations/20261123_licitacao_kanban_view_tv_publica.sql';
    assert.strictEqual(fs.existsSync(migrationPath), true, 'Migration SQL deve existir');
    const content = fs.readFileSync(migrationPath, 'utf8');
    assert.ok(content.includes('GRANT SELECT ON TABLE public.licitacao_processos TO anon'), 'Deve conceder SELECT para anon');
    assert.ok(content.includes('licitacao_processos_select_public_tv'), 'Deve conter a policy pública de TV');
    assert.ok(content.includes('get_licitacao_kanban_tv'), 'Deve conter a RPC com SECURITY DEFINER');
  });

  it('Deve conter o script SQL na raiz para execução manual pelo usuário', () => {
    const sqlPath = 'EXECUTAR_NO_SUPABASE_KANBAN_TV_PUBLICO.sql';
    assert.strictEqual(fs.existsSync(sqlPath), true, 'Script na raiz deve existir');
    const content = fs.readFileSync(sqlPath, 'utf8');
    assert.ok(content.includes('GRANT SELECT ON TABLE public.licitacao_processos TO anon'), 'Deve conter GRANT SELECT anon');
    assert.ok(content.includes('licitacao_itens_select_public_tv'), 'Deve conter política para itens');
  });

  it('O serviço licitacaoService deve ter fallback robusto para a RPC get_licitacao_kanban_tv', () => {
    const servicePath = 'services/licitacaoService.ts';
    const content = fs.readFileSync(servicePath, 'utf8');
    assert.ok(content.includes('get_licitacao_kanban_tv'), 'licitacaoService deve chamar a RPC de TV em caso de erro/modo anônimo');
    assert.ok(content.includes('licitacao_kanban_cached_processes'), 'Deve conter fallback de cache');
    assert.ok(content.includes('licitacao_kanban_tv_processes'), 'Deve conter fallback de organization_settings');
    assert.ok(content.includes('syncTvProcessesToOrganizationSettings'), 'Deve conter sincronização de TV');
  });

  it('O componente LicitacaoKanban deve usar refetchInterval otimizado de 30s na visão TV', () => {
    const kanbanPath = 'components/licitacao/LicitacaoKanban.tsx';
    const content = fs.readFileSync(kanbanPath, 'utf8');
    assert.ok(content.includes('refetchInterval: isViewOnly ? 30 * 1000 : false'), 'Refetch interval deve ser de 30 segundos no modo TV');
  });
});
