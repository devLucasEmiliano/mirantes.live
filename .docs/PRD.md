# Especificação — Dashboard de Progresso de Projeto

Sistema para um desenvolvedor solo apresentar o progresso de um projeto a um cliente. O admin (você) cria e edita metas; o cliente apenas visualiza, com atualização em tempo real. Dedicado a um único cliente.

## 1. Visão geral

| Item | Decisão |
|------|---------|
| Stack base | Next.js (App Router) |
| UI | shadcn/ui + Lucide (ícones) |
| Banco principal | PostgreSQL (fonte de verdade) |
| Realtime | Redis Pub/Sub + SSE |
| Autenticação | Email/senha |
| Papéis | `admin` (edita) e `client` (somente leitura) |
| Estrutura de metas | Hierárquica, 2+ níveis |
| Medição de progresso | Status + percentual + data prevista |
| Progresso de meta-pai | Calculado a partir dos filhos |
| Deleção | Soft delete (arquivar) |
| Notificações por email | Não |
| Módulos extras | Painel-resumo + timeline de atividade |

## 2. Arquitetura

O fluxo segue: admin e cliente autenticam na aplicação Next.js. As escritas vão para o Postgres (fonte de verdade). Após cada escrita, a aplicação publica um evento no Redis. Um canal SSE inscrito no Redis empurra o evento para o navegador do cliente, que reflete a mudança sem refresh.

Por que Redis não é o banco principal: Redis é volátil e não oferece garantias relacionais (integridade referencial, transações, queries hierárquicas). Para um histórico de metas que precisa sobreviver a reinícios e manter relações pai/filho, Postgres é o lugar certo. Redis fica com o papel que faz bem: mensageria de baixa latência para o realtime e cache opcional.

## 3. Modelo de dados

### users
- `id` (uuid, PK)
- `email` (text, único)
- `password_hash` (text) — argon2id/bcrypt
- `role` (enum: `admin` | `client`)
- `created_at` (timestamptz)

### goals
Estrutura em árvore via auto-referência (`parent_id`).
- `id` (uuid, PK)
- `parent_id` (uuid, FK → goals.id, nullable) — null = meta de topo
- `title` (text)
- `description` (text, nullable)
- `status` (enum: `todo` | `in_progress` | `done`)
- `progress` (int, 0–100) — ver regra de cálculo abaixo
- `due_date` (date, nullable)
- `position` (int) — ordenação manual entre irmãos
- `deleted_at` (timestamptz, nullable) — soft delete: registros com valor não-nulo são tratados como arquivados e ocultados das consultas padrão
- `created_at`, `updated_at` (timestamptz)

### goal_events
Histórico/auditoria de mudanças. Alimenta a timeline de atividade.
- `id` (uuid, PK)
- `goal_id` (uuid, FK → goals.id)
- `event_type` (enum: `created` | `updated` | `status_changed` | `archived`)
- `payload` (jsonb) — diff do que mudou
- `created_at` (timestamptz)

Notas de modelagem:
- Hierarquia com `parent_id` cobre 2+ níveis. Para árvores profundas e queries de subárvore eficientes, considere a extensão `ltree` ou um campo `path` materializado mais adiante.
- **Progresso da meta-pai é calculado** a partir dos filhos (não armazenado como valor manual independente). Metas-folha têm progresso definido manualmente; metas com filhos derivam o percentual da agregação dos filhos. Ver seção 8.

## 4. Autenticação e autorização

- Sessão via cookie httpOnly + token.
- Senhas com hash argon2id (ou bcrypt).
- Middleware no Next protege rotas: `/dashboard` exige sessão; mutações (criar/editar/arquivar meta) exigem `role = admin`.
- Como só você cria contas, **não há fluxo público de cadastro** — o usuário do cliente é provisionado por você (seed/script). Isso reduz superfície de ataque.

## 5. API (App Router / Route Handlers)

| Método | Rota | Permissão | Função |
|--------|------|-----------|--------|
| POST | `/api/auth/login` | público | autentica e cria sessão |
| POST | `/api/auth/logout` | autenticado | encerra sessão |
| GET | `/api/goals` | autenticado | árvore de metas (exclui arquivadas) |
| POST | `/api/goals` | admin | cria meta |
| PATCH | `/api/goals/:id` | admin | edita meta (status, %, data, título) |
| DELETE | `/api/goals/:id` | admin | arquiva meta (soft delete) |
| GET | `/api/summary` | autenticado | dados do painel-resumo |
| GET | `/api/events` | autenticado | timeline de atividade |
| GET | `/api/stream` | autenticado | canal SSE de eventos |

Toda mutação bem-sucedida: grava no Postgres → registra em `goal_events` → publica em canal Redis `goals:updates` → SSE entrega aos conectados.

## 6. Realtime

- Endpoint SSE (`/api/stream`) mantém conexão aberta e repassa eventos do Redis.
- Cliente usa `EventSource` no front; ao receber evento, invalida/atualiza o cache local (React Query/SWR) ou aplica o patch direto.
- SSE é mais simples que WebSocket e suficiente para fluxo unidirecional (servidor → cliente). Só troque por WebSocket se precisar de comunicação bidirecional no futuro.
- Como você roda em VPS com Docker (runtime Node de longa duração), SSE funciona sem as restrições de serverless. Garanta apenas que o proxy reverso não derrube conexões longas (`proxy_buffering off`, timeouts altos).

## 7. Frontend

- `/login` — formulário email/senha.
- `/dashboard` — painel-resumo no topo + árvore de metas abaixo. Visão do cliente é read-only; visão do admin mostra controles de edição inline.
- Componentes (shadcn/ui + Lucide): árvore expansível, barra/anel de progresso por meta, badge de status, data prevista com destaque para atrasadas, cards de resumo, lista de timeline.
- Estado de servidor com React Query ou SWR (encaixa bem com SSE para invalidação).

### Painel-resumo (topo do dashboard)
Visão geral rápida para o cliente, derivada de `/api/summary`:
- Progresso total do projeto (agregado das metas de topo).
- Contagem por status (a fazer / em andamento / concluído).
- Metas atrasadas (due_date passada e status ≠ done).

### Timeline de atividade
Lista cronológica alimentada por `goal_events` (via `/api/events`): mostra o que mudou e quando (ex: "Meta X concluída", "Meta Y criada"). Dá ao cliente a sensação de evolução contínua sem precisar comparar estados manualmente.

## 8. Cálculo de progresso

- **Meta-folha** (sem filhos): `progress` é definido manualmente pelo admin (0–100).
- **Meta-pai** (com filhos): `progress` é calculado como a média dos filhos. Recomendo começar com média simples; se quiser refinar depois, dá para introduzir peso por filho.
- O cálculo pode ser feito sob demanda na leitura (recursivo na árvore) ou materializado em coluna e recalculado a cada mutação de filho. Para a escala de um cliente único, calcular na leitura é mais simples e suficiente.
- `status` da meta-pai pode seguir a mesma lógica de derivação (ex.: todos os filhos `done` → pai `done`; algum `in_progress` → pai `in_progress`), ou ser mantido manual. Decisão de implementação fica em aberto.

## 9. O que faltava no fluxo original (lacunas preenchidas)

1. **Papel do Redis** — era banco principal no diagrama; foi reposicionado como Pub/Sub + cache, com Postgres como fonte de verdade.
2. **Autorização por papel** — o fluxo não distinguia quem pode editar; adicionado `admin` vs `client`.
3. **Arquivamento e ordenação** de metas — não previstos; incluídos (soft delete via `deleted_at` + `position`).
4. **Histórico/timeline** — `goal_events` alimenta a timeline de atividade visível ao cliente.
5. **Painel-resumo** — visão agregada (progresso total, metas atrasadas) no topo do dashboard.
6. **Cálculo de progresso de metas-pai** — definido como agregação automática dos filhos.
7. **Camada de transporte realtime** — o "sem refresh" exigia mecanismo concreto; definido SSE.