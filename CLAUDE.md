# CLAUDE.md
@AGENTS.md
Regras de operação para este repositório. Este arquivo governa **como** qualquer agente (Claude) deve trabalhar aqui. Leia por completo antes de qualquer ação. 

---

## 0. Stack travada (não fugir do escopo)

Toda implementação **deve** usar exclusivamente:

- **Bun** — gerenciador de pacotes **e** runtime do projeto. **Nunca usar `npm`/`npx`/`yarn`/`pnpm`** — quebram o `bun.lock`.
  - Instalar deps: `bun install`
  - Rodar binário: `bunx <bin>` (ex. `bunx prisma generate`)
  - Rodar script: `bun run <script>` (ex. `bun run dev`, `bun run db:migrate`)
  - O Prisma Client é gerado pelo script `postinstall` (`prisma generate`); o bun **não** roda postinstall de _dependências_, por isso a geração mora num script próprio do projeto. Se aparecer `Cannot find module '.prisma/client/default'`, rode `bunx prisma generate`.
- **Next.js** (App Router) — único app do projeto (não é monorepo).
- **TypeScript**.
- **Tailwind CSS** + **shadcn/ui** + **Lucide** (ícones).
- **PostgreSQL** (fonte de verdade) + **Redis** (Pub/Sub realtime / cache).
- **Biome** — lint + format.
- **Vitest** — testes unitários e de integração.
- **Playwright** — testes end-to-end.

> Não introduzir outras bibliotecas de UI, ORMs alternativos, gerenciadores de estado ou ferramentas de build sem aprovação explícita do humano registrada no chat. Se algo parecer faltar, **perguntar antes**, não improvisar.

---

## 1. Documentos-fonte: PRD e SPEC

- `PRD.md` — o que o produto faz e como se comporta.
- `SPEC.md` — como implementar (schema, API, workers, realtime).

**Regra obrigatória:** antes de **criar, alterar design, alterar código ou mudar estrutura**, sempre **ler `PRD.md` e `SPEC.md`** primeiro. Nenhuma mudança deve contradizê-los. Se a mudança exigir contrariar o PRD/SPEC, parar e alinhar com o humano antes — e, se aprovado, atualizar PRD/SPEC junto.

---

## 2. Documentação por pasta (`DOC.md`)

### 2.1 Onde
- Cada pasta dentro de `src/` (do app principal) **deve conter um `DOC.md`**, de forma **recursiva** — todo subnível tem o seu (ex. `src/app/DOC.md`, `src/app/(dashboard)/DOC.md`, `src/components/DOC.md`, etc.).

### 2.2 O que cada `DOC.md` contém
1. **Propósito** — para que serve a pasta, em 1–3 frases.
2. **Estrutura** — subpastas e como se organizam.
3. **Arquivos explicados em detalhe** — cada arquivo relevante: o que faz, o que exporta, do que depende.
4. **O que NÃO vai aqui / o que NÃO pode ser feito aqui** — limites explícitos (ex.: "nenhuma chamada direta ao banco nesta pasta", "sem lógica de negócio em componentes").

### 2.3 Quando atualizar
- **Qualquer alteração de arquivo na pasta** (criar, editar, renomear, remover) exige **atualizar o `DOC.md` daquela pasta na mesma tarefa**. O `DOC.md` nunca pode ficar defasado em relação ao conteúdo real da pasta.
- Criou uma pasta nova → cria o `DOC.md` dela imediatamente.

---

## 3. Spec-Driven Development (SDD)

Toda tarefa de criação/alteração segue este fluxo, sem pular etapas.

### 3.1 Pasta e numeração
- Planos vivem em **`.specs/`**.
- Nomenclatura **global sequencial**: `001-<slug>.md`, `002-<slug>.md`, … `00X-<slug>.md`. A numeração **não reinicia** por área — é única para o projeto inteiro (ex. `001-setup-auth.md`, `002-metas-crud.md`, `003-monitoramento-worker.md`).

### 3.2 Ciclo de vida (status no topo do arquivo)
Cada spec tem um cabeçalho com status:

```
---
id: 003
title: Monitoramento — worker de polling
status: draft        # draft | approved | tests-red | done
test_levels: [unit, integration]   # níveis aplicáveis a esta task (ver §5)
created: AAAA-MM-DD
---
```

- `draft` — plano recém-gerado, aguardando aprovação humana.
- `approved` — humano aprovou; pode implementar.
- `tests-red` — testes escritos e rodando **falhando** (passo vermelho do TDD), antes do código da feature.
- `done` — implementado e todos os testes verdes.
- Se a implementação **divergir** do plano, o arquivo `.specs/00X` **deve ser atualizado** para refletir o que foi realmente feito (não é histórico imutável; é o registro vivo da decisão final).

### 3.3 Fluxo obrigatório (plano antes do código + /clear)

Para **cada nova task**:

1. **Ler** `PRD.md`, `SPEC.md` e os `DOC.md` das pastas afetadas.
2. **Gerar o plano** em `.specs/00X-<slug>.md` com `status: draft`. O plano deve conter:
   - objetivo;
   - arquivos a criar/alterar;
   - mudanças de schema (se houver);
   - impacto em PRD/SPEC e `DOC.md` a atualizar;
   - **desenho dos testes** (ver §5): níveis aplicáveis, lista de casos com entradas/saídas esperadas e casos de borda, o que será infra real vs. stub de externo;
   - **os testes já implementados** (código), escritos para falhar antes da feature existir;
   - critérios de pronto.
3. **PARAR e pedir aprovação humana do plano** (incluindo o desenho e o código dos testes). Ao aprovar, mudar `status` para `approved`.
4. **Lembrar o humano de rodar `/clear`** (mensagem explícita: "Plano aprovado. Rode `/clear` e em seguida me peça para carregar `.specs/00X-<slug>.md`."). O `/clear` limpa o contexto para a implementação começar sem suposições acumuladas.
5. **Após o `/clear`**, com contexto limpo: **carregar `.specs/00X-<slug>.md`** (+ PRD/SPEC + DOC.md relevantes).
6. **Escrever/confirmar os testes primeiro e vê-los FALHAR** (passo vermelho). Marcar `status: tests-red`. Um teste que nunca foi visto falhando não prova nada e não é aceito.
7. **Implementar exatamente o plano aprovado** até os testes ficarem **verdes** — sem alterar os testes para forçá-los a passar (só corrigir teste se o plano em si mudar, e então atualizar a spec).
8. Ao concluir: atualizar `DOC.md` das pastas tocadas, atualizar a spec se divergiu, marcar `status: done`, rodar qualidade (§4).

> O agente nunca gera o plano e já implementa na mesma passada. A aprovação humana e o `/clear` são barreiras obrigatórias entre planejar e construir. Os testes nascem na spec, não depois do código.

---

## 5. Estratégia de testes (testes reais, sem invenção)

Testes nascem na spec (§3) e precisam **medir comportamento real**. Um teste que não pode falhar não é um teste.

### 5.1 Níveis e ferramentas
- **Unit (Vitest)** — funções puras, regras de cálculo (ex. derivação de progresso/status do pai, fórmula de Saúde, regra de atraso).
- **Integração (Vitest)** — Route Handlers, workers, acesso a banco e Pub/Sub, com **infra real** (ver 5.3).
- **E2E (Playwright)** — jornadas do usuário (login, ver dashboard, admin edita meta e cliente vê ao vivo).

### 5.2 Cobertura por task (proporcional)
- Cada spec declara em `test_levels` **apenas os níveis que fazem sentido** para aquela task. Um util puro pode ter só `unit`; um fluxo de login exige `e2e`.
- Não inventar testes vazios para níveis que não se aplicam, nem pular um nível que claramente se aplica.

### 5.3 Política de mocks — infra real
- **Postgres e Redis são reais em ambiente de teste** (container dedicado / compose de teste, ex. Testcontainers). **Proibido** substituí-los por fakes/in-memory que escondam comportamento (transações, SQL real, Pub/Sub real).
- **Só é permitido stubar o que é genuinamente externo e fora de controle**: API do GitHub e os alvos dos probes (HTTP/Docker). Mesmo assim, usar **fixtures realistas** (respostas que o serviço real devolveria), nunca dados inventados que não correspondem ao contrato real.
- Banco de teste é semeado e limpo entre testes (transação revertida ou truncate), nunca o banco de desenvolvimento/produção.

### 5.4 Anti-"teste de mentira" (regras duras)
- **Proibido** asserções triviais (`expect(true).toBe(true)`, snapshot vazio, teste sem `expect`).
- **Proibido** mockar a própria unidade sob teste ou mockar o resultado que deveria ser calculado.
- **Obrigatório** o passo vermelho: todo teste deve ter sido visto **falhando antes de passar** (estado `tests-red` na spec). Se a implementação já existe, escrever o teste e confirmar que ele falharia sem a lógica correta (ex. quebrando temporariamente a função).
- Asserções sobre **valores concretos e esperados**, não sobre "não lançou erro".
- Casos de borda do desenho são obrigatórios (ex. meta sem filhos, todos filhos done, serviço degradado vs offline, flapping abaixo do threshold).

### 5.5 Ordem sem quebra hierárquica
**Ordem de execução** (a suíte roda nesta ordem, e um nível não é considerado se o anterior quebrou):
`unit → integração → e2e`. Falha em unit barra a subida; não se "pula" para e2e verde ignorando unit vermelho.

**Ordem de implementação** (dependência entre features):
não se avança para uma feature que **depende** de outra enquanto os testes da base não estiverem **verdes**. Ex.: Timeline/SSE depende de eventos de metas; só implementar a Timeline com a base de metas testada e passando. A spec de cada task declara suas dependências e respeita a ordem do `SPEC.md` (§13 do SPEC).

---

## 6. Qualidade (antes de considerar uma task "pronta")

Uma task só está concluída quando:

- **Biome** passa sem erros (lint + format aplicados).
- Testes do(s) nível(is) declarado(s) em `test_levels` **passando** — e cada um já tendo sido visto **vermelho** antes.
- Infra de teste real usada onde a §5.3 exige; sem mocks proibidos.
- Tipos do TypeScript sem erro.
- `DOC.md` das pastas afetadas atualizados.
- Spec `.specs/00X` marcada `done` (atualizada se divergiu).

---

## 7. Convenções do app

- App único Next.js (App Router). Sem `apps/*`/`packages/*` — não tratar como monorepo a menos que o humano peça e atualize este arquivo.
- Segredos (PAT do GitHub, credenciais) **somente** em variáveis de ambiente do servidor. Nunca em código versionado, log, URL ou resposta ao cliente.
- Mutações sempre: Postgres (transação) → registra evento → publica no Redis → SSE. (ver `SPEC.md`).
- Autorização por papel (`admin`/`client`) em toda mutação e leitura sensível.
- Respeitar os limites declarados em cada `DOC.md`.

---

## 8. Checklist rápido para o agente

Antes de mexer em qualquer coisa:
- [ ] Li PRD.md e SPEC.md?
- [ ] Li o DOC.md das pastas que vou tocar?
- [ ] Gerei o plano em `.specs/00X` com status `draft`, **incluindo desenho + código dos testes**?
- [ ] Declarei `test_levels` proporcionais à task?
- [ ] Pedi aprovação humana e lembrei do `/clear`?

Após o `/clear`, antes de implementar:
- [ ] Vi os testes **falharem** (passo vermelho) e marquei `tests-red`?
- [ ] Infra real (Postgres/Redis) no teste; só externos stubados com fixtures realistas?

Depois de implementar:
- [ ] Testes verdes sem ter alterado os testes para forçá-los!
- [ ] Respeitei a ordem unit→integração→e2e e as dependências entre features?
- [ ] Atualizei os DOC.md afetados?
- [ ] Atualizei a spec se divergiu e marquei `done`?
- [ ] Biome e tipos passando?