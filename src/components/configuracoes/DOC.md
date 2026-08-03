# src/components/configuracoes

## Propósito
Cards da tela `/dashboard/configuracoes`. Perfil e Senha são **funcionais** (spec 007). As
ferramentas da coluna direita (relatórios, uptime, toggles, zona de perigo) seguem visuais/mock.
A gestão de projetos (`ProjectsManager`) **saiu daqui** na spec 009 → vive em
`@/components/integracoes`.

## Estrutura
Consumidos por `src/app/dashboard/configuracoes/page.tsx`: coluna esquerda (conta — Perfil, Senha
e **Equipes**) e coluna direita (ferramentas). `profile-cards.tsx` é compartilhado (reusado também
pelos cards de Integrações). Equipes é uma árvore de 3 arquivos:
`teams-manager.tsx` (estado + fetch) → `team-row.tsx` (uma equipe) → `search-picker.tsx` (busca).

## Arquivos
- **`profile-form.tsx`** (`"use client"`) — `ProfileForm`: edita **nome, email e foto**. Recebe os
  dados iniciais por props (o Server Component os busca). Nome/email → `PATCH /api/account/profile`;
  foto → `PUT`/`DELETE /api/account/avatar` (preview via `<img>` da rota GET, ou iniciais reais de
  `deriveInitials`). Trata 200/400/401/409 e dá `router.refresh()`. Espelha `login-form`.
- **`password-form.tsx`** (`"use client"`) — `PasswordForm`: liga ao `POST /api/auth/password`.
  Valida "nova == confirmar" no client **antes** do request; avisa que as outras sessões caem.
- **`profile-cards.tsx`** (compartilhado, **sem** `"use client"`) — presentacionais: `CardShell`,
  `ReadOnlyField` (exportados). Reusados pelos forms desta pasta **e** pelos cards de
  `@/components/integracoes` (`GithubConnectionCard`/`ProjectsManager`). Não hospeda mais o antigo
  `ProjectCard` (removido na spec 008).
- **`tools-cards.tsx`** (server) — coluna direita: `ReportsCard`, `UptimeMonitoringCard`,
  `ProjectSettingsCard`, `DangerZoneCard`. Ainda **sem handler** (mock).
- **`toggle.tsx`** (`"use client"`) — `Toggle`: switch acessível, sem persistência (mock).
- **`teams-manager.tsx`** (`"use client"`, spec 022; reduzido na spec 023) — `TeamsManagerCard`:
  card de **Equipes** (admin-only), na coluna esquerda abaixo de Alterar Senha. Ficou com o
  `CardShell` + contador, o form "Nova equipe", a mensagem de erro e **todos** os `fetch` de
  `/api/teams/*` (criar/excluir equipe, adicionar/remover membro, atribuir/desatribuir projeto),
  cada um seguido de `router.refresh()`. Delega a linha ao `<TeamRow>`. Expande **uma** equipe por
  vez (`expandedId`). O antigo `busy: boolean` virou `busyKey: string | null`
  (`member:<id>` | `project:<id>` | `team:<id>` | `create`): só a linha clicada mostra `Loader2`,
  o resto do card não congela. Re-exporta os tipos `TeamListItem`/`AssignableUser`/
  `AssignableProject` (definidos em `team-row.tsx`).
- **`team-row.tsx`** (`"use client"`, spec 023) — `TeamRow`: UMA equipe, recolhida (chevron, ícone,
  nome, contadores, lixeira) ou expandida (listas de membros e projetos + os dois pickers). Cada
  picker fica escondido atrás de um link (`+ Adicionar membro` / `+ Atribuir projeto`, vira
  "Cancelar" quando aberto) — a coluna é estreita e um picker sempre aberto deixaria a equipe alta
  demais; só **um** picker aberto por vez. Guarda as duas `query` e aplica `filterUsers`/
  `filterProjects`/`teamNameOf` de `@/lib/teams-filter` antes de passar os itens ao picker.
  Projeto de OUTRA equipe aparece com badge `em {equipe}` (clicar MOVE — comportamento da API).
  **Não faz `fetch`**: recebe handlers por props e, quando eles resolvem `true`, fecha o picker e
  limpa a busca. Exporta os tipos `TeamListItem`/`AssignableUser`/`AssignableProject`.
- **`search-picker.tsx`** (`"use client"`, spec 023) — `SearchPicker<T>`: input com lupa + lista
  rolável (`max-h-64`) onde **1 clique na linha adiciona**, no visual do seletor de repositórios de
  Integrações. Genérico e **controlado**: não sabe o que é usuário/projeto (quem desenha a linha é
  `renderItem`) e não filtra nada (recebe `items` já filtrados) — é isso que mantém a lógica de
  busca em funções puras testáveis. `emptyLabel` vs `noResultsLabel` sai de `query.trim() === ""`.
  `busyKey` marca a linha em andamento com `Loader2` e desabilita as demais; `itemIdAttr` nomeia o
  `data-*` do id (`data-user-id`/`data-project-id`).

## O que NÃO vai aqui
- **`ProjectsManager`** — foi movido para `@/components/integracoes/projects-manager`.
- **Sem acesso a banco/Prisma** — os forms falam com a API via `fetch`; o Server Component
  (`page.tsx`) é quem busca os dados iniciais na DAL.
- **Sem checagem de autorização** — o gate (`requireAdmin`) é da página, não dos componentes.
- **Sem regra de negócio de credenciais** — mora nos serviços de `src/lib/account/*` e nos Route
  Handlers; aqui só estado de UI + fetch.
- **Sem import de `@/lib/teams`** — aquele arquivo puxa `@/lib/db` → `pg`; num Client Component
  isso arrasta o Prisma p/ o bundle do browser (`Module not found: net/tls`). A lógica pura de
  busca vem de `@/lib/teams-filter`; os dados vêm por props do Server Component.
- **Sem `fetch` no `<TeamRow>`/`<SearchPicker>`** — toda chamada de API mora no
  `<TeamsManagerCard>`; os filhos recebem handlers.
- **Sem segredos no cliente.**
