---
id: 006
title: Configurações — ajustes visuais (rename, remover Exportar Timeline, uptime card)
status: done         # draft | approved | tests-red | done
test_levels: []      # Mudança puramente visual/textual de JSX — mesmo padrão das specs 002, 004 e 005.
                     #    Asserir texto/ordem de JSX estático = "teste de mentira" (§5.4). Verificação visual.
created: 2026-06-16
---

# 006 — Configurações: ajustes visuais

## Objetivo

Limpeza visual da tela `/dashboard/configuracoes`, sem tocar dados, lógica ou autorização:

1. Renomear o heading **"Configurações do Projeto" → "Configurações de Projetos"**.
2. Remover o atalho **"Exportar Timeline"** do card *Relatórios & Exportação* (sobram PDF e CSV).
3. No card *Monitoramento de Uptime*: **remover a URL/target exibida sob cada serviço** e
   **travar o badge de status** para não vazar para fora do card (o "Online" da linha
   *Autenticação* vazava porque a URL longa empurrava o badge).

Mudança **puramente de apresentação**. Não mexe em `mockServices`, nem no fluxo admin
(`requireAdmin`), nem torna funcional o botão "Adicionar Serviço" (isso é a Spec 009).

## Decisões aprovadas pelo humano (registro CLAUDE.md §1) — neste chat

- **Ordem do trabalho:** visual primeiro (esta spec); features funcionais (Perfil, Projetos,
  Monitoramento) entram em specs próprias depois (007+).
- **"Adicionar Serviço" por projeto** e demais funcionalidades ficam **fora** desta spec.
- Interpretação do pedido sobre o uptime: "remover o link abaixo do serviço" = remover a
  linha de `target`; "deixar o online fixo" = badge com `shrink-0` (não vaza).

## Arquivos a alterar

- `src/components/configuracoes/tools-cards.tsx`
  - `ReportsCard`: remover o 3º item de `actions` ("Exportar Timeline"); remover `Clock3` do
    import `lucide-react` (passa a ser import morto).
  - `UptimeMonitoringCard`: remover o `<span>` que renderiza `{service.target}`; adicionar
    `min-w-0` ao grupo esquerdo e `shrink-0` ao grupo de status à direita.
  - `ProjectSettingsCard`: heading e comentário JSDoc → "Configurações de Projetos".
- `src/components/configuracoes/DOC.md` — **criar** (pasta hoje sem DOC.md; é tocada nesta
  task — CLAUDE.md §2.1/§2.3).

## Mudanças de schema

**Nenhuma.**

## Impacto em PRD/SPEC e DOC.md

- **PRD/SPEC:** nenhum. Remover "Exportar Timeline" e a URL do card não contraria o SPEC
  (eram elementos de mock). O monitoramento real e a noção "por projeto" são tratados nas
  specs 008/009, que aí sim atualizam PRD/SPEC.
- **DOC.md:** criar `src/components/configuracoes/DOC.md`. Gap pré-existente sinalizado (fora
  de escopo): falta também `src/components/DOC.md`.

## Desenho dos testes

**Nenhum** (`test_levels: []`). São edições de JSX estático (texto, remoção de um item de
array, classes Tailwind de layout): não há regra de cálculo, Route Handler, worker ou Pub/Sub.
Um teste sobre texto literal ou classes seria "teste de mentira" (§5.4) — espelha 002/004/005.
Nenhum teste existente cobre esta tela.

Verificação **manual** (ver "Critérios de pronto").

## Critérios de pronto

- Heading "Configurações de Projetos"; ReportsCard sem "Exportar Timeline" (só PDF + CSV).
- Uptime card sem a URL sob cada serviço; badge "Online" fixo à direita, sem vazar (conferir a
  linha "Autenticação").
- Nenhum import morto (`Clock3` removido).
- Biome (lint + format) e `tsc --noEmit` verdes.
- `src/components/configuracoes/DOC.md` criado.
- Spec 006 marcada **`done`**.

## Fora de escopo

- Tornar funcionais Perfil, Senha, Projetos, Monitoramento (specs 007–009).
- "Adicionar Serviço"/"Adicionar Projeto" funcionais.
- Exportações PDF/CSV reais (não pedidas).
