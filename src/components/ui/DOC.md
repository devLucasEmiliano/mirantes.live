# src/components/ui

## Propósito
Primitivos de UI do **shadcn/ui** — blocos reutilizáveis e sem opinião de domínio
(estilizados com Tailwind + tokens do design). Base sobre a qual os componentes de
domínio (`shared/`, `metas/`, …) são montados.

## Estrutura
Componentes avulsos, um por arquivo, no padrão shadcn (cada um exporta o componente e,
quando aplicável, suas partes compostas).

## Arquivos
Primitivos gerados via shadcn (CLAUDE.md §0): `avatar.tsx`, `badge.tsx`, `button.tsx`,
`card.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`, `select.tsx`,
`separator.tsx`, `switch.tsx`, `tabs.tsx`, `textarea.tsx`, `tooltip.tsx`.

Cada arquivo exporta o(s) componente(s) shadcn correspondente(s); os compostos
(ex. `dropdown-menu`, `select`, `tabs`) exportam também suas subpartes
(`*Trigger`, `*Content`, `*Item`, …). Dependem de `@/lib/utils` (`cn`) e dos primitivos
Radix subjacentes.

## O que NÃO vai aqui
- **Sem lógica de negócio nem dados de domínio** — primitivos são genéricos; conhecimento
  de Meta/Service/Evento mora em `shared/` e nas pastas de domínio.
- **Sem fetch, banco ou segredos.**
- **Não editar à mão fora do padrão shadcn** sem necessidade — manter compatível com o
  gerador para futuras atualizações.
