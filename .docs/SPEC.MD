# SPEC — Dashboard de Progresso de Projeto (GuiaGoals)

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
3. **Worker de GitHub** — polling periódico dos repositórios.
4. **Worker de limpeza** — purga de eventos além da retenção.

Os workers podem rodar no mesmo container (processo Node com schedulers) ou separados; isolam-se da request/response do usuário.

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
| created_at | timestamptz | default now() |

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
| type | text not null | ex. `goal.completed`, `commit.batch`, `incident.opened` |
| ref_id | uuid/text null | id da entidade relacionada |
| title | text not null | descrição curta exibida |
| detail | text null | texto secundário |
| visible_to_client | boolean not null | default **true** |
| created_at | timestamptz not null | default now() |

- Índices: `(created_at desc)`, `(visible_to_client, created_at desc)`.
- `id` crescente é a âncora de replay do SSE.

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

### 2.8 `repos` e `commits` (GitHub)
`repos`: id, `owner`, `name`, `last_polled_at`, `last_seen_sha`.
`commits`: id, `repo_id` FK, `sha` unique, `message`, `author`, `committed_at`.
- PAT **não** vive no banco em texto plano — variável de ambiente / secret store do servidor.
- Índice em `commits(committed_at)` para a janela semanal.

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
| GET | `/api/events` | autenticado | timeline paginada (cliente vê só `visible_to_client`) |
| PATCH | `/api/events/:id` | admin | alterna visibilidade do evento |
| GET | `/api/monitoring` | autenticado | serviços, estados, uptime, latência |
| GET | `/api/incidents` | autenticado | lista de incidentes |
| POST | `/api/incidents` | admin | registra incidente manual |
| PATCH | `/api/incidents/:id` | admin | resolve incidente manual |
| GET/POST/PATCH/DELETE | `/api/services` | admin | CRUD de serviços monitorados |
| GET/POST/DELETE | `/api/repos` | admin | gerência de repositórios GitHub |
| GET/PATCH | `/api/settings` | admin | retenção, intervalos, PAT |
| GET | `/api/stream` | autenticado | canal SSE |

**Regra transversal de mutação:** grava no Postgres (transação) → insere em `events` → `PUBLISH goals:updates {event}` no Redis → SSE entrega.

**Filtro de visibilidade:** endpoints de leitura para `role=client` aplicam `visible_to_client = true` e nunca expõem dados de `/api/settings`, `/api/services`, `/api/repos`.

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

## 7. GitHub — worker

- A cada intervalo, para cada repo: chama API de commits desde `last_seen_sha` (ou `since=last_polled_at`).
- Insere novos `commits` (dedupe por `sha`), atualiza `last_seen_sha`/`last_polled_at`.
- Lote de novos commits → 1 evento `commit.batch` ("N commits em <repo>") → Timeline + SSE.
- PAT lido de env/secret; nunca em log, resposta de API ou URL.

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
- PAT e segredos só no servidor; nunca em URL, log ou resposta ao cliente.
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