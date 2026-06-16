---
id: 011
title: Fundo WebGL "PixelBlast" na Home pública
status: done        # draft | approved | tests-red | done
test_levels: []     # ver §"Estratégia de testes" abaixo
created: 2026-06-16
---

# 011 — Fundo WebGL "PixelBlast" na Home pública

> **Spec retroativa.** Esta task foi implementada em execução direta, a pedido do humano
> ("pode pular etapas, vamo fazer uma execução direta"), **fora** do fluxo SDD normal do
> CLAUDE.md §3 (sem passo `draft → approved → /clear → tests-red → done`). Este documento
> registra o que foi efetivamente feito, conforme §3.2 ("registro vivo da decisão final").

## Objetivo

Adicionar um **fundo decorativo animado** (efeito "PixelBlast" do React Bits, variante
JavaScript + WebGL) atrás de todo o conteúdo da Home pública (`/`, `src/app/page.tsx`),
sem alterar layout, dados ou comportamento existentes.

O efeito renderiza um padrão de pixels (dithering de Bayer sobre ruído fbm) num `<canvas>`
three.js, com fade nas bordas e fundo transparente — os pixels aparecem sobre a cor de
superfície da página, visíveis nos vãos entre os cards.

## Decisões de stack

- **Dependências novas:** `three` (0.184.0) e `postprocessing` (6.39.1), exigidas pelo
  componente. Instaladas via bun (gerenciador primário do repo: `bun.lock` + campos
  `trustedDependencies`/`ignoreScripts` no `package.json`).
- Fora da stack travada do CLAUDE.md §0, porém **aprovado explicitamente** pelo humano ao
  fornecer o componente e pedir a integração. Não introduz lib de UI, ORM, estado global nem
  build novo — é um utilitário de render WebGL isolado.

## Arquivos criados/alterados

- **Criado** `src/components/shared/pixel-blast.jsx`
  - Client Component (`"use client"`) — usa `useEffect`/`useRef` e WebGL, incompatível com SSR.
  - Vendorizado como **`.jsx`** (permitido por `allowJs: true` no `tsconfig`): é código de
    terceiros pesado em three.js; mantê-lo fora do TS estrito evita poluir o app de tipos `any`
    (o repo roda Biome com `recommended`, que inclui `noExplicitAny`).
  - Ajustes sobre o snippet original do React Bits:
    - Container com **estilos inline** (`width/height: 100%`, `position: relative`,
      `overflow: hidden`) em vez de importar `PixelBlast.css` — evita arquivo CSS extra.
    - `className`/`style` com defaults (`""`/`undefined`) para serem **opcionais** quando o
      tipo é inferido pelo `.tsx` consumidor.
    - `role="img"` adicionado ao container para o `aria-label` ser válido
      (regra `a11y/useAriaPropsSupportedByRole` do Biome).
    - **Correção de bug** do original: na atualização "quente" do efeito líquido ele fazia
      `const uStrength = t.liquidEffect; uStrength.value = liquidStrength` (atribuía `.value`
      no próprio Effect, que não existe). Corrigido para
      `t.liquidEffect.uniforms.get("uStrength")`.
- **Alterado** `src/app/page.tsx`
  - Import `PixelBlast` (default).
  - Root `<div>` ganhou `relative isolate ... overflow-hidden` (ver §"Camadas / z-index").
  - Camada de fundo `<div className="pointer-events-none absolute inset-0 -z-10">` com o
    `<PixelBlast />` configurado (props na §"Configuração atual").
- **Alterado** `src/components/shared/DOC.md`
  - Removida a afirmação "nenhum usa `"use client"`" (agora há a exceção `pixel-blast.jsx`).
  - Entrada detalhando o componente + limite ("efeito visual isolado, sem lógica de domínio").
- **Alterado** `package.json` / `bun.lock` — dependências `three` + `postprocessing`.

> `package-lock.json` foi restaurado ao original: o `bun add` o havia removido como efeito
> colateral; como o repo versiona ambos, evitou-se introduzir uma deleção não relacionada.

## Camadas / z-index (detalhe não óbvio)

Um elemento **posicionado** com `z-0` pinta *acima* de irmãos estáticos (ordem de empilhamento
CSS: conteúdo posicionado com `z-index:auto/0` vem depois do conteúdo de bloco não posicionado).
Por isso o fundo usa **`-z-10`** + **`isolate`** (`isolation: isolate`) no root:

- `position: relative` sozinho **não** cria stacking context; sem o `isolate`, o `-z-10`
  escaparia o root e pintaria atrás do próprio `bg-surface-primary` → invisível.
- Com `isolate`, o root vira stacking context: o fundo fica **acima** da cor de fundo do root
  e **abaixo** de todo o conteúdo em fluxo, sem precisar marcar cada bloco filho com `z-10`.
- `pointer-events-none` na camada: o fundo é puramente decorativo e não intercepta cliques do
  conteúdo (ripples por clique ficam desativados — coerente com `enableRipples={false}`).

A fronteira server→client é preservada: `page.tsx` segue Server Component `async` (lê o
snapshot do Redis); apenas importa e renderiza o Client Component — o WebGL nunca toca o SSR.

## Configuração atual (props do PixelBlast na Home)

```
variant="square"  pixelSize={3}      color="#626063"
patternScale={4}  patternDensity={1.25}  pixelSizeJitter={0}
enableRipples={false}
rippleSpeed={0.4} rippleThickness={0.12} rippleIntensityScale={1.5}
liquid={false}    liquidStrength={0.12}  liquidRadius={1.2}  liquidWobbleSpeed={5}
speed={0.75}      edgeFade={0.25}    transparent
```

Padrão fino de quadrados em cinza neutro (`#626063`), denso, com leve animação e fade nas
bordas. (Config anterior, descartada: diamantes em `#c2956a` com ripples.)

## Impacto em PRD/SPEC

Nenhum. É um elemento puramente visual/decorativo; não toca dados, autorização, mutações,
realtime nem o snapshot da Home descritos no PRD/SPEC.

## Estratégia de testes (`test_levels: []`)

Sem testes automatizados, **proporcional à natureza da task** (CLAUDE.md §5.2 — "apenas os
níveis que fazem sentido"):

- **Unit/Integração:** não se aplicam — não há função pura de negócio nem Route Handler/worker;
  toda a lógica é render WebGL de terceiros.
- **E2E:** não há jornada de usuário nova (nenhuma interação, rota ou estado muda). O repo
  ainda **não possui harness de testes** (Vitest/Playwright) — sua introdução está prevista na
  spec 007, que é a base correta para qualquer e2e futuro.

**Verificação manual realizada** (via Playwright MCP em `http://localhost:3000/`):

- `<canvas>` montado dentro do container `aria-label="PixelBlast interactive background"`,
  com contexto **WebGL2** ativo e dimensões > 0 (914×1039 no viewport testado).
- **0 erros** de console (warnings restantes inofensivos: deprecação de `THREE.Clock` e shim
  do React DevTools).
- Inspeção visual: padrão renderiza nos vãos ao redor dos cards; conteúdo permanece por cima
  e legível.

> Quando o harness da spec 007 existir, um smoke e2e leve pode ser adicionado: navegar para
> `/` e asseverar que existe um `canvas` com contexto WebGL dentro do container do PixelBlast.

## Critérios de pronto (todos atendidos)

- [x] `three` + `postprocessing` instalados; `package-lock.json` preservado.
- [x] `PixelBlast` renderiza como fundo `-z-10` da Home, sem quebrar layout/conteúdo.
- [x] Biome (lint+format) limpo nos arquivos tocados.
- [x] `tsc --noEmit` sem erros.
- [x] `DOC.md` de `src/components/shared` atualizado.
- [x] Verificação manual no browser: canvas WebGL ativo, 0 erros de console.
- [x] Spec marcada `done`.
