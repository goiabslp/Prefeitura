# PREFEITURA INTEGRADA — RELATÓRIO TÉCNICO OFICIAL DE AUDITORIA EMERGENCIAL DE SEGURANÇA

**Data da Auditoria:** 04 de Novembro de 2026  
**Ambiente:** Produção e Repositório Central (Vercel / Supabase / GitHub)  
**Classificação:** Confidencial / Administrativo  
**Status da Ação:** Fase de Contenção Concluída — Migração de Banco Pronta para Aplicação  

---

## 1. SUMÁRIO EXECUTIVO

Em atendimento à notificação de possíveis vulnerabilidades de acesso externo não autorizado a dados municipais no sistema **Prefeitura Integrada**, foi conduzida uma auditoria forense aprofundada abrangendo infraestrutura Vercel, banco de dados Supabase, funções serverless, políticas RLS (*Row Level Security*), rotas e empacotamento de frontend (Vite/React).

### Principais Conclusões:
1. **Vulnerabilidade Crítica Remota Confirmada e Contida no Código:** A função de banco `delete_user_admin(uuid)` possuía `SECURITY DEFINER` e permissão explícita `GRANT EXECUTE TO anon`, permitindo que qualquer visitante não autenticado excluísse usuários de `auth.users` e `public.profiles`.
2. **Vazamento Anônimo de Dados Confirmado em Produção:** Devido à omissão da cláusula `TO authenticated` em políticas RLS legadas, o PostgreSQL tratou as políticas como `PUBLIC`, permitindo a raspagem direta sem login de **261 registros de diárias municipais** (`diarias_eventos`), **76 veículos da frota** (`vehicles`) e **47 processos licitatórios** (`licitacao_processos`) contendo dados de servidores e assinaturas digitais.
3. **Endpoint Serverless Aberto na Vercel:** O endpoint `/api/gemini` aceitava requisições sem autenticação de sessão, permitindo consumo indevido da cota municipal de IA.
4. **Vazamento de Código-Fonte em Produção:** `vite.config.ts` estava configurado com `sourcemap: true`, gerando 940 arquivos `.js.map` no diretório de distribuição `dist/assets/`, expondo a estrutura e código TypeScript aos navegadores.
5. **Ações Imediatas de Contenção Realizadas:**
   - Source maps foram **desabilitados** no `vite.config.ts` e 940 arquivos `.map` foram expurgados do build.
   - Endpoint `/api/gemini` foi **blindado** com validação estrita de token Bearer via Supabase Auth.
   - Chamadores no frontend foram atualizados para passar o token de sessão do usuário logado.
   - O segredo sensível `VITE_GOOGLE_CLIENT_SECRET` foi removido do `.env`.
   - Foi gerado o script mestre de correção do banco de dados `EMERGENCY_SECURITY_REMEDIATION.sql` para revogar acessos anônimos e impedir escalonamento de privilégios.

---

## 2. MATRIZ DE VULNERABILIDADES

| ID | Vulnerabilidade | Severidade | Vetor de Ataque | Status |
| :--- | :--- | :--- | :--- | :--- |
| **VULN-01** | Execução Anônima de RPC Destrutiva (`delete_user_admin`) | **CRÍTICA (CVSS 9.8)** | Supabase REST RPC | Corrigido em Script SQL |
| **VULN-02** | Exposição Pública de Diárias e Servidores (`diarias_eventos`) | **ALTA (CVSS 8.6)** | Supabase REST API | Corrigido em Script SQL |
| **VULN-03** | Exposição Pública de Licitações e Assinaturas Digitais | **ALTA (CVSS 8.2)** | Supabase REST API | Corrigido em Script SQL |
| **VULN-04** | Escalonamento Local de Privilégios (LPE) em `profiles` | **ALTA (CVSS 8.5)** | Supabase REST UPDATE | Corrigido via Trigger |
| **VULN-05** | Função Serverless `/api/gemini` sem Autenticação | **MÉDIA (CVSS 7.5)** | Vercel Edge Function | **Corrigido no Código** |
| **VULN-06** | Exposição Pública da Frota Municipal (`vehicles`, `oil_changes`) | **MÉDIA (CVSS 7.1)** | Supabase REST API | Corrigido em Script SQL |
| **VULN-07** | Exposição do Código-Fonte via Source Maps Públicos | **MÉDIA (CVSS 6.5)** | Vercel CDN / Static | **Corrigido no Build** |
| **VULN-08** | Presença de Chave Anônima no Histórico Git | **BAIXA (CVSS 4.3)** | Histórico Git | Mitigado / RLS Strict |
| **VULN-09** | Variável com Segredo em `.env` (`VITE_GOOGLE_CLIENT_SECRET`) | **BAIXA (CVSS 5.0)** | Bundle Frontend | **Corrigido no `.env`** |

---

## 3. FASE 1 — INVESTIGAÇÃO DA VERCEL E FRONTEND

### 3.1. Source Maps em Produção (`vite.config.ts`)
- **Arquivo Afetado:** [vite.config.ts](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/vite.config.ts#L782)
- **Diagnóstico:** A configuração `build: { sourcemap: true }` instruía o Vite a gerar mapas de fonte completos para cada arquivo JavaScript compilado.
- **Evidência Sanitizada:** A pasta `dist/assets` continha **940 arquivos `.js.map`**, somando centenas de megabytes. Qualquer usuário externo requisitando `/assets/index-*.js.map` obtinha os arquivos `.ts` e `.tsx` originais com todos os comentários de código, modelos internos e chamadas de API.
- **Ação Executada:**
  - `sourcemap: false` configurado no `vite.config.ts`.
  - Todos os 940 arquivos `.map` foram apagados de `dist/assets`.
  - O comando `npm run build` foi executado com sucesso: os chunks finais foram emitidos sem nenhum arquivo `.map`.

### 3.2. Endpoint Serverless Edge `/api/gemini.ts`
- **Arquivo Afetado:** [api/gemini.ts](file:///c:/Users/guigu/OneDrive/Área de Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/api/gemini.ts#L10-L40)
- **Diagnóstico:** O manipulador processava requisições `POST` usando a chave privada `GEMINI_API_KEY` do ambiente Vercel sem checar qualquer sessão de usuário.
- **Ação Executada:**
  - Implementado bloqueio `401 Unauthorized` imediato quando o cabeçalho `Authorization: Bearer <token>` está ausente.
  - Implementada validação do token junto ao endpoint de autenticação do Supabase (`/auth/v1/user`). Tokens inválidos ou expirados são rejeitados antes de qualquer invocação da API de inteligência artificial.
  - Atualizados os serviços front-end ([geminiService.ts](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/services/geminiService.ts), [DiariaForm.tsx](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/components/forms/DiariaForm.tsx), [artStudioService.ts](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/services/artStudioService.ts) e [systemAIAssistantService.ts](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/services/systemAIAssistantService.ts)) para anexar o token de sessão ativa via `getAuthHeaders()`.

### 3.3. Segredos em Variáveis de Ambiente e Git
- **Diagnóstico:** O arquivo `.env` continha `VITE_GOOGLE_CLIENT_SECRET = GOCS...`. Qualquer variável com prefixo `VITE_` é suscetível a inclusão no bundle cliente.
- **Evidência no Git:** No commit `8d280a4affaa1555532d16d8e21b35b3ceced469`, o `.env` inicial foi registrado com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- **Ação Executada:**
  - `VITE_GOOGLE_CLIENT_SECRET` foi removido do `.env`.
  - Nenhuma chave de alto privilégio (`service_role`) foi encontrada no histórico git ou na árvore de trabalho.

---

## 4. FASE 2 — AUDITORIA FORENSE DO SUPABASE (BANCO & RLS)

### 4.1. Teste Empírico de Acesso Anônimo (Evidência Real)
Foi executada uma sondagem controlada contra o endpoint do Supabase utilizando estritamente a chave anônima pública (`anon_key`), simulando um ator externo não autenticado:

```text
=== RESULTADOS DA VARREDURA ANÔNIMA EXTERNA ===
[VULNERÁVEL] diarias_eventos    -> 261 registros lidos anonimamente
[VULNERÁVEL] licitacao_processos -> 47 registros lidos anonimamente
[VULNERÁVEL] licitacao_itens     -> 170 registros lidos anonimamente
[VULNERÁVEL] licitacao_assinaturas -> 44 assinaturas digitais com IP expostas
[VULNERÁVEL] vehicles           -> 76 veículos com chassi e renavam expostos
[VULNERÁVEL] vehicle_oil_changes-> 41 registros expostos
[VULNERÁVEL] calendar_events    -> 222 eventos municipais expostos
[VULNERÁVEL] marketing_requests -> 25 solicitações expostas
[VULNERÁVEL] RPC delete_user_admin -> EXECUTÁVEL POR QUALQUER USUÁRIO ANÔNIMO!
```

### 4.2. Causa Raiz da Exposição de Tabelas
No PostgreSQL, ao criar uma política RLS omitindo o parâmetro `TO <role>`:
```sql
-- CÓDIGO VULNERÁVEL IDENTIFICADO NAS MIGRAÇÕES:
CREATE POLICY "Enable read access for authenticated users" 
ON public.diarias_eventos FOR SELECT USING (true);
```
O PostgreSQL atribui a política ao papel padrão **`PUBLIC`**, o que engloba o papel `anon`. Embora o nome da política fizesse menção a "authenticated", a sintaxe não restringia o acesso, permitindo leitura e mutação públicas.

### 4.3. Falha Crítica em `delete_user_admin`
- **Arquivo de Origem:** `supabase/migrations/20260928_fix_delete_user_and_calendar_fkeys.sql` (Linha 119)
- **Código Vulnerável:**
  ```sql
  GRANT EXECUTE ON FUNCTION public.delete_user_admin(uuid) TO anon;
  ```
- **Impacto:** Como a função foi declarada com `SECURITY DEFINER` e operava sem validar `auth.uid()` ou `is_admin()`, qualquer pessoa na internet podia submeter `POST /rest/v1/rpc/delete_user_admin` com o UUID de qualquer administrador e excluí-lo sumariamente da base de dados.

### 4.4. Escalonamento de Privilégios (LPE) em `profiles`
- **Código Vulnerável:**
  ```sql
  CREATE POLICY "Enable update for users based on id" ON public.profiles 
  FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin());
  ```
- **Impacto:** Como não havia verificação de colunas nem trigger no banco, qualquer usuário autenticado comum (ex.: estagiário ou motorista) podia enviar via API `supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)`, tornando-se administrador pleno do sistema municipal.

---

## 5. FASE 3 — AUDITORIA DE ROTAS E ARQUITETURA CLIENT-SIDE

1. **Proteção Client-Side vs. Persistência:**
   - O arquivo [permissionService.ts](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/services/permissionService.ts) e os guards de `App.tsx` filtram corretamente a interface e as rotas visuais (como `/Admin/ControleAcesso`, `/Compras`, `/Regulacao`).
   - Contudo, a segurança **não pode depender exclusivamente da tela**: sem RLS estrito no banco, a omissão de botões na interface não impedia um invasor de realizar requisições REST diretas.
2. **Impersonação (`impersonationService.ts`):**
   - O recurso de impersonação grava o estado no `sessionStorage`.
   - Com o trigger de integridade em `profiles` e as políticas de RLS contendo `auth.uid()`, qualquer tentativa de forjar o `sessionStorage` não autoriza transações no banco de dados, pois o Supabase valida a identidade real através do JWT assinado.

---

## 6. FASE 4 & 5 — CONTENÇÃO, CORREÇÕES E PROTEÇÕES PERMANENTES

### 6.1. Ações Imediatas no Código do Repositório (Concluídas)
1. **[vite.config.ts](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/vite.config.ts):** `sourcemap: false` aplicado; 940 arquivos `.map` expurgados.
2. **[api/gemini.ts](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/api/gemini.ts):** Validação de autenticação de sessão Bearer implementada com bloqueio 401.
3. **[services/geminiService.ts](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/services/geminiService.ts) e componentes:** Injeção automática do cabeçalho de autenticação.
4. **`.env`:** Remoção do segredo privado de cliente OAuth.
5. **Correção de Tipagem Pré-existente:** Corrigidos 5 erros de compilação em `EstoqueScreen.tsx`, `AcompanharScreen.tsx`, `ConsultasReportModal.tsx`, `consultasService.ts` e `farmaciaService.ts`. O projeto agora compila perfeitamente sem erros (`built in 10s`).

### 6.2. Script Mestre de Migração e Blindagem do Banco de Dados
Foi gerado o script [EMERGENCY_SECURITY_REMEDIATION.sql](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/EMERGENCY_SECURITY_REMEDIATION.sql) (também espelhado em `supabase/migrations/20261104_emergency_security_remediation.sql`).

#### O que o script executa:
1. **Revoga** `EXECUTE` da RPC `delete_user_admin` para `anon` e `public`.
2. **Recria** `delete_user_admin` com checagem interna obrigatória de `public.is_admin()`.
3. **Cria** a trigger `protect_profile_privileges` em `public.profiles`, bloqueando em nível de kernel do PostgreSQL qualquer tentativa de alteração de `role` ou `permissions` por usuários comuns.
4. **Habilita RLS e Revoga Acesso Anônimo** nas tabelas: `diarias_eventos`, `vehicles`, `vehicle_oil_changes`, `vehicle_documents`, `licitacao_processos`, `licitacao_itens`, `licitacao_justificativas`, `licitacao_assinaturas`, `licitacao_permissoes`, `marketing_requests`, `marketing_contents`, `calendar_events` e `consultas_procedimentos`.
5. **Aplica** políticas RLS que exigem explicitamente `TO authenticated`, eliminando a herança para `PUBLIC`.

---

## 7. ANÁLISE DE INCIDENTE E CONFORMIDADE COM A LGPD

> [!IMPORTANT]
> **Avaliação de Risco sob a LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018):**
> 1. **Natureza dos Dados Expostos:** A tabela `diarias_eventos` continha 261 registros com nomes de servidores públicos, cargos, setores, datas de deslocamento, itinerários, valores e assinaturas digitais. A tabela `vehicles` continha dados patrimoniais (chassis, renavam e placas).
> 2. **Dados Sensíveis de Saúde (`consultas_pacientes` e `farmacia_medicamentos`):** A sondagem externa confirmou que os dados clínicos de pacientes e medicamentos **não** foram expostos a usuários anônimos (retornaram zero linhas na tentativa de leitura sem autenticação).
> 3. **Recomendação Institucional:**
>    - Acessar o painel Supabase (Dashboard > Database > API Logs / Query Performance) e inspecionar requisições com status 200 para a tabela `diarias_eventos` originadas de endereços IP não municipais nos últimos 30 dias.
>    - Caso seja comprovada a extração em massa por atores externos maliciosos, o Encarregado de Dados (DPO) da Prefeitura Municipal deve ser acionado para avaliar a necessidade de relatório de impacto e eventual notificação à ANPD conforme o art. 48 da LGPD.

---

## 8. INSTRUÇÕES OPERACIONAIS PARA FINALIZAÇÃO

Para que a proteção entre em vigor no banco de dados com zero tempo de inatividade:

1. Acesse o **Console do Supabase** do projeto (`https://supabase.com/dashboard/project/lntphzphyqnscdxyauzj`).
2. Navegue até a aba **SQL Editor**.
3. Abra e cole o conteúdo completo do arquivo [EMERGENCY_SECURITY_REMEDIATION.sql](file:///c:/Users/guigu/OneDrive/Área%20de%20Trabalho/Apps/Projeto-%20Prefeitura-01/Prefeitura-Integrada-DataBase/EMERGENCY_SECURITY_REMEDIATION.sql).
4. Clique em **Run** (Executar).
5. O script emitirá a confirmação:
   `NOTICE: Plano de contenção emergencial de segurança executado com sucesso!`
6. Realize um novo deploy na **Vercel** (`git push`) para que o novo build sem source maps e a API `/api/gemini` protegida sejam ativados.

