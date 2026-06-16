---
id: 004
title: Rename de marca — GuiaGoals → Mirantes.Live (UI + package + mock/seed + docs + design .pen)
status: done         # draft | approved | tests-red | done
test_levels: []      # ⚠️ Desvio consciente do §5 (TDD/infra real), aprovado no chat — espelha a 003.
                     #    Rename é ~100% textual; asserir constante de marca = "teste de mentira" (§5.4).
                     #    Verificação manual (npm run dev + Playwright MCP + Pencil get_screenshot).
created: 2026-06-15
---

# 004 — Rename de marca: GuiaGoals → Mirantes.Live

## Objetivo

Renomear a marca do produto de **GuiaGoals** para **Mirantes.Live** em **todas as camadas**:
UI visível (sidebar, login, títulos de aba, rodapé, Configurações), manifestos do projeto
(`package.json` + lockfiles), dados de mock/seed (domínios e emails de exemplo), documentos-fonte
(`PRD`/`SPEC`/`.specs`) e o arquivo de design `desing.pen`. É um rename de **branding** — **nenhuma
mudança de comportamento, schema, rota ou contrato**.

## Decisões aprovadas pelo humano (registro CLAUDE.md §0/§1) — neste chat

1. **Wordmark:** `Mirantes.Live` **literal** — igual em todos os pontos visíveis (sidebar, login,
   títulos de aba, rodapé). Sem variação curta.
2. **Slug técnico:** `mirantes.live` — usado onde a marca literal não cabe: `name` do
   `package.json`/lockfiles, handle do repositório e domínios de exemplo. Válido no npm
   (minúscula + ponto, estilo `socket.io`).
3. **Escopo:** total — UI, `package.json` + lockfiles, mock/seed (domínios + emails), docs
   (PRD/SPEC/.specs) **e** o design `desing.pen` (via Pencil MCP).
4. **Testes:** **nenhum** automatizado. Desvio consciente do §3/§5, espelhando a 003
   (`test_levels: []`). Verificação manual. Não há infra de teste montada no projeto e um rename
   não tem lógica pura a testar sem cair em "teste de mentira" (§5.4).

## Tabela de mapeamento (regra de substituição)

| De | Para |
|----|------|
| `GuiaGoals` | `Mirantes.Live` |
| `GuiaGoals Dashboard` | `Mirantes.Live Dashboard` |
| `guia-goals` / `guia-goals1` (slug técnico/repo/commit) | `mirantes.live` |
| `guiagoals.dev` / `guiagoals.com` (domínios) | `mirantes.live` |
| `admin@guiagoals.dev` | `admin@mirantes.live` |
| `cliente@guiagoals.dev` | `cliente@mirantes.live` |

> Mecânica e previsível: troca o token de marca preservando as palavras ao redor
> (ex. o sufixo " Dashboard" e a estrutura dos subdomínios `api.`/`cdn.`/`auth.`/`db.`/`ws.`).

## Mudanças de schema

**Nenhuma.** Rename de branding não toca Prisma/Postgres/Redis (estrutura).

## Arquivos a alterar

### A) UI / branding visível (código)
- `src/app/layout.tsx` (L27) — `title: "GuiaGoals"` → `"Mirantes.Live"`.
- `src/app/login/page.tsx` (L5/L14/L29) — `<title>` "Entrar — …", wordmark e rodapé `© 2025 …`.
- `src/components/layout/sidebar.tsx` (L61) — wordmark da sidebar.
- `src/app/dashboard/page.tsx` (L11) — `title: "Visão Geral — …"`.
- `src/app/dashboard/metas/page.tsx` (L7) — `title: "Metas — …"`.
- `src/app/dashboard/metas/nova/page.tsx` (L6) — `title: "Nova Meta — …"`.
- `src/app/dashboard/timeline/page.tsx` (L7) — `title: "Timeline — …"`.
- `src/app/dashboard/monitoramento/page.tsx` (L20) — `title: "Monitoramento — …"`.
- `src/app/dashboard/configuracoes/page.tsx` (L17) — `title: "Configurações — …"`.
- `src/components/configuracoes/profile-cards.tsx` (L143/L153/L156) — nome do projeto
  ("GuiaGoals Dashboard" → "Mirantes.Live Dashboard") e repo
  ("devlucasemiliano/guia-goals" → "devlucasemiliano/mirantes.live").

### B) Ponto central — snapshot da home
- `src/lib/home-snapshot.ts` (L20 fallback / L29 build) — `projectName`:
  `"GuiaGoals"` → `"Mirantes.Live"` (fallback) e `"GuiaGoals Dashboard"` → `"Mirantes.Live Dashboard"` (build).

### C) Mock / seed (domínios + emails de exemplo)
- `src/lib/mock-data.ts` (L18 email, L22 name, L206/L251 títulos de commit, L312/L334/L345 targets).
- `prisma/seed.ts` (L12 admin, L14 cliente) — emails de dev. **Ver "Consequências" abaixo.**

### D) Manifestos / config
- `package.json` (L2) — `"name": "guia-goals1"` → `"mirantes.live"`.
- `package-lock.json` (L2 e L8) — campo `name`.
- `bun.lock` (L6) — campo `name`.
- `.env.example` (L1) — comentário de cabeçalho.

> Editar só o campo `name` (metadado de topo) dos lockfiles é seguro; o próximo
> `npm install` / `bun install` reconcilia. Rodar o install é opcional (recomendado p/ limpeza).

### E) Docs-fonte
- `.docs/PRD.md` (L1) e `.docs/SPEC.MD` (L1) — sufixo `(GuiaGoals)` no título.
- `.specs/002-paginas-frontend.md` (L9) — título.
- `.specs/003-auth-seed.md` (L163–L164) — strings de marca na nota de verificação (descritivas).

### F) Design — `desing.pen` (via Pencil MCP, **nunca** Read/Grep)
Ocorrências a trocar: wordmark `GuiaGoals` (×8), rodapé `© 2025 GuiaGoals…`, `GuiaGoals Dashboard`
(×3), `github.com/lucas/guia-goals`, e domínios `api.`/`db.`/`auth.`/`cdn.`/`ws.`.guiagoals.com →
`…mirantes.live`. **Abordagem:** `get_editor_state(include_schema:true)` → `batch_get` dos nós de
texto → `batch_design` para reescrever `content` → conferir com `get_screenshot`/`snapshot_layout`.
Os IDs exatos dos nós são resolvidos na implementação (pós-`/clear`).

## Consequências / pontos de atenção (importante)

1. **Credenciais de dev mudam.** Trocar os emails do `prisma/seed.ts` significa que, após
   `npm run db:reset` (ou `db:seed`), o login passa a ser **`admin@mirantes.live`** /
   **`cliente@mirantes.live`** (senhas inalteradas). Os emails antigos param de funcionar.
   É necessário **re-semear**.
2. **Pasta no disco (`…/guia-goals`)** — **não** será renomeada automaticamente: é o diretório de
   trabalho da sessão; renomear por dentro quebraria os caminhos. Passo **manual** do humano
   (fechar editor → renomear pasta → reabrir). Fora do escopo automatizado.
3. **Repo no GitHub** — renomear o repositório real é ação no GitHub (Settings → Rename). Aqui só
   atualizamos as **referências exibidas**. Manual.
4. **`.env` (não versionado)** — não tocado (segredos). Só o `.env.example` (comentário).

## Impacto em PRD/SPEC e DOC.md

- **PRD/SPEC:** só o sufixo de marca no título (L1). Sem mudança de comportamento.
- **DOC.md:** nenhum `DOC.md` embute a string de marca (descrevem **comportamento**, não branding),
  então a troca de strings **não os dessincroniza** — permanecem corretos.
- **Backfill de DOC.md (desvio §2.1/§2.3 — consciente):** algumas pastas tocadas só por troca de
  `<title>` não têm `DOC.md` (`src/app/login`, `…/metas`, `…/metas/nova`, `…/timeline`,
  `…/monitoramento`, `src/components/configuracoes`). **Não** serão criados nesta task — criar 6
  `DOC.md` por causa de uma string de título é desproporcional ao rename. Fica como backfill
  separado, **consistente com a 003** ("backfill de DOC.md em pastas não tocadas = fora de escopo").

## Desenho dos testes

**Nenhum** (decisão §4 acima). Verificação **manual** após `/clear` + implementação:

1. `npm run db:reset` (re-semeia com os novos emails) → `npm run dev`.
2. Home `/`: mostra **"Mirantes.Live Dashboard"** + selo AO VIVO + timestamp. Apagar a chave
   `home:snapshot` no Redis → **fallback "Mirantes.Live"** (sem selo). Re-seed → restaura.
3. Login com **`admin@mirantes.live`** → sidebar mostra **"Mirantes.Live"**; títulos de aba
   "… — Mirantes.Live"; Configurações mostra "Mirantes.Live Dashboard" e
   "devlucasemiliano/mirantes.live".
4. Conferência visual de login/dashboard via **Playwright MCP**.
5. `desing.pen`: conferência visual via **Pencil `get_screenshot`** (sem strings antigas).
6. `npm run lint` (Biome) e `npm run typecheck` (tsc) **verdes**.

## Critérios de pronto

- Busca global por `GuiaGoals` / `guia-goals` / `guiagoals` **zerada** no código, docs e mock/seed.
- `package.json` + lockfiles com `name = "mirantes.live"`.
- Re-seed funciona; login com os novos emails funciona; home mostra a nova marca (chave **e** fallback).
- `desing.pen` sem o nome/ domínios antigos (verificado via Pencil).
- Biome e `tsc` verdes.
- PRD/SPEC/.specs e os `DOC.md` tocados consistentes (sem desync).
- Spec 004 marcada **`done`** (atualizada se divergir).

## Estado da implementação (2026-06-16) — concluída (com follow-up do .pen)

Rename **verificado** em todas as camadas de código/config/docs/mock/seed: busca global por
`GuiaGoals` / `guia-goals` / `guiagoals` **zerada** fora da própria spec. Confirmados:
UI (layout/login/sidebar + `<title>` de todas as telas), `home-snapshot.ts`, `mock-data.ts`,
`prisma/seed.ts` (`admin@mirantes.live` / `cliente@mirantes.live`), `package.json` +
`package-lock.json` + `bun.lock` (`name = "mirantes.live"`), `.env.example`, `.docs/PRD.md`,
`.docs/SPEC.MD` e títulos das `.specs`.

**Pendência (follow-up manual) — design `desing.pen` (§F).** NÃO foi verificado/reescrito
nesta passada: o **app Pencil não estava em execução** (`get_editor_state`/`batch_get`
retornaram "transport not connected"). Quando o Pencil estiver aberto, executar §F:
`get_editor_state(include_schema:true)` → `batch_get` dos nós de texto com a marca/domínios
antigos → `batch_design` reescrevendo o `content` → conferir com `get_screenshot`. Até lá, o
`.pen` pode conter o nome/domínios antigos. Tudo o mais (código, docs, dados) está renomeado.

`status` → **`done`** (rename de código/docs/dados completo; `.pen` como follow-up).

## Fora de escopo

- Rename da **pasta no disco** e do **repo no GitHub** (manuais — ver Consequências).
- **Centralizar** a marca numa constante (`src/lib/brand.ts` com `APP_NAME`/tagline) — melhoria
  futura que tornaria o próximo rename um único arquivo; **não** incluída para manter o diff mínimo
  e fiel ao pedido.
- **Backfill** dos `DOC.md` ausentes (acima).
- Montar **infra de teste** (Vitest/Playwright/containers).
