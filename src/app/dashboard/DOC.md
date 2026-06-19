# src/app/dashboard

## Propósito
Área autenticada do app. O `layout.tsx` é o shell (sidebar + main) **e** o portão de sessão;
as páginas/subrotas são as telas do produto. Só acessível com sessão válida (proxy + DAL).

## Estrutura
- `layout.tsx` — shell + guarda de sessão (DAL).
- `page.tsx` — Visão Geral (cards de metas/resumo + Atividade Recente reais; só uptime mock).
- `timeline/` — feed real de eventos (spec 012); `metas/`, `monitoramento/` — telas do produto
  (mock por enquanto).
- `integracoes/` — conexão do GitHub + gestão de projetos, aberta a admin+cliente. Ver
  `integracoes/DOC.md`.
- `configuracoes/` — área exclusiva do admin. Ver `configuracoes/DOC.md`.

## Arquivos
- **`layout.tsx`** (Server Component, `async`) — resolve o usuário via `getCurrentUser()`
  (DAL, verificação real no banco); sem sessão → `redirect('/login')`. Faz uma query leve
  extra (`name` + `avatar.updatedAt`, **sem** o blob) e passa `{email, role, name, hasAvatar,
  avatarVersion}` ao `Sidebar` p/ o chip de perfil. O `proxy.ts` faz só o gate ótimista por
  assinatura — a checagem autoritativa é aqui.
- **`page.tsx`** (Server Component, `async`) — Visão Geral. **Reais (spec 008/012/013/014),
  escopados por papel e filtrados pelo projeto selecionado:** resolve `scope =
  scopeForUser(await requireUser())` + `selected = await resolveSelectedProject(scope)` (cookie;
  fallback = mais antigo) e usa `projectId = selected?.id` p/ filtrar (cliente só os seus; admin
  todos). **Metas e resumo (spec 014):** `derived = listGoals(scope, projectId)` → `summary =
  summarizeGoals(derived)` alimenta os cards "Progresso Total" (`totalProgress`), "Metas
  Concluídas" (`done`/`total`, barra guardando `total===0`), "Em Andamento" (`inProgress` +
  `todo` a fazer) e "Metas Atrasadas" (`overdue` + `nextDueDate` via `formatDue` local → "—"
  quando null); a lista "Metas do Projeto" usa `derived.map(toGoalDTO).slice(0,3)`. Card "Commits
  da Semana" via `weeklyCommitStats(scope, projectId)` + `formatWeeklyDelta`; card "Atividade
  Recente" via `listEvents(scope, { projectId, limit: 7 })` → `TimelineFeed`. **Só `UptimePanel`
  segue mock** (monitoramento — fora do escopo da 014); `mockGoals`/`mockSummary` removidos.

## O que NÃO vai aqui
- **Sem checagem de papel "solta" no layout** — o gating por papel mora no DAL
  (`requireAdmin`) e na página sensível (`configuracoes`); o layout só exige sessão.
- **Sem setar cookie** (é Server Component) — login/logout vivem em `api/auth/*`.
- **Sem acesso direto ao banco nas páginas** — usar o DAL e libs de `src/lib/*`.
