# SPEC — Dashboard de Progresso de Projeto (Mirantes.Live)

> Especificação técnica derivada do `PRD.md`. Define **como** implementar: schema, contratos de API, workers, realtime e regras de cálculo.
> Onde o PRD descreve comportamento, este documento descreve estrutura e algoritmo.

---

## 1. Stack e topologia

- **Next.js (App Router)** — UI + Route Handlers no mesmo processo.
- **PostgreSQL** — fonte de verdade (relacional, transacional, hierárquico).
- **Redis** — Pub/Sub para realtime (+ cache opcional). Não persiste estado de negócio.
- **shadcn/ui + Lucide** — componentes e ícones.
- **React Query** (ou SWR) — estado de servidor no front, invalidação via SSE.
- Deploy em **VPS com Docker** (runtime Node de longa duração — viabiliza SSE e workers).

### Processos
1. **Web/API** — Next.js (UI + Route Handlers + endpoint SSE).
2. **Worker de monitoramento** — loop de polling dos serviços (HTTP/Docker).
3. **Worker de GitHub** — polling periódico dos projetos (1 repo cada): commits + Actions + branches.
4. **Worker de limpeza** — purga de eventos além da retenção.

Os workers podem rodar no mesmo container (processo Node com schedulers) ou separados; isolam-se da request/response do usuário.

### Home pública (snapshot no Redis)
A home `/` (pública, pré-login) é servida de um **snapshot público no Redis** (chave
`home:snapshot`): nome do projeto, tagline, flag "no ar" e timestamp. É **cache opcional**
— o **Postgres permanece a fonte de verdade** do negócio. O snapshot é gravado pelo seed
(`writeHomeSnapshot()`); se a chave faltar ou o Redis cair, a página cai num **fallback**
estático. O conteúdo do snapshot é não sensível.

---

## 2. Modelo de dados (PostgreSQL)

> Tipos sugeridos. PKs `uuid` (ou `bigint identity`). Timestamps `timestamptz`.

### 2.1 `users`
| coluna | tipo | notas |
|--------|------|-------|
| id | uuid PK | |
| email | text unique not null | |
| password_hash | text not null | argon2id |
| role | text not null | `admin` \| `client` |
| name | text null | nome de exibição (perfil) — spec 007 |
| created_at | timestamptz | default now() |

#### `avatars` (foto de perfil — spec 007)
| coluna | tipo | notas |
|--------|------|-------|
| user_id | uuid PK / FK→users | 1:1; `on delete cascade` |
| data | bytea not null | bytes da imagem (sem storage externo — §0) |
| mime_type | text not null | `image/png` \| `image/jpeg` \| `image/webp` |
| updated_at | timestamptz | atualizado a cada gravação |

> Tabela **lateral** (não coluna em `users`) p/ não arrastar o blob em todo `getCurrentUser`. Cap de 2 MiB + allowlist de mime validados na API (`PUT /api/account/avatar`); servida por `GET /api/account/avatar`.

### 2.2 `sessions`
| coluna | tipo | notas |
|--------|------|-------|
| id | uuid PK | token de sessão (no cookie httpOnly) |
| user_id | uuid FK→users | |
| expires_at | timestamptz not null | sliding: estendido a cada uso |
| created_at | timestamptz | |

### 2.3 `goals`
| coluna | tipo | notas |
|--------|------|-------|
| id | uuid PK | |
| parent_id | uuid FK→goals null | null = meta de topo |
| title | text not null | |
| status | text not null | `todo` \| `in_progress` \| `done` (manual só em folhas) |
| progress | smallint | 0–100, manual só em folhas |
| due_date | date not null | obrigatória |
| position | integer not null | ordenação entre irmãos |
| completed_at | timestamptz null | setado quando status→done (folha) |
| deleted_at | timestamptz null | soft delete |
| created_at | timestamptz | default now() |

- Índices: `(parent_id)`, `(deleted_at)`, `(due_date)`.
- `progress`/`status` em pais são **ignorados** na leitura (recalculados); manter colunas mas tratá-las como derivadas no app.

### 2.4 `events` (timeline unificada)
| coluna | tipo | notas |
|--------|------|-------|
| id | bigint identity PK | monotônico — serve de `Last-Event-ID` |
| source | text not null | `goal` \| `commit` \| `incident` |
| type | text not null | `commit.created`, `ci.run` (spec 012); `goal.*` (013); `incident.*` (futura) |
| ref_id | uuid/text null | sha do commit / `String(run_id)` / id da entidade |
| project_id | uuid null | **spec 012**: projeto do evento (filtro do seletor + vitrine da home); `null` = global |
| title | text not null | descrição curta exibida |
| detail | text null | texto secundário |
| visible_to_client | boolean not null | default **true** |
| created_at | timestamptz not null | default now() — carrega o **tempo da atividade** (commit/run) |

- Índices: `(created_at desc)`, `(visible_to_client, created_at desc)`, `(project_id, created_at desc)`.
- `id` crescente é a âncora de replay do SSE. **A leitura ordena por `id desc`** (inserção); `created_at`
  agrupa por dia. Emissão no `syncProject` + `backfillEvents` (spec 012); `PUBLISH`/SSE pendentes (014).

### 2.5 `services` (monitoramento)
| coluna | tipo | notas |
|--------|------|-------|
| id | uuid PK | |
| name | text not null | |
| check_type | text not null | `http` \| `docker` |
| target | text not null | URL (http) ou nome/id do container (docker) |
| ok_status_codes | int[] | http: status que contam como OK |
| latency_threshold_ms | integer | default 1000 — acima = Degradado |
| interval_seconds | integer | default 60 |
| failure_threshold | integer | default 3 — N falhas p/ incidente |
| current_state | text | `online` \| `degraded` \| `offline` |
| consecutive_failures | integer | default 0 |
| created_at | timestamptz | |

### 2.6 `service_checks` (uma linha por checagem)
| coluna | tipo | notas |
|--------|------|-------|
| id | bigint identity PK | |
| service_id | uuid FK→services | |
| state | text not null | `online` \| `degraded` \| `offline` |
| latency_ms | integer null | |
| checked_at | timestamptz not null | default now() |

- Índice: `(service_id, checked_at desc)`.
- Uptime % = `count(state in (online,degraded)) / count(*)` na janela. (Definir se `degraded` conta como "up" — ver §6.4.)

### 2.7 `incidents`
| coluna | tipo | notas |
|--------|------|-------|
| id | uuid PK | |
| service_id | uuid FK→services null | null se incidente manual geral |
| origin | text not null | `auto` \| `manual` |
| status | text not null | `open` \| `resolved` |
| started_at | timestamptz not null | |
| resolved_at | timestamptz null | |
| description | text | |

### 2.8 `projects`, `commits`, `branches`, `workflow_runs` (GitHub — spec 008)

**`projects`** (substitui a antiga `repos`) — **1 projeto = 1 repositório GitHub**, raiz do domínio:
| coluna | tipo | notas |
|--------|------|-------|
| id | uuid PK | |
| name | text not null | nome de exibição |
| owner | text not null | dono do repo |
| repo | text not null | nome do repo |
| description | text null | |
| default_branch | text null | preenchido pelo sync |
| last_polled_at | timestamptz null | cursor de tempo do sync (`since`) |
| last_seen_sha | text null | HEAD da branch padrão no último sync |
| created_at | timestamptz | default now() |
| user_id | uuid FK→users (cascade) | **dono** do projeto (spec 009) |
- `@@unique(user_id, owner, repo)` — o mesmo repo pode coexistir p/ donos diferentes; `@@index(user_id)`.

**`commits`** — agora pendurado em `project_id` (não mais `repo_id`):
| id uuid PK | project_id uuid FK→projects (on delete cascade) | sha text | message text (subject) | author text | committed_at timestamptz | created_at timestamptz |
- `@@unique(project_id, sha)` — **dedupe** do sync. Índice `(project_id, committed_at)` p/ a janela semanal.

**`branches`** — uma linha por branch viva no repo:
| id uuid PK | project_id uuid FK→projects (cascade) | name text | commit_sha text | is_default boolean | updated_at timestamptz |
- `@@unique(project_id, name)`. Sync faz upsert por nome e **remove** as ausentes.

**`workflow_runs`** — GitHub Actions:
| id uuid PK | project_id uuid FK→projects (cascade) | run_id bigint (id do GitHub) | name text | head_branch text null | head_sha text | status text | conclusion text null | run_number int | html_url text | run_started_at timestamptz null | updated_at timestamptz |
- `@@unique(project_id, run_id)` (upsert). Índice `(project_id, run_started_at)`.
- `run_id` é **bigint** (estoura int32) e **não é JSON-safe** → DTO serializa com `String()`.

#### `github_connections` (conexão OAuth por usuário — spec 009)
| coluna | tipo | notas |
|--------|------|-------|
| user_id | uuid PK / FK→users | 1:1; `on delete cascade` |
| token_ciphertext | text not null | token OAuth **cifrado** (AES-256-GCM, base64) |
| token_iv | text not null | nonce GCM (base64) |
| token_auth_tag | text not null | tag de integridade GCM (base64) |
| github_login | text not null | login do GitHub (exibido como @login) |
| github_user_id | bigint not null | id numérico da conta GitHub |
| scopes | text not null | escopos concedidos (`repo read:user`) |
| connected_at | timestamptz | default now() |
| updated_at | timestamptz | atualizado a cada reconexão |

> Tabela **lateral** 1:1 (espelha `avatars`) p/ não arrastar o segredo em todo `getCurrentUser`. O token OAuth vive **cifrado em repouso**; a chave fica em `env.GITHUB_TOKEN_ENC_KEY` (32 bytes base64), **fora** do banco. Decifrado só em memória, no sync (`resolveUserToken`). **Sai o `GITHUB_PAT` global** (spec 009).
> `goals`/`services` ganham `project_id` nas suas specs (Projeto é a raiz). **`events` já tem `project_id`
> (nullable) desde a spec 012** (filtro do seletor + vitrine da home); `null` = evento global.

---

## 3. Autenticação

- Login: verifica `email` + `password_hash` (argon2id). Cria `sessions`, seta cookie `httpOnly`, `Secure`, `SameSite=Lax`.
- **Sliding session**: a cada request autenticada, se faltar < (7d) para `expires_at`, estende para now()+7d.
- Middleware Next: `/dashboard/**` exige sessão válida; rotas de mutação exigem `role=admin`.
- **Rate limiting** em `/api/auth/login`: ex. 5 tentativas / 15 min por IP (Redis com TTL). Excedido → 429.
- **Troca de senha** (logado): valida senha atual, regrava hash, opcionalmente invalida outras sessões.
- Sem cadastro público; cliente provisionado por seed.

---

## 4. API (Route Handlers)

| Método | Rota | Permissão | Função |
|--------|------|-----------|--------|
| POST | `/api/auth/login` | público (rate-limited) | autentica, cria sessão |
| POST | `/api/auth/logout` | autenticado | encerra sessão |
| POST | `/api/auth/password` | autenticado | troca de senha (logado) |
| GET | `/api/goals` | autenticado | árvore de metas ativas (com progresso/status derivados) |
| POST | `/api/goals` | admin | cria meta |
| PATCH | `/api/goals/:id` | admin | edita (status/%/data/título/posição) |
| DELETE | `/api/goals/:id` | admin | arquiva (soft delete, cascata) |
| GET | `/api/summary` | autenticado | dados dos 4 cards |
| GET | `/api/events` | autenticado | timeline paginada (cliente só `visible_to_client`); **spec 012: filtro `projectId` + cursor** |
| PATCH | `/api/events/:id` | admin | alterna visibilidade do evento |
| GET | `/api/monitoring` | autenticado | serviços, estados, uptime, latência |
| GET | `/api/incidents` | autenticado | lista de incidentes |
| POST | `/api/incidents` | admin | registra incidente manual |
| PATCH | `/api/incidents/:id` | admin | resolve incidente manual |
| GET/POST/PATCH/DELETE | `/api/services` | admin | CRUD de serviços monitorados |
| GET | `/api/projects` | autenticado (escopo) | lista projetos **do escopo** (cliente só os seus; admin todos) |
| POST | `/api/projects` | autenticado | cria projeto (1 repo) **carimbando o dono**; `invalid_slug`→400, `already_exists`→409, criado→201 |
| GET | `/api/projects/:id` | autenticado (escopo) | projeto + log; alheio→404; `runId` serializado com `String()` |
| DELETE | `/api/projects/:id` | autenticado (escopo) | remove projeto do dono (CASCADE); alheio→404 |
| POST | `/api/projects/:id/sync` | autenticado (escopo) | sincroniza com o **token do dono**; alheio→404, `not_connected`→409, `github_error`→502 |
| GET | `/api/github/oauth/start` | autenticado | inicia OAuth: grava `state` (cookie httpOnly) + 307 ao authorize do GitHub |
| GET | `/api/github/oauth/callback` | autenticado | valida `state`+code, troca pelo token, grava conexão cifrada; 303 p/ Integrações |
| DELETE | `/api/github/connection` | autenticado | desconecta a conta do GitHub do usuário (idempotente) |
| GET | `/api/github/repos` | autenticado | lista os repos da conta conectada (seletor de projetos); `not_connected`→409, `github_error`→502 |
| GET/PATCH | `/api/settings` | admin | retenção, intervalos, PAT |
| GET | `/api/stream` | autenticado | canal SSE |

**Regra transversal de mutação:** grava no Postgres (transação) → insere em `events` → `PUBLISH goals:updates {event}` no Redis → SSE entrega.

**Filtro de visibilidade:** endpoints de leitura para `role=client` aplicam `visible_to_client = true` e nunca expõem dados de `/api/settings`, `/api/services`. **Projetos são escopados por dono** (spec 009): cliente cria/vê/sincroniza/remove **apenas os seus** (projeto alheio → 404); admin é global. A conexão do GitHub (`/api/github/*`) é por usuário.

**Home pública (`/`):** Server Component que lê o snapshot do Redis (`readHomeSnapshot()`,
chave `home:snapshot`) — **não** é Route Handler. `force-dynamic` (lê o Redis a cada
request); fallback estático se ausente. O Postgres permanece a fonte de verdade.

---

## 5. Metas — algoritmos

### 5.1 Leitura da árvore (`GET /api/goals`)
1. `SELECT * FROM goals WHERE deleted_at IS NULL ORDER BY parent_id, position`.
2. Montar árvore em memória.
3. **Pós-ordem (bottom-up)** para derivar pais:
   - folha: usa `progress`/`status` próprios.
   - pai: `progress = round(avg(progress dos filhos))`.
   - pai status:
     - todos filhos `done` → `done`;
     - todos `todo` → `todo`;
     - caso contrário → `in_progress`.
4. Retorna árvore com campos derivados marcados `derived: true` (UI trava edição).

### 5.2 Criação / edição
- Criar: `position` = max(irmãos)+1. `due_date` obrigatória (valida 400 se ausente).
- Editar folha: ao mudar `status`→`done`, setar `completed_at = now()`; ao sair de `done`, limpar.
- Bloquear edição de `progress`/`status` se a meta tiver filhos ativos (409/422).

### 5.3 Arquivamento em cascata
- Transação: `UPDATE goals SET deleted_at=now() WHERE id = :id OR id IN (subárvore)`.
- Subárvore via CTE recursiva (`WITH RECURSIVE`).
- Gera 1 evento `goal.archived` (para o nó-raiz arquivado).

### 5.4 Atraso
- Derivado em leitura: `overdue = due_date < current_date AND status != 'done'`.

---

## 6. Monitoramento — worker

### 6.1 Loop
- Para cada serviço, agenda checagem a cada `interval_seconds`.
- Executa check conforme `check_type`.

### 6.2 Check HTTP
- Request à `target`; mede latência.
- Resultado:
  - status ∈ `ok_status_codes` **e** latência ≤ `latency_threshold_ms` → `online`;
  - status ∈ `ok_status_codes` **e** latência > threshold → `degraded`;
  - caso contrário (status fora / timeout / erro de rede) → `offline`.

### 6.3 Check Docker
- Consulta o estado do container via socket/API do Docker.
- container `running` → `online` (aplica threshold de latência se houver medição aplicável; senão só online/offline);
- container não-running → `offline`;
- **socket inacessível → `offline`** (conta como downtime, conforme PRD).

### 6.4 Registro e estado
- Insere linha em `service_checks`.
- Atualiza `services.current_state`.
- **Uptime %**: `degraded` conta como "up" (serviço respondeu). Apenas `offline` é downtime.
- Em mudança de estado → evento `incident.*`/state-change → Redis → SSE + Timeline.

### 6.5 Incidente automático (anti-flapping)
- A cada `offline`: `consecutive_failures++`. Ao atingir `failure_threshold` (default 3) sem incidente aberto → abre `incidents(origin=auto, status=open, started_at=now())` + evento `incident.opened`.
- Ao voltar a `online`/`degraded`: zera `consecutive_failures`; se há incidente auto aberto → `status=resolved`, `resolved_at=now()` + evento `incident.resolved`.

---

## 7. GitHub — worker + sync manual (spec 008)

Núcleo único **`syncProject(projectId, client?)`** (em `src/lib/github/sync.ts`), compartilhado
pelo **worker de polling** (`bun run src/lib/github/worker.ts`, script `worker:github`) e pelo
**botão manual** (`POST /api/projects/:id/sync`). Idempotente, por projeto:

- **Repo/nome:** `getRepo` → atualiza `name` e `default_branch`.
- **Commits:** `listCommits({ since: last_polled_at, sha: default_branch })` → `createMany(skipDuplicates)`
  na unique `(project, sha)`; conta os realmente inseridos.
- **Branches:** `listBranches` → upsert por `(project, name)` (marca a default) + **remove** as ausentes.
- **Actions:** `listWorkflowRuns` (envelope `{ workflow_runs }`) → upsert por `(project, run_id)`.
- **Cursor:** `last_seen_sha = HEAD da default`; `last_polled_at = now()`.
- Erros: `project_not_found` / `not_connected` (dono sem conexão GitHub, sem rede) / `github_error` (borda HTTP/rede).
- Eventos da Timeline (**spec 012**): **1 `commit.created` por commit novo** + **1 `ci.run` por run ao
  concluir** (transição p/ `completed`), idempotentes (dedupe por SHA no banco / por estado do run);
  `backfillEvents` preenche o histórico. O `PUBLISH goals:updates` + SSE seguem **pendentes da spec 014**.
- Token **OAuth do dono** do projeto, resolvido por `resolveUserToken(project.user_id)` (decifra a `github_connections` em memória); **nunca** em log, resposta de API ou URL (só no header Authorization). Sem conexão/token inválido → `not_connected`.
- Cliente HTTP: `fetch` nativo, **sem Octokit** (CLAUDE.md §0); injetável p/ teste com stub.
- **Conexão OAuth (spec 009):** `GET /api/github/oauth/start` gera um `state` assinado (HMAC + cookie httpOnly) e 307 ao GitHub; o `callback` valida o `state` (assinatura + igualdade byte-a-byte com o cookie + dono = usuário atual), troca o `code` pelo token (`src/lib/github/oauth.ts`; faked no e2e via `GITHUB_OAUTH_FAKE`) e grava a conexão cifrada (`src/lib/github/connection.ts`). Escopo OAuth: `repo read:user`.
- **Seletor de repositórios (spec 010):** `GET /api/github/repos` → `listUserRepos(userId)` →
  `client.listRepos()` (`GET /user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`),
  **cap de 100** (a entrada manual da UI cobre a cauda); faked **após** a resolução do token
  (não-conectado → `not_connected`). A UI esconde os repos já adicionados; o campo *Nome* saiu do
  fluxo de adicionar (nome = repo).

---

## 8. Summary (`GET /api/summary`)

- **Total de Metas** = `count(goals WHERE deleted_at IS NULL)`.
- **Progresso** = média dos `progress` derivados das metas de topo.
- **Pontualidade** = `% metas ativas com overdue=false`.
- **Uptime** = média de uptime% dos serviços na janela corrente.
- **Saúde** = `0.5*Progresso + 0.3*Pontualidade + 0.2*Uptime`, arredondado.
- **Commits semanais** = `count(commits WHERE committed_at >= now()-7d)`; variação % vs. 7d anteriores.
- **Tempo médio** = `avg(completed_at - created_at)` em dias das metas `done`.

---

## 9. Realtime (SSE)

### 9.1 Endpoint `/api/stream`
- Resposta `text/event-stream`, conexão mantida aberta.
- Assina canal Redis `goals:updates`; cada mensagem vira um `event:` SSE com `id:` = `events.id`.
- **Heartbeat**: comentário `:ping\n\n` a cada ~15–25s para manter viva atrás do proxy.
- Cliente `client`: o servidor filtra e só envia eventos `visible_to_client=true`.

### 9.2 Reconexão / replay
- Cliente usa `EventSource` (reconexão automática).
- No reconnect, navegador envia header `Last-Event-ID`.
- Servidor faz replay: `SELECT * FROM events WHERE id > :lastId ORDER BY id` (respeitando visibilidade) antes de voltar ao stream do Redis.

### 9.3 Proxy
- Nginx/Caddy: `proxy_buffering off`, timeouts altos para conexões longas.

### 9.4 Front
- Ao receber evento, invalida as queries afetadas (React Query) ou aplica patch otimista.

---

## 10. Retenção / limpeza

- Worker periódico (ex. diário): `DELETE FROM events WHERE created_at < now() - retention`.
- `retention` configurável (default 90 dias) em settings.
- Opcional: agregar/expurgar `service_checks` antigos para conter crescimento (definir política — manter ≥ janela de uptime exibida).

---

## 11. Segurança

- Cookies `httpOnly` + `Secure` + `SameSite=Lax`.
- Autorização por papel em todas as mutações e em leituras sensíveis.
- Segredos só no servidor; nunca em URL, log ou resposta ao cliente. O **token OAuth do GitHub** é guardado **cifrado em repouso** (AES-256-GCM, `src/lib/crypto/secret.ts`); a chave (`env.GITHUB_TOKEN_ENC_KEY`, 32 bytes base64) fica **fora** do banco. O fluxo OAuth usa **`state` anti-CSRF** (HMAC + cookie httpOnly, comparado byte-a-byte no callback) e `redirect_uri` fixo derivado de `APP_BASE_URL`.
- Rate limit no login.
- Validação de input (zod) em todos os Route Handlers.

---

## 12. Defaults

| Parâmetro | Default | Escopo |
|-----------|---------|--------|
| Intervalo de polling | 60s | por serviço |
| Failure threshold (incidente) | 3 | por serviço |
| Latency threshold (degradado) | 1000ms | por serviço |
| Retenção da timeline | 90 dias | global |
| Sessão | 7 dias, sliding | global |
| Rate limit login | 5 / 15min / IP | global |
| Heartbeat SSE | ~20s | global |

---