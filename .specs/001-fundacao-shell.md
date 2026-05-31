---
id: 001
title: Fundação — shadcn, tokens de tema e shell (Header, Sidebar, Cards)
status: approved     # draft | approved | tests-red | done
test_levels: []      # sem testes nesta fase (carcaça frontend) — ver §"Desenho dos testes"
created: 2026-05-31
branch: main
---

## Objetivo

Estabelecer, na `main`, a **base compartilhada por todas as páginas** antes de abrir as branches de
tela: instalar shadcn/ui + Lucide, portar os **tokens de tema** do `desing.pen` para o `globals.css`,
e criar os **componentes de shell compartilhados** (Header, Menu Lateral/Sidebar e os cards repetidos)
mais o **layout do dashboard**. Nada de página de conteúdo final aqui — apenas a carcaça reutilizável.

Esta task é pré-requisito das specs 002 (Home), 003 (Metas) e 004 (Dashboard): todas partem da `main`
já com esta fundação mergeada, evitando reinstalar libs e conflitar em `package.json`/`globals.css`/`ui`.

> Carcaça apenas: **sem backend, sem fetch, sem Postgres/Redis/SSE/auth**. Dados só estáticos (mock).

## Pré-leitura obrigatória (CLAUDE.md §3.3)
- `.docs/PRD.md`, `.docs/SPEC.MD` (entidades e telas).
- `desing.pen` via MCP Pencil: `get_variables` (tokens) e `batch_get` do Sidebar `L:PV1ln`,
  Project Switcher `RfrOx` e da Header Bar das telas de dashboard.

## Arquivos a criar/alterar

### Setup de libs
- `npx shadcn@latest init` (Tailwind v4 / CSS variables) → cria `components.json` e `src/lib/utils.ts` (`cn`).
- `npx shadcn@latest add button input textarea select card badge avatar tabs dialog dropdown-menu
  switch checkbox radio-group accordion alert tooltip breadcrumb pagination table progress separator`
  → popula `src/components/ui/*` (ajustar a lista ao que as telas realmente usam).
- `npm i lucide-react`.
- **Não** introduzir libs fora da stack travada (CLAUDE.md §0).

### Tokens → `src/app/globals.css`
Portar as **duas camadas** de variáveis do `desing.pen`:
- **Base shadcn**: `--background --foreground --card --card-foreground --popover --popover-foreground
  --primary --primary-foreground --secondary --secondary-foreground --muted --muted-foreground
  --accent --accent-foreground --destructive --border --input --ring` + conjunto
  `--sidebar --sidebar-foreground --sidebar-primary --sidebar-accent --sidebar-border --sidebar-ring`,
  em `:root` + `.dark`, expostos no bloco `@theme inline` (formato shadcn/Tailwind v4).
- **Paleta própria GuiaGoals** (a usada pelas telas reais): `--accent-primary:#8F5A3C`,
  `--accent-secondary:#C2956A`, `--accent-tertiary:#A38979`,
  `--surface-primary:#E8E9EB --surface-card:#FFFFFF --surface-elevated:#F5F5F6 --surface-inverse:#1A1A1A`,
  `--foreground-primary:#1A1A1A --foreground-muted:#999999 --foreground-inverse:#FFFFFF`,
  `--border-subtle:#E0E0E0`,
  `--status-done:#4A7A5B --status-in-progress:#C2956A --status-overdue:#B54A4A --status-todo:#999999`,
  `--rounded-sm:4px --rounded-full:9999px`. Expor utilitários correspondentes no `@theme inline`.

### Componentes de shell (pedido explícito do humano)
- `src/components/layout/sidebar.tsx` — porta de `L:PV1ln`: header (marca + `chevrons-up-down`),
  lista de itens de navegação (`Sidebar Item/Active|Default`) apontando para as rotas do plano, footer.
- `src/components/layout/project-switcher.tsx` — porta de `RfrOx` (usado no header da sidebar).
- `src/components/layout/header.tsx` — porta da Header Bar das telas de dashboard (título/breadcrumb
  à esquerda; ações/avatar à direita).
- `src/components/shared/stat-card.tsx` — card de métrica/seção repetido (porta de `Card`/`Card Action`/
  `Card Plain`). Outros cards repetidos identificados durante a leitura entram aqui também.
- `src/lib/mock-data.ts` — dados estáticos tipados (metas, eventos, serviços, commits) seguindo as
  entidades do `SPEC.MD`, só para popular a UI. **Sem acesso a banco.**

### Shell de rota (App Router)
- `src/app/dashboard/layout.tsx` — `<Sidebar/>` + `<Header/>` + `{children}`.
- `src/app/dashboard/page.tsx` — **placeholder mínimo** (substituído pela spec 004) só para a rota
  existir e a fundação ser verificável no browser.
- `src/app/layout.tsx` (já existe) — garantir import do `globals.css` e fontes.

### Referências visuais (gabaritos 1:1)
- `export_nodes` das 8 telas (`W0bBr, MoUGA, s4yLg, F7HfnJ, lgTKG, TCjL1, dUhvy, Mrdmq`) em PNG 2x para
  `.design-refs/` e commitar — gabarito para as specs 002–004.

### Documentação (CLAUDE.md §2 — uma DOC.md por pasta tocada)
Criar: `src/DOC.md`, `src/app/DOC.md`, `src/app/dashboard/DOC.md`, `src/components/DOC.md`,
`src/components/ui/DOC.md`, `src/components/layout/DOC.md`, `src/components/shared/DOC.md`, `src/lib/DOC.md`.
Cada um com: Propósito / Estrutura / Arquivos em detalhe / "o que NÃO vai aqui"
(ex.: "sem chamadas a banco/HTTP/Redis; só apresentação e mock estático").

## Mudanças de schema
Nenhuma. Não há banco nesta fase.

## Impacto em PRD/SPEC
Nenhuma contradição. O PRD/SPEC permanecem a fonte de verdade; esta task só cria a casca visual.
As rotas seguem o mapeamento aprovado no plano (`.claude/plans/...purring-creek.md`):
`/` (home pública), `/login`, `/dashboard` (dashboard real) e `/dashboard/{metas,metas/nova,timeline,monitoring,settings}`.

## Desenho dos testes
`test_levels: []` — **sem testes automatizados nesta fase**, por decisão do humano registrada no chat
de planejamento (desvio explícito da CLAUDE.md §5/§6, permitido pela §1). Justificativa: a fundação é
casca visual estática, sem comportamento/dados reais a medir; um teste de "renderiza sem erro" seria
trivial e proibido pela §5.4. Os níveis unit→integração→e2e retornam quando houver lógica/dados reais
(wiring de backend), com infra real conforme §5.3.

## Critérios de pronto (CLAUDE.md §6)
- [ ] shadcn/ui inicializado (`components.json`, `src/lib/utils.ts`) e primitivos em `src/components/ui/*`.
- [ ] `lucide-react` instalado.
- [ ] `globals.css` com as duas camadas de tokens (base shadcn + paleta GuiaGoals).
- [ ] `Sidebar`, `Project Switcher`, `Header` e `stat-card` criados e renderizando no shell `/dashboard`.
- [ ] `src/app/dashboard/layout.tsx` + placeholder `page.tsx` funcionando (`/dashboard` abre no browser).
- [ ] `.design-refs/*.png` exportados (8 telas).
- [ ] `DOC.md` criados em todas as pastas tocadas.
- [ ] Biome (`npx biome check`) sem erros; tipos (`npx tsc --noEmit`) sem erros.
- [ ] Esta spec marcada `done` (atualizada se a implementação divergiu).
