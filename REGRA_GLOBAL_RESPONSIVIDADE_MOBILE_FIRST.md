---
description: Regra global e obrigatória de responsividade, usabilidade e desenvolvimento Mobile First para todas as telas, módulos, submódulos e componentes atuais e futuros do sistema.
---

# REGRA GLOBAL — RESPONSIVIDADE E MOBILE FIRST

Esta regra deve ser considerada **obrigatória e permanente para todos os desenvolvimentos atuais e futuros do sistema**, sendo aplicada automaticamente em qualquer novo módulo, submódulo, rota, página, formulário, modal, tabela, card ou componente, mesmo quando o prompt da funcionalidade não mencionar responsividade.

Todo desenvolvimento deve seguir obrigatoriamente a estratégia **Mobile First**.

A interface deve ser inicialmente projetada e estruturada para dispositivos móveis e posteriormente expandida e aprimorada para tablets, notebooks e desktops.

---

## 1. Breakpoint Global

- Considerar como **modo Mobile todas as telas com largura igual ou inferior a 700px (`≤ 700px`)**.
- Acima de 700px, o layout poderá progressivamente utilizar melhor o espaço horizontal disponível.
- A responsividade não deve depender somente de breakpoints fixos. Os componentes devem possuir comportamento **fluido e adaptativo** conforme o espaço realmente disponível.

---

## 2. Rolagem Horizontal (Proibição Total)

É **terminantemente proibida a existência de rolagem horizontal** na página em qualquer resolução.

Nenhum componente poderá:
- Ultrapassar a largura do viewport;
- Criar `overflow-x` na página;
- Ficar parcialmente escondido ou cortado nas laterais;
- Sair da área visível;
- Provocar deslocamento lateral ou quebra de layout da aplicação.

Textos, campos, tabelas, cards, botões, modais e demais componentes devem se reorganizar e se ajustar automaticamente ao container.

---

## 3. Rolagem Vertical e Ocultação Visual de Scrollbar

Utilizar rolagem vertical **somente quando for estritamente necessária**.

Antes de criar rolagem excessiva, utilizar melhor o espaço disponível através de:
- Grid responsivo;
- Flexbox fluido (`flex-wrap`);
- Colunas adaptativas;
- Abas e Tabs;
- Seções recolhíveis (accordions);
- Cards compactos;
- Distribuição horizontal em telas maiores;
- Reorganização automática em telas menores.

Quando houver rolagem vertical:
- **Ocultar visualmente a barra de rolagem** (ex: classes utilitárias de scrollbar invisível `no-scrollbar` / `scrollbar-none`), mantendo integralmente a navegação por mouse, touch, trackpad, roda de rolagem e teclado.

---

## 4. Viewport e Limites Visíveis

Todo conteúdo deve permanecer rigorosamente dentro do viewport visível.

Nunca permitir:
- Elementos cortados;
- Campos ou labels sobrepostos;
- Textos sobrepostos ou ilegíveis;
- Botões ou links inacessíveis;
- Dropdowns e selects escondidos ou cortados por `overflow`;
- Modais maiores ou fora do viewport;
- Componentes maiores que o viewport;
- Conteúdo vazando horizontalmente.

---

## 5. Formulários Dinâmicos e Adaptativos

Formulários devem se adaptar dinamicamente ao espaço disponível:
- **Mobile (`≤ 700px`):** Priorizar campos em uma única coluna (`grid-cols-1`) com espaçamento confortável para toque (mínimo $44\text{px}$ a $48\text{px}$ de área de toque) para otimizar usabilidade e evitar toques acidentais.
- **Telas Maiores (`> 700px`):** Utilizar duas ou mais colunas (`grid-cols-2`, `grid-cols-3`, `grid-cols-4` ou `col-span-*`) aproveitando a largura disponível com harmonia e organização.
- Campos de busca, filtros rápidos e botões de ação devem se reorganizar em pilha no mobile e em linha em telas maiores.

---

### 🛡️ REGRA DEFINITIVA RESUMIDA:
> **Desenvolvimento Mobile First obrigatório; breakpoint mobile $\le 700\text{px}$; zero rolagem horizontal; rolagem vertical sem barra visível; nenhum elemento fora do viewport; formulários e componentes 100% fluidos e adaptativos.**
