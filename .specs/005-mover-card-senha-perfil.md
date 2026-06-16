---
id: 005
title: Configurações — mover card "Alterar Senha" para junto de "Perfil do Usuário"
status: done         # draft | approved | tests-red | done
test_levels: []      # Reordenação de UI sem lógica testável — mesmo padrão das specs 002 e 004.
                     #    Asserir a ordem de JSX estático = "teste de mentira" (§5.4). Verificação visual.
created: 2026-06-16
---

# 005 — Configurações: "Alterar Senha" junto de "Perfil do Usuário"

## Objetivo

Na tela `/dashboard/configuracoes` (admin-only), reordenar a coluna esquerda para que o card
**Alterar Senha** fique **logo abaixo** de **Perfil do Usuário**, empurrando **Projetos** para
baixo. Agrupa os dois cards de **conta do usuário** (PRD §3 — troca de senha; §9 — conta) e os
separa do card de **Projetos** (domínio de integração).

- Ordem anterior: Perfil → Projetos → Senha.
- Ordem nova: **Perfil → Senha → Projetos.**

Mudança **puramente de layout** (ordem de renderização). Não toca lógica, dados, autorização
(`requireAdmin`) nem os componentes em si.

## Decisão aprovada pelo humano (registro CLAUDE.md §0/§1) — neste chat

- Layout **empilhado** (cards um abaixo do outro), escolhido entre *empilhado* × *lado a lado*.
  O pedido "mover Alterar Senha junto ao Perfil" = adjacência na coluna vertical = Senha
  imediatamente após Perfil.

## Arquivos a alterar

- `src/app/dashboard/configuracoes/page.tsx` — mover `<PasswordCard />` para entre
  `<ProfileCard />` e `<ProjectCard />` na coluna esquerda
  (`flex min-w-0 flex-1 flex-col gap-5`). Sem mudança de imports (os três já vêm de
  `@/components/configuracoes/profile-cards`).
- `src/app/dashboard/configuracoes/DOC.md` — refino da descrição do `page.tsx`: a coluna
  esquerda agrupa os cards de conta (Perfil → Senha) acima de Projetos (§2.3).

## Mudanças de schema

**Nenhuma.**

## Impacto em PRD/SPEC e DOC.md

- **PRD/SPEC:** nenhum — não contraria PRD §3/§9 (apenas aproxima visualmente os dois cards
  de conta).
- **DOC.md:** só `configuracoes/DOC.md` (uma linha sobre ordem/agrupamento). Nenhum outro
  `DOC.md` embute a ordem dos cards.

## Desenho dos testes

**Nenhum** (`test_levels: []`). É reordenação de JSX estático: não há regra de cálculo, Route
Handler, worker ou Pub/Sub envolvido. Um teste sobre a ordem literal de dois componentes seria
"teste de mentira" (§5.4) — espelha a decisão das specs frontend 002 e 004. Nenhum teste
existente cobre esta tela, então nada é afetado.

Verificação **manual**:

1. Biome (lint + format) e checagem de tipos (tsc) **verdes** nos arquivos tocados.
2. JSX final de `page.tsx` na ordem Perfil → Senha → Projetos.
3. (Opcional) `npm run dev` → `/dashboard/configuracoes` como **admin**: coluna esquerda
   Perfil do Usuário → Alterar Senha → Projetos; coluna direita inalterada.

## Critérios de pronto

- `page.tsx` com a coluna esquerda na ordem ProfileCard → PasswordCard → ProjectCard.
- `configuracoes/DOC.md` atualizado e consistente.
- Biome e tipos verdes.
- Spec 005 marcada **`done`**.

## Fora de escopo

- Implementação real do formulário de senha (o endpoint `POST /api/auth/password` já existe
  na 003; ligar o card a ele é task própria).
- Variante **lado a lado** (descartada na decisão).
