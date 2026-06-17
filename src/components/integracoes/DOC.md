# src/components/integracoes

## Propósito
Cards da tela `/dashboard/integracoes` (spec 009): conexão da conta do GitHub (OAuth por usuário)
e gestão dos projetos do usuário. Ambos são **funcionais** e falam com a API via `fetch`/navegação;
cada usuário opera sobre os **seus** recursos (escopo definido pela página).

## Estrutura
Consumidos por `src/app/dashboard/integracoes/page.tsx`, empilhados (conexão acima, projetos
abaixo). Reusam o `CardShell` de `@/components/configuracoes/profile-cards`.

## Arquivos
- **`projects-manager.tsx`** (`"use client"`) — `ProjectsManager` (**movido de
  `components/configuracoes/`**). Exporta também a interface `ProjectListItem`. Recebe `projects`
  (DTO plano) + `connection` (`{connected, githubLogin}`) por props. Lista projetos (testid
  `project-row`), expande um por vez buscando o log via `GET /api/projects/:id` (commits
  `commit-row`, branches `branch-row`, badge do último run via `deriveRunStatus`). Adiciona
  (`add-project-owner`/`add-project-repo` → `POST /api/projects`, valida o slug com
  `isValidRepoSlug` no client antes; 409 → "Esse repositório já está cadastrado."), sincroniza
  (`sync-now` → `POST /api/projects/:id/sync`; **409 → "Conecte sua conta do GitHub para
  sincronizar."**, 404/502 com mensagens próprias) e remove (`DELETE`). Após cada mutação:
  `router.refresh()`. Badge por linha derivado de `connection`/`lastPolledAt`: Sem conexão /
  Nunca sincronizado / Conectado.
- **`github-connection-card.tsx`** (`"use client"`) — `GithubConnectionCard`. Recebe `connection`
  (`{connected, githubLogin}`). Desconectado: texto + botão "Conectar GitHub" que navega
  (`window.location.href`) p/ `/api/github/oauth/start` (início do OAuth). Conectado: mostra
  `@githubLogin` + botão "Desconectar" → `DELETE /api/github/connection` e `router.refresh()`.

## O que NÃO vai aqui
- **Sem acesso a banco/Prisma** — os cards falam com a API via `fetch`; o Server Component
  (`page.tsx`) é quem busca os dados iniciais na DAL.
- **Sem checagem de autorização** — o gate (`requireUser`) é da página, não dos componentes.
- **Sem token/segredo do GitHub no cliente** — só status (login) e ações; a credencial mora nos
  serviços de `src/lib/github/*` e nos Route Handlers.
- **Sem regra de negócio de sync/OAuth** — aqui só estado de UI + `fetch`/navegação.
