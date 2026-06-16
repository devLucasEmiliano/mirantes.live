# PRD — Dashboard de Progresso de Projeto (Mirantes.Live)

> Documento de Requisitos de Produto. Define **o que** o sistema faz e **como deve se comportar**.
> Decisões técnicas de implementação (schema detalhado, contratos de API, infraestrutura) ficam para o `SPEC.md`.

---

## 1. Visão geral

Sistema para um desenvolvedor solo apresentar o progresso de projetos a um único cliente. O **admin** cria e edita conteúdo; o **cliente** apenas visualiza, com atualização em tempo real (sem refresh). Dedicado a um único cliente.

**Projeto é a raiz do domínio** (spec 008): cada **Projeto = exatamente 1 repositório GitHub**. O sistema é **multi-projeto** — metas, atividades (commits) e quedas penduram em `project_id` (cada nessas suas specs). Por ora a fundação cria `Project` + dados do GitHub e o seletor/cards consomem o real; metas/timeline/monitoramento seguem por evoluir.

Além do acompanhamento de metas, o produto inclui um subsistema de **monitoramento de serviços** (uptime/incidentes), **integração com GitHub** (commits, GitHub Actions e branches — por polling do worker **e** sincronização manual) e uma **timeline unificada** de atividade.

| Item | Decisão |
|------|---------|
| Stack base | Next.js (App Router) |
| UI | shadcn/ui + Lucide (ícones) |
| Banco principal | PostgreSQL (fonte de verdade) |
| Realtime | Redis (Pub/Sub) + SSE |
| Autenticação | Email/senha |
| Papéis | `admin` (edita) e `client` (somente leitura) |
| Estrutura de metas | Hierárquica, profundidade ilimitada |
| Medição de progresso | Status + percentual + data prevista |
| Progresso de meta-pai | Calculado (média simples dos filhos) |
| Deleção | Soft delete (arquivar), em cascata |
| Notificações por email | Não |
| Módulos | Visão Geral, Metas, Timeline, Monitoramento, Configurações |

### Telas (menu)
1. **Visão Geral** — painel-resumo do projeto (cards + atividade recente + status resumido).
2. **Metas** — árvore hierárquica de metas.
3. **Timeline** — feed cronológico unificado de atividade.
4. **Monitoramento** — uptime, status de serviços, incidentes, latência.
5. **Configurações** — área exclusiva do admin (serviços, GitHub, retenção).

---

## 2. Papéis e visibilidade

- **admin** (você): cria/edita/arquiva metas, gerencia **projetos** (cada um = 1 repositório GitHub: adiciona/remove/sincroniza), configura serviços monitorados, marca visibilidade de eventos, gerencia retenção. Vê tudo. **Configurações** segue admin-only.
- **client** (cliente único): somente leitura. Vê Visão Geral, Metas, Timeline e Monitoramento. **Não** vê a tela de Configurações nem nenhum dado de configuração.
- **Sem cadastro público.** A conta do cliente é provisionada pelo admin (seed/script). Não há conceito de múltiplos "membros do projeto".

---

## 3. Autenticação e sessão

- Sessão via cookie `httpOnly` + token.
- Senhas com hash **argon2id** (ou bcrypt).
- Middleware do Next protege rotas: `/dashboard` exige sessão; mutações exigem `role = admin`.
- **Duração da sessão:** 7 dias, **sliding** (renova a cada uso).
- **Troca de senha:** existe fluxo de **troca de senha para usuário logado** (senha atual → nova senha). Não há fluxo público de "esqueci minha senha" / reset por email.
- **Rate limiting** em `/api/auth/login` (proteção contra brute force — limite de tentativas por IP/janela de tempo).
- Sem fluxo público de cadastro (reduz superfície de ataque).

---

## 4. Metas

### 4.1 Estrutura
- Hierarquia com **profundidade ilimitada** (meta → sub → sub-sub → …).
- Cada meta tem: título, status, progresso (0–100), **data prevista (`due_date`) obrigatória**, posição (ordenação) e estado de arquivamento.

### 4.2 Status
Valores canônicos: `todo` (a fazer) · `in_progress` (em andamento) · `done` (concluído).
Rótulos em PT exibidos na UI: "A Fazer" / "Em Progresso" / "Concluído".

### 4.3 Progresso e derivação (folha vs. pai)
- **Meta-folha** (sem filhos): progresso (0–100) e status definidos **manualmente** pelo admin.
- **Meta-pai** (com filhos):
  - **Progresso** = **média simples** dos progressos dos filhos.
  - **Status** = **derivado automaticamente**:
    - todos os filhos `done` → pai `done`;
    - todos os filhos `todo` → pai `todo`;
    - qualquer outra combinação (algum `in_progress`, ou mistura de `done`/`todo`) → pai `in_progress`.
  - Progresso e status do pai são **read-only** na UI (não editáveis enquanto houver filhos).
- O cálculo é feito sob demanda na leitura (recursivo na árvore) — suficiente para a escala de um cliente único.

### 4.4 Arquivamento (soft delete)
- Arquivar é soft delete (`deleted_at`), nunca deleção permanente.
- Arquivar uma meta-pai **arquiva os filhos em cascata**.
- Metas arquivadas são excluídas da árvore, dos cálculos e das contagens.

### 4.5 Atraso
- Uma meta está **atrasada** quando `due_date` está no passado **e** `status ≠ done`.

### 4.6 Ordenação
- Metas têm campo de **posição** para ordenação manual entre irmãos.

---

## 5. Visão Geral (painel-resumo)

Quatro cards no topo, derivados automaticamente:

1. **Total de Metas** — contagem de metas **ativas** (exclui arquivadas).
2. **Saúde do Projeto** (0–100%) — fórmula composta:
   `Saúde = 0.50·Progresso + 0.30·Pontualidade + 0.20·Uptime`
   - **Progresso** = progresso agregado do projeto (média das metas de topo).
   - **Pontualidade** = % de metas ativas **não atrasadas**.
   - **Uptime** = uptime médio dos serviços monitorados (janela corrente).
3. **Commits Semanais** — total de commits dos projetos na janela de 7 dias, com **variação % vs. semana anterior** (spec 008: contagem real sobre a tabela `commits`).
4. **Tempo Médio** — média de dias entre criação e conclusão (`completed_at − created_at`) das metas concluídas.

A Visão Geral também resume status dos serviços e atividade recente (subconjunto da Timeline).

---

## 6. Timeline de atividade

- **Feed unificado**: eventos de **metas** + **commits** + **incidentes de monitoramento**, numa única coleção de eventos.
- Cada evento registra origem (`source`: goal / commit / incident), tipo, descrição e timestamp.
- **Visibilidade controlada pelo admin**: cada evento tem flag de visibilidade ao cliente.
  - Eventos automáticos (commits, incidentes) entram **visíveis por padrão**; o admin pode **ocultar** caso a caso.
- **Retenção configurável** (default sugerido 90 dias): job periódico remove eventos além da janela.
- Dentro da janela: paginação por scroll/cursor (últimos N + "ver mais").

---

## 7. Monitoramento de serviços ("Uptime Kuma simplificado")

Subsistema embutido com **worker de polling** próprio na aplicação (runtime Node de longa duração em VPS/Docker).

### 7.1 Tipos de check
- **HTTP/HTTPS**: faz request a uma URL. Os status codes que contam como "Online" são **configuráveis por serviço**.
- **Docker**: verifica via socket/API do Docker se o container está em execução (`running`).

### 7.2 Estados
Três estados por serviço: **Online · Degradado · Offline**.
- **Degradado** = respondeu, mas latência **acima de um threshold configurável por serviço**.
- **Offline** = check falhou (HTTP fora dos status OK / container não running / sem resposta).

### 7.3 Polling
- **Intervalo de checagem configurável por serviço**.
- Cada checagem **grava uma linha** de resultado (timestamp, estado, latência). O uptime % é calculado pela razão de checks OK sobre o total na janela.

### 7.4 Incidentes
- **Automáticos**: o sistema abre incidente **após N falhas seguidas** (N configurável — anti-flapping) e o encerra quando o serviço volta, registrando início, fim e duração.
- **Manuais**: o admin pode registrar incidente à mão (botão "Registrar Incidente").
- Mudanças de estado de serviço e abertura/fechamento de incidente **publicam evento realtime** (Redis → SSE) e entram na Timeline.

### 7.5 Métricas exibidas
- Uptime por serviço e geral (mensal / últimos 30 dias).
- Tempo de resposta médio (geral e por endpoint).
- Lista de incidentes recentes com duração.

> **Docker socket inacessível:** tratado como **Offline** (conta como downtime).

---

## 8. Integração GitHub (commits, Actions, branches)

- Provedor: **GitHub**. **Cada Projeto = exatamente 1 repositório** (spec 008).
- Captura por **polling da API** (worker de fundo) **e** por **sincronização manual** ("Sincronizar Agora" em Configurações) — ambos sobre o mesmo núcleo idempotente.
- Sincroniza e persiste: **commits** (dedupe por SHA), **GitHub Actions** (workflow runs) e **branches** (com a default), além de nome/branch padrão do repo.
- Autenticação por **Personal Access Token (PAT)** armazenado como **segredo de servidor** (nunca exposto ao cliente, em log nem em URL).
- Alimenta o card "Commits Semanais", o bloco "último commit" e o log de atividade do projeto; gerará eventos `commit` na Timeline (spec futura).

---

## 9. Configurações (admin-only)

Tela exclusiva do admin (cliente não acessa nem vê). Contém:
- **Serviços monitorados**: adicionar/editar/remover; tipo de check (HTTP/Docker), URL/container, status codes OK, threshold de latência, intervalo de polling, N falhas para incidente.
- **Projetos** (spec 008): adicionar (owner/repo)/remover/**sincronizar agora**; ao expandir, log de atividade (commits recentes, branches, status do último CI). PAT lido do servidor (env); intervalo de polling do worker.
- **Retenção da Timeline**: janela em dias (configurável).
- **Conta**: editar **nome, email e foto** (upload de imagem) do perfil + troca de senha do usuário logado (spec 007).

---

## 10. Realtime

- Escrita → Postgres (fonte de verdade) → registra evento → publica em canal Redis → **SSE** entrega aos conectados.
- **SSE** (não WebSocket): fluxo unidirecional servidor → cliente é suficiente.
- **Reconexão robusta**: `EventSource` reconecta automaticamente; uso de **`Last-Event-ID`** para reenviar eventos perdidos durante a queda; **heartbeat/keep-alive** para manter a conexão viva atrás do proxy reverso (`proxy_buffering off`, timeouts altos).
- Cliente invalida/atualiza cache local (React Query/SWR) ao receber evento, ou aplica patch direto.

---

## 11. Eventos que disparam realtime + Timeline

| Origem | Exemplos de evento |
|--------|--------------------|
| Metas | criada, editada (status/%/data/título), arquivada, concluída |
| Commits | novos commits detectados por repositório |
| Monitoramento | serviço mudou de estado, incidente aberto/fechado |

Todos passam por: grava no Postgres → registra evento → publica no Redis → SSE entrega.

---

## 12. Decisões registradas (resumo)

| Tema | Decisão |
|------|---------|
| Monitoramento no MVP | Sim, embutido (HTTP + Docker) |
| Estados de serviço | Online / Degradado / Offline |
| Threshold de degradado | Latência, por serviço |
| Status OK (HTTP) | Configurável por serviço |
| Intervalo de polling | Por serviço |
| Histórico de uptime | Uma linha por check |
| Incidente automático | Após N falhas seguidas (default 3) + manual |
| Docker socket inacessível | Offline (conta downtime) |
| Projetos / Commits | Projeto = 1 repo GitHub; sync de commits + Actions + branches por polling **e** manual; dedupe por SHA; PAT no servidor |
| Saúde do projeto | 0.5 progresso / 0.3 pontualidade / 0.2 uptime |
| Tempo médio | Calculado (criação→conclusão) |
| Total de metas | Só ativas |
| Profundidade de metas | Ilimitada |
| Status do pai | Derivado automaticamente |
| Progresso/status do pai | Read-only com filhos |
| Arquivar pai | Cascata |
| due_date | Obrigatória |
| Timeline | Feed unificado, retenção configurável |
| Membros | Não existem (cliente único) |
| Visibilidade de evento | Admin marca; automáticos visíveis por padrão |
| Sessão | 7 dias, sliding |
| Senha | Troca logado, sem reset público |
| Login | Com rate limiting |
| SSE | Reconexão + Last-Event-ID + heartbeat |

---

## 13. Defaults e parâmetros

- **Docker socket inacessível:** Offline (conta como downtime).
- **Intervalo de polling padrão:** 60s (configurável por serviço).
- **N falhas para abrir incidente:** 3 (configurável).
- **Threshold de latência para "Degradado":** 1000ms (configurável por serviço).
- **Retenção da Timeline:** 90 dias (configurável).
- Schema canônico (tabelas `users`, `sessions`, `projects`, `commits`, `branches`, `workflow_runs`, `goals`, `events`, `services`, `service_checks`, `incidents`) detalhado no `SPEC.md`. `projects` substitui a antiga `repos`; `goals`/`events`/`services` ganham `project_id` nas suas specs.

flowchart TD
    A[Pagina de Progresso] -->|Login| B(Dashboard)
    C[Criaçao de Metas]
    C --> D[Update de Metas]
    D --> E[Edit de Metas]
    E --> D --> C
    C --> B
    A --> |Redis| F[Banco de Dados] --> B --> F
    F <--> G[GitHub]