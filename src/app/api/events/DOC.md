# src/app/api/events

## Propósito
Endpoint de leitura da **Timeline** (spec 012): `GET /api/events` devolve o feed de eventos
paginado e escopado por papel. Usado pelo "Carregar mais" do `TimelineView` (cliente) p/
buscar a próxima página por cursor.

## Estrutura
Só `route.ts` (handler do segmento). Sem subpastas.

## Arquivos
- **`route.ts`** — `GET /api/events`. Handler fino, no padrão das demais rotas:
  1. **Sessão** — `getCurrentUser()`; sem sessão → `401 { error: "unauthorized" }`.
  2. **Validação** — querystring com zod: `projectId?` (uuid), `cursor?` (`events.id`, dígitos),
     `limit?` (1–100, coerce numérico). Inválida → `400 { error: "invalid_query" }`.
  3. **Leitura** — `listEvents(scopeForUser(current), { projectId?, cursor?, limit? })` →
     `200 { events, nextCursor }`. O escopo garante que o cliente só veja eventos visíveis e do
     próprio projeto (ou globais); admin vê tudo.
  Depende de `@/lib/auth/session`, `@/lib/events` e `scopeForUser` de `@/lib/projects`.

## O que NÃO vai aqui
- **Sem UI/JSX** — apenas `Request → Response`.
- **Sem lógica de negócio inline** — a query/escopo moram em `@/lib/events` (`listEvents`);
  o handler só autentica, valida e delega.
- **Sem PUBLISH/SSE** — o stream ao vivo (`/api/stream` + EventSource) é a spec 014; aqui é
  leitura pontual por request.
- **Sem `PATCH`/toggle de `visible_to_client`** — fica p/ quando houver tela de admin de eventos.
