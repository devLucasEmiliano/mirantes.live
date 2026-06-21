# src/components/integracoes

## Propósito
Cards da tela `/dashboard/integracoes` (spec 009): conexão da conta do GitHub (OAuth por usuário)
e gestão dos projetos do usuário. Ambos são **funcionais** e falam com a API via `fetch`/navegação;
cada usuário opera sobre os **seus** recursos (escopo definido pela página).

## Estrutura
Consumidos por `src/app/dashboard/integracoes/page.tsx`, empilhados (conexão acima, projetos
abaixo). O card de Projetos reusa o `CardShell` de `@/components/configuracoes/profile-cards`;
a conexão é uma barra fina própria. O visual segue o desenho `Yh9ef` de `desing.pen`.

## Arquivos
- **`projects-manager.tsx`** (`"use client"`) — `ProjectsManager` (**movido de
  `components/configuracoes/`**). Exporta também a interface `ProjectListItem` (inclui
  `isPublic: boolean` — visível na home pública `/`, spec 016). Recebe `projects`
  (DTO plano) + `connection` (`{connected, githubLogin}`) por props. Lista projetos (testid
  `project-row`), expande um por vez buscando o log via `GET /api/projects/:id` (commits
  `commit-row`, branches `branch-row`, badge do último run via `deriveRunStatus`). Adiciona via **seletor de repos** (spec 010): conectado → lista `GET /api/github/repos`
  (busca `add-project-search`, opções `add-project-repo-option`, esconde os já adicionados, clique
  → `POST /api/projects {owner,repo}`); **fallback manual** `add-project-owner`/`add-project-repo`
  (+ `isValidRepoSlug`) sempre disponível (direto p/ não-conectado; atrás de "Adicionar
  manualmente" p/ conectado). Campo *Nome* removido do add (nome = repo). 409 → "Esse repositório já
  está cadastrado." Sincroniza
  (`sync-now` → `POST /api/projects/:id/sync`; **409 → "Conecte sua conta do GitHub para
  sincronizar."**, 404/502 com mensagens próprias) e remove (`DELETE`). Após cada mutação:
  `router.refresh()`. Badge por linha derivado de `connection`/`lastPolledAt`: Sem conexão /
  Nunca sincronizado / Conectado. **Configurações do projeto (spec 016):** o painel expandido traz
  o subcomponente interno `ProjectSettings` — renomear (input `project-name-input`) + alternar
  "Público" (switch `project-public-toggle`, `role="switch"`) + botão Salvar (`project-save`),
  que faz `PATCH /api/projects/:id {name, isPublic}` e depois `router.refresh()`. Estado de
  edição por id em `edits` (semeado dos `projects` via `useEffect`), com `savingId` e
  `handleSaveSettings` (404 / erro genérico com mensagens próprias). **Visual (`Yh9ef`):** o cabeçalho do `CardShell` espelha o
  status de conexão num badge (`headerExtra`); a linha do projeto **expandido** ganha barra
  `accent-primary` (texto/ícones em `foreground-inverse`, badge translúcido) e abre um painel
  de detalhe (campo "Repositório GitHub" + `ProjectSettings` + painel "Último commit sincronizado" (cada commit mostra sha + branch padrão) em
  `surface-elevated` + branches/CI). `sync-now`/remover ficam **sempre na linha** (não no painel)
  — o e2e clica `sync-now` sem expandir. A seção de adicionar (seletor + fallback manual) fica no rodapé do card.
- **`github-connection-card.tsx`** (`"use client"`) — `GithubConnectionCard`. Recebe `connection`
  (`{connected, githubLogin}`). Renderiza uma **barra fina** (`bg-surface-card`, sem `CardShell`)
  com o `GithubMark` à esquerda. Desconectado: texto + botão "Conectar GitHub" que navega
  (`window.location.href`) p/ `/api/github/oauth/start` (início do OAuth). Conectado: mostra
  `@githubLogin` + botão "Desconectar" → `DELETE /api/github/connection` e `router.refresh()`.
- **`github-mark.tsx`** — `GithubMark`, ícone da marca do GitHub (octocat) em SVG inline com
  `currentColor`. Existe porque o lucide-react desta versão **removeu os ícones de marca**.
  Puramente presentacional (sem `"use client"`, sem estado); aceita `className` p/ tamanho/cor.

## O que NÃO vai aqui
- **Sem acesso a banco/Prisma** — os cards falam com a API via `fetch`; o Server Component
  (`page.tsx`) é quem busca os dados iniciais na DAL.
- **Sem checagem de autorização** — o gate (`requireUser`) é da página, não dos componentes.
- **Sem token/segredo do GitHub no cliente** — só status (login) e ações; a credencial mora nos
  serviços de `src/lib/github/*` e nos Route Handlers.
- **Sem regra de negócio de sync/OAuth** — aqui só estado de UI + `fetch`/navegação.
