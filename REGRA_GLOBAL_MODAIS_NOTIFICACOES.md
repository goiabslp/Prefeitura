# REGRA GLOBAL PARA TODOS OS DESENVOLVIMENTOS ATUAIS E FUTUROS DO SISTEMA

Esta regra deve ser considerada **obrigatória e permanente em todo o sistema**, devendo ser aplicada automaticamente em qualquer novo módulo, submódulo, página, componente ou funcionalidade criada, sem necessidade de ser solicitada novamente.

---

## 1. PROIBIÇÃO TOTAL DE ALERTAS E DIÁLOGOS NATIVOS DO NAVEGADOR
O sistema **não deve utilizar notificações, alertas, confirmações ou diálogos nativos do navegador**. É terminantemente proibido utilizar:
- `alert()` / `window.alert()`
- `confirm()` / `window.confirm()`
- `prompt()` / `window.prompt()`
- `Notification API` nativa
- Pop-ups nativos do navegador ou mensagens do sistema operacional.

Toda comunicação visual com o usuário deve utilizar exclusivamente os **componentes internos e globais do próprio sistema**, reutilizando a infraestrutura padrão de:
- Modais Globais
- Toasts / Snackbars
- Confirmações de Ação
- Erros, Avisos e Sucessos
- Loading, Spinners e Barras de Progresso

---

## 2. DESIGN, RESPONSIVIDADE E LIMITES DE TELA
- Todos os modais devem ser **modernos, limpos, bonitos, dinâmicos, intuitivos e totalmente responsivos**, mantendo a identidade visual e padrão estético da aplicação.
- **Nenhum modal poderá ultrapassar os limites visíveis da tela.** O componente deve adaptar automaticamente largura, altura e distribuição das informações ao viewport disponível, considerando desktop, tablet, mobile, orientação da tela, safe areas e teclado virtual.
- Para telas com largura **igual ou inferior a 700px**, aplicar automaticamente o padrão mobile. O modal poderá utilizar praticamente toda a área disponível quando necessário, mantendo margens de segurança e sem criar rolagem horizontal.
- **Nenhuma rolagem horizontal** é permitida em modais ou páginas.

---

## 3. BLOQUEIO DE FUNDO E FOCO
- Enquanto um modal estiver aberto, a página ao fundo deve permanecer **bloqueada para interação e rolagem** (`overflow: hidden` na raiz do documento/body).
- Ao fechar o modal, o usuário deve continuar exatamente na mesma posição da página em que estava.
- Todos os modais devem utilizar animações suaves e rápidas de entrada e saída, além de gerenciamento adequado de foco, navegação por teclado, acessibilidade e `focus trap`.

---

## 4. PRIORIDADE: EVITAR ROLAGEM DENTRO DOS MODAIS
- A prioridade absoluta deve ser **evitar rolagem dentro dos modais**.
- Antes de criar rolagem, reorganizar o conteúdo aproveitando melhor o espaço disponível através de:
  - Grids responsivos
  - Campos lado a lado
  - Abas / Tabs
  - Seções recolhíveis (accordions)
  - Cards compactos
  - Paginação interna e distribuição inteligente das informações.
- Quando o conteúdo realmente não couber no viewport, somente a área interna de conteúdo poderá possuir rolagem vertical.
- **Título, botão de fechar e ações principais (botões de salvar, cancelar, avançar) devem permanecer sempre visíveis e acessíveis (fixos no topo/rodapé do modal).** O usuário nunca poderá precisar rolar a página principal para acessar alguma parte do modal.

---

## 5. DROPDOWNS, SELECTS E ELEMENTOS FLUTUANTES
- Selects, Autocompletes, Dropdowns, Calendários e componentes flutuantes utilizados dentro de modais devem abrir sempre acima dos demais elementos.
- **Nunca poderão ficar escondidos, cortados por `overflow` ou atrás de outros componentes.**
- Quando necessário, utilizar **Portals** e posicionamento inteligente (abrir acima ou abaixo conforme o espaço disponível no viewport).

---

## 6. PADRONIZAÇÃO DE AÇÕES CRÍTICAS E MENSAGENS RÁPIDAS
- Operações críticas (como exclusão, cancelamento, aprovação, reprovação ou ações irreversíveis) devem obrigatoriamente utilizar o **Modal Global de Confirmação**, nunca diálogos nativos.
- Mensagens rápidas (como **“Salvo com sucesso”**, **“Registro atualizado”** ou **“Arquivo enviado”**) devem utilizar Toast/Snackbar interno, sem interromper desnecessariamente o fluxo de trabalho do usuário.

---

## 7. GESTÃO GLOBAL DE CAMADAS E FILA DE OVERLAYS
- O sistema deve possuir gerenciamento global para impedir **modais duplicados, múltiplos overlays ou várias notificações iguais simultaneamente**. Quando necessário, utilizar fila e prioridade de mensagens.
- Os modais devem ser renderizados em uma camada global superior da aplicação com estratégia centralizada de `z-index`, garantindo que Header, Navbar, Cards, Selects ou qualquer outro elemento não sejam exibidos incorretamente sobre eles.

---

## 8. REUTILIZAÇÃO OBRIGATÓRIA
- **Todo novo desenvolvimento deve obrigatoriamente reutilizar esses componentes globais. Não criar sistemas independentes de modal, alerta ou notificação dentro de módulos específicos.**
- Sempre que uma nova funcionalidade exigir alguma comunicação com o usuário, considerar automaticamente esta regra, mesmo que o prompt daquela funcionalidade não mencione modais ou notificações.

---

### 🛡️ REGRA DEFINITIVA RESUMIDA:
> **Nenhum alerta nativo; nenhum modal fora do viewport; nenhuma rolagem horizontal; nenhuma ação principal escondida; nenhum dropdown cortado; nenhuma rolagem da página ao fundo; e toda comunicação visual deve utilizar os componentes globais, responsivos e padronizados do próprio sistema.**
