---
id: 023
title: UI de Equipes — busca no lugar de dropdown + card na coluna da conta
status: done         # draft | approved | tests-red | done
test_levels: [unit, e2e]
created: 2026-07-30
---

# 023 — UI de Equipes: busca e layout

## Objetivo

Melhorar a **UI** da gestão de Equipes entregue na spec 022, sem tocar em domínio, schema ou API:

1. Mover o card **Equipes** para dentro da coluna esquerda de `/dashboard/configuracoes`,
   logo abaixo de **Alterar Senha**.
2. Trocar os dois `<select>` (membro, projeto) por **busca + lista clicável**, no padrão do
   seletor de repositórios de `/dashboard/integracoes`.
3. Sinalizar, na busca de projetos, quando o projeto já pertence a **outra** equipe.

Nada muda em `src/lib/teams.ts` nem em `/api/teams/*`. É UI pura + um helper puro novo.

## Contexto e justificativa

Estado atual (commit `fa915cf`, spec 022):

- `src/app/dashboard/configuracoes/page.tsx:89` — `<TeamsManagerCard>` fica **fora** do bloco de
  2 colunas, full-width abaixo dele. Como a coluna direita tem 4 cards (Relatórios, Uptime,
  Projeto, Danger Zone) e a esquerda só 2, sobra um vazio grande ao lado de Alterar Senha e o
  card de Equipes é empurrado para o fim da página.
- `src/components/configuracoes/teams-manager.tsx:286` e `:353` — `<select>` nativo + botão
  "Adicionar"/"Atribuir" (2 passos). Sem busca: com muitos usuários/projetos vira rolagem cega
  dentro do dropdown nativo.
- `teams.ts:107` (`assignProject`) é um `UPDATE project.teamId` — atribuir um projeto que já é de
  outra equipe **move** silenciosamente. A UI de hoje não dá nenhum sinal disso.

O padrão-alvo já existe e está validado no produto: `projects-manager.tsx:639-706` (input com
lupa + lista rolável `max-h-64` + clique na linha adiciona).

### Decisões tomadas com o humano (registro CLAUDE.md §1, chat de 2026-07-30)

1. **Seletor**: busca + lista, **1 clique adiciona**. Some o botão "Adicionar" separado.
2. **Layout**: `<TeamsManagerCard>` vira o 3º card da **coluna esquerda** (abaixo de
   `PasswordForm`). Não é full-width e a página **não** vira coluna única.
3. **Densidade**: dentro da equipe expandida, cada picker fica **escondido atrás de um link**
   ("+ Adicionar membro" / "+ Atribuir projeto"), no estilo do "Adicionar manualmente" de
   Integrações. Sempre-aberto deixaria a equipe expandida alta demais na coluna estreita.
4. **Conflito de equipe**: projeto de outra equipe **aparece** na lista com badge
   `em {nome da equipe}`; clicar move (comportamento já existente da API).
5. **Arquitetura**: extrair um `<SearchPicker>` genérico e quebrar `teams-manager.tsx`.
   **Fora de escopo**: refatorar o repo picker de `projects-manager.tsx` para usar o
   `<SearchPicker>` — é a mesma UI e seria tentador, mas mexeria no e2e da spec 010 sem
   necessidade. Fica registrado como pendência.

## Impacto em PRD/SPEC

**Nenhum.** Não muda comportamento de produto, papéis, dados ou API — só apresentação. PRD §9 já
lista "Equipes" como conteúdo da tela de Configurações e segue verdadeiro.

## Dependência de ordem (CLAUDE.md §5.5)

Depende da spec 022 (`done`). Não bloqueia nada.

## Restrição técnica herdada da spec 022

O helper puro **não pode** morar em `src/lib/teams.ts`: esse arquivo importa `@/lib/db` → `pg`, e
um Client Component importando de lá arrasta Prisma para o bundle do browser
(`Module not found: net/tls` — bug já documentado na divergência da spec 022). Por isso o novo
`src/lib/teams-filter.ts` é **puro**: sem `@/lib/db`, sem React, sem `"use server"`.

Pelo mesmo motivo não se cria a pasta `src/lib/teams/` ao lado de `src/lib/teams.ts` — o
`@/lib/teams` ficaria ambíguo na resolução de módulo.

## Arquivos a criar / alterar

### Criar
- **`src/lib/teams-filter.ts`** — helpers puros (`normalize`, `filterUsers`, `filterProjects`,
  `teamNameOf`).
- **`src/components/configuracoes/search-picker.tsx`** (`"use client"`) — `<SearchPicker>`
  genérico: input com lupa + lista rolável + clique na linha. Não sabe o que é usuário/projeto.
- **`src/components/configuracoes/team-row.tsx`** (`"use client"`) — `<TeamRow>`: uma equipe
  (recolhida/expandida), listas atuais de membros/projetos, os dois toggles de picker. Recebe
  handlers por props, **não faz `fetch`**.
- **`tests/unit/teams-filter.test.ts`**.

### Alterar
- **`src/app/dashboard/configuracoes/page.tsx`** — mover `<TeamsManagerCard>` para dentro da
  coluna esquerda, depois de `<PasswordForm />`; o wrapper externo volta a ser só o
  `flex gap-6` de 2 colunas (perde o `flex-col gap-6`).
- **`src/components/configuracoes/teams-manager.tsx`** — fica com `TeamsManagerCard`: `CardShell`,
  contador, form "Nova equipe", erro, e **todos** os `fetch` + `router.refresh()`. Delega a linha
  ao `<TeamRow>`. `busy: boolean` vira `busyKey: string | null`.
- **`tests/e2e/teams.spec.ts`** — reescreve o 1º teste (o `selectOption` deixa de existir).
- **`src/components/configuracoes/DOC.md`** — documenta `teams-manager.tsx` (que a spec 022
  esqueceu de registrar, CLAUDE.md §2.3), `team-row.tsx` e `search-picker.tsx`.
- **`src/app/dashboard/configuracoes/DOC.md`** — descrever o novo layout de colunas.
- **`src/lib/DOC.md`** — registrar `teams-filter.ts` e o porquê de ser separado de `teams.ts`.

### Não muda
`src/lib/teams.ts`, `src/app/api/teams/**`, `prisma/schema.prisma`,
`tests/integration/teams.test.ts`, `tests/e2e/seed-teams.ts`.

## Desenho

### `src/lib/teams-filter.ts`

```ts
export interface FilterableUser {
  id: string;
  email: string;
  name: string | null;
}
export interface FilterableProject {
  id: string;
  name: string;
  owner: string;
  repo: string;
  teamId: string | null;
}
export interface FilterableTeam {
  id: string;
  name: string;
}

/** lower-case + remove acentos (NFD) — "João" e "joao" casam. */
export function normalize(text: string): string;

/** Tira quem já é membro; filtra por nome OU email. Query vazia devolve todos os disponíveis. */
export function filterUsers(
  users: FilterableUser[],
  memberIds: string[],
  query: string,
): FilterableUser[];

/** Tira os projetos JÁ desta equipe; filtra por `owner/repo`. Projeto de OUTRA equipe fica. */
export function filterProjects(
  projects: FilterableProject[],
  teamId: string,
  query: string,
): FilterableProject[];

/** Label do badge "em {equipe}" — null quando sem equipe ou teamId órfão. */
export function teamNameOf(
  teamId: string | null,
  teams: FilterableTeam[],
): string | null;
```

### `<SearchPicker>`

```ts
interface SearchPickerProps<T> {
  /** JÁ filtrado pelo pai (`filterUsers`/`filterProjects`). */
  items: T[];
  query: string;
  onQueryChange: (query: string) => void;
  keyOf: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onPick: (item: T) => void;
  placeholder: string;
  /** Nada disponível (lista de origem vazia, com a busca em branco). */
  emptyLabel: string;
  /** A busca não achou nada. */
  noResultsLabel: string;
  /** Chave em andamento — Loader2 na linha, resto desabilitado. */
  busyKey?: string | null;
  testId: string;
}
```

**O `<SearchPicker>` é controlado**: quem guarda a `query` é o `<TeamRow>`, e é ele quem aplica o
helper puro antes de passar `items`. O picker só desenha. É isso que mantém toda a lógica de
busca em `teams-filter.ts` — testável em unit sem jsdom (o vitest aqui é `environment: "node"`,
não há RTL no projeto).

Qual dos dois vazios mostrar sai de `query.trim() === ""` → `emptyLabel`, senão `noResultsLabel`.

Visual (copiado de `projects-manager.tsx:639-706`):
- `<Search>` absoluto à esquerda, input `w-full rounded-sm border border-border-subtle
  bg-surface-primary py-2.5 pr-3.5 pl-9 text-sm ... focus:border-accent-primary`
- lista `flex max-h-64 flex-col overflow-y-auto rounded-sm border border-border-subtle`
- linha = `<button>` `flex items-center justify-between gap-2.5 border-b border-border-subtle
  px-3.5 py-2.5 text-left last:border-b-0 hover:bg-surface-elevated disabled:opacity-50`
- `<Plus className="size-3.5 text-accent-primary">` à direita, ou `<Loader2 animate-spin>`

### `<TeamRow>`

Estado local: `openPicker: "members" | "projects" | null` (um por vez) e as duas queries.

Equipe recolhida: igual hoje (`teams-manager.tsx:202-246`) — chevron, ícone `Users`, nome,
contadores, lixeira; expandida ganha `bg-accent-primary`.

Equipe expandida:
- **MEMBROS** — lista atual (nome ou email + lixeira), depois link
  `+ Adicionar membro` (`text-[12px] font-medium text-accent-primary hover:underline`). Aberto:
  `<SearchPicker>` com `filterUsers(users, memberIds, query)`. Linha: `<User>` + nome
  `text-[13px]`; quando há `name`, o email numa 2ª linha `text-[11px] text-foreground-muted`;
  sem `name`, só o email. `data-testid="team-member-option"`, `data-user-id`.
- **PROJETOS** — lista atual (`owner/repo` mono + lixeira), depois `+ Atribuir projeto`.
  Aberto: `<SearchPicker>` com `filterProjects(projects, team.id, query)`. Linha: `owner/repo`
  mono; se `teamNameOf(p.teamId, teams)` devolve nome, badge
  `rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted`
  com `em {nome}`. `data-testid="team-project-option"`, `data-project-id`.

Clique numa opção chama o handler do pai; ao voltar `ok`, o pai dá `router.refresh()` e o
`<TeamRow>` fecha o picker e limpa a query.

### Ocupado e erro

`busy: boolean` (que hoje trava o card inteiro) vira `busyKey: string | null` com formato
`member:<userId>` | `project:<projectId>` | `team:<teamId>` | `create`. Só a linha clicada mostra
`Loader2`; o picker desabilita as demais opções; o resto do card não congela.

Erro segue no rodapé do card, com mensagem por operação ("Não foi possível adicionar o membro." /
"…atribuir o projeto." / "…criar a equipe.").

## Testes

### Unit — `tests/unit/teams-filter.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  filterProjects,
  filterUsers,
  normalize,
  teamNameOf,
} from "@/lib/teams-filter";

const USERS = [
  { id: "u1", email: "renato@mirantes.live", name: "Renato Carvalho" },
  { id: "u2", email: "joao@mirantes.live", name: "João Silva" },
  { id: "u3", email: "semnome@mirantes.live", name: null },
];

const PROJECTS = [
  { id: "p1", name: "mirantes", owner: "devlucasemiliano", repo: "mirantes.live", teamId: null },
  { id: "p2", name: "api", owner: "devlucasemiliano", repo: "api", teamId: "t2" },
  { id: "p3", name: "segundo", owner: "devlucasemiliano", repo: "segundo-repo", teamId: "t1" },
];

const TEAMS = [
  { id: "t1", name: "Equipe QA" },
  { id: "t2", name: "Equipe Dev" },
];

describe("normalize", () => {
  it("baixa a caixa e remove acento", () => {
    expect(normalize("João SILVA")).toBe("joao silva");
    expect(normalize("Ção Ñ Ü")).toBe("cao n u");
  });
});

describe("filterUsers", () => {
  it("query vazia devolve todos os não-membros", () => {
    expect(filterUsers(USERS, [], "").map((u) => u.id)).toEqual([
      "u1",
      "u2",
      "u3",
    ]);
  });

  it("já-membro sai da lista mesmo casando a busca", () => {
    expect(filterUsers(USERS, ["u1"], "renato")).toEqual([]);
  });

  it("casa pelo email quando name é null", () => {
    expect(filterUsers(USERS, [], "semnome").map((u) => u.id)).toEqual(["u3"]);
  });

  it("é case-insensitive no nome", () => {
    expect(filterUsers(USERS, [], "renato").map((u) => u.id)).toEqual(["u1"]);
    expect(filterUsers(USERS, [], "CARVALHO").map((u) => u.id)).toEqual(["u1"]);
  });

  it("ignora acento nos dois lados da comparação", () => {
    expect(filterUsers(USERS, [], "joao").map((u) => u.id)).toEqual(["u2"]);
    expect(filterUsers(USERS, [], "João").map((u) => u.id)).toEqual(["u2"]);
  });

  it("busca sem resultado devolve lista vazia", () => {
    expect(filterUsers(USERS, [], "zzz")).toEqual([]);
  });
});

describe("filterProjects", () => {
  it("tira os projetos JÁ desta equipe", () => {
    expect(filterProjects(PROJECTS, "t1", "").map((p) => p.id)).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("mantém projeto de OUTRA equipe (clicar move)", () => {
    expect(filterProjects(PROJECTS, "t1", "api").map((p) => p.id)).toEqual([
      "p2",
    ]);
  });

  it("casa por owner/repo, não só pelo repo", () => {
    expect(filterProjects(PROJECTS, "t1", "devlucasemiliano/api").map((p) => p.id)).toEqual([
      "p2",
    ]);
  });

  it("query vazia com todos já atribuídos devolve vazio", () => {
    expect(filterProjects([PROJECTS[2]], "t1", "")).toEqual([]);
  });
});

describe("teamNameOf", () => {
  it("devolve o nome quando o teamId existe", () => {
    expect(teamNameOf("t2", TEAMS)).toBe("Equipe Dev");
  });

  it("null quando sem equipe", () => {
    expect(teamNameOf(null, TEAMS)).toBeNull();
  });

  it("null quando o teamId é órfão", () => {
    expect(teamNameOf("inexistente", TEAMS)).toBeNull();
  });
});
```

Passo vermelho: `@/lib/teams-filter` não existe → a suíte falha no import.

### E2E — `tests/e2e/teams.spec.ts` (1º teste reescrito)

```ts
test("admin gerencia equipe: cria, busca membro e atribui projeto", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByTestId("team-name-input").fill("Equipe QA E2E");
  await page.getByTestId("team-create").click();

  const row = page.getByTestId("team-row").filter({ hasText: "Equipe QA E2E" });
  await expect(row).toBeVisible();
  await row.getByTestId("team-row-toggle").click();

  // Membro: o picker começa fechado; abre pelo link.
  await expect(row.getByTestId("team-member-search")).toHaveCount(0);
  await row.getByTestId("team-member-picker-open").click();
  await expect(row.getByTestId("team-member-search")).toBeVisible();

  // A busca precisa REALMENTE filtrar: com "membro" sobra só o usuário semeado.
  await row.getByTestId("team-member-search").fill("membro");
  await expect(row.getByTestId("team-member-option")).toHaveCount(1);
  await expect(row.getByTestId("team-member-option")).toContainText(
    "Membro Equipe",
  );
  await row.getByTestId("team-member-option").click();

  await expect(row.getByTestId("team-member-row")).toContainText(
    "Membro Equipe",
  );
  // Adicionado some da busca (não dá para adicionar duas vezes).
  await row.getByTestId("team-member-picker-open").click();
  await row.getByTestId("team-member-search").fill("membro");
  await expect(row.getByTestId("team-member-option")).toHaveCount(0);

  // Projeto: mesma mecânica.
  await row.getByTestId("team-project-picker-open").click();
  await row.getByTestId("team-project-search").fill("segundo");
  await expect(row.getByTestId("team-project-option")).toHaveCount(1);
  await row.getByTestId("team-project-option").click();

  await expect(row.getByTestId("team-project-row")).toContainText(
    "devlucasemiliano/segundo-repo",
  );
});
```

O 2º teste (`membro de equipe vê metas em somente leitura`) **não muda** — não toca em
Configurações.

Passo vermelho: os testids `team-member-picker-open` / `team-member-search` /
`team-member-option` (e os equivalentes de projeto) não existem → o teste falha no primeiro
`click()`.

### Integração — não se aplica

Nenhuma rota, nenhuma função de banco muda. `tests/integration/teams.test.ts` seguem verdes sem
alteração; inventar caso novo aqui seria teste vazio (CLAUDE.md §5.2).

### Fora de cobertura automatizada

- **Posição do card na coluna esquerda** — assertar posição de DOM é frágil e quebra a cada
  ajuste de layout. Verificação visual manual.
- **Render do badge `em {equipe}`** — o seed do e2e só tem uma equipe com projeto. O que decide o
  label é `teamNameOf`, coberto em unit; o resto é uma `<span>`. Não vale semear uma 2ª equipe só
  para isso.

## Divergências da implementação (registro §3.2)

1. **`<SearchPicker>` ganhou a prop `itemIdAttr`.** O desenho pedia `data-user-id`/`data-project-id`
   na linha da opção, mas quem renderiza o `<button>` é o picker (não o `renderItem` do pai). Em vez
   de vazar "usuário/projeto" para dentro do componente genérico, o pai passa o **nome** do atributo
   e o picker o preenche com `keyOf(item)`.
2. **O link do picker alterna o rótulo** para "Cancelar" quando aberto (mesmo `data-testid`),
   espelhando o "Ocultar entrada manual" de Integrações. O desenho só previa o rótulo de abertura.
3. **`tests/e2e/teams.spec.ts` — duas mudanças além da reescrita prevista:**
   - Nome da equipe **único por execução** (`Equipe QA E2E ${Date.now()}`). O banco e2e **não é
     truncado entre execuções** (o `global-setup` só migra + faz upsert dos seeds), então a equipe
     criada aqui sobrevive; o nome fixo do desenho fazia o locator casar 2+ linhas na 2ª execução.
   - `timeout: 30_000` nas duas asserções **pós-mutação** (linha do membro / do projeto). O padrão do
     `expect` é 5s e o `POST` cai no 1º hit da rota, que o `next dev` ainda está compilando —
     capturado no snapshot da falha como a opção `[disabled]`, sem mensagem de erro (request em voo).
4. **Infra local de teste (fora do código do produto):** `.env.test` não existia nesta máquina
   (é gitignored) e foi gerado a partir do `.env` conforme o `.env.example`. O banco `mirantes_test`
   estava com **drift**: a migration descartada `20260729222612_sistema_de_equipes` (renomeada
   durante a spec 022, existe no banco e não no repo) tinha criado `teams.owner_id NOT NULL`, o que
   fazia todo `INSERT` em `teams` estourar `P2011` e derrubava o `global-setup`. Resolvido com
   `prisma migrate reset` **no banco de teste** (autorizado no chat).

## Pendência herdada, fora do escopo desta spec

`tests/e2e/visao-geral.spec.ts:22` falha (`1/2` não encontrado) mesmo com banco limpo: `metas.spec.ts`
roda antes na mesma execução e cria a meta M-3 "Migrar banco", então o card "Metas Concluídas" vira
`1/3`. É poluição cruzada entre specs (débito das specs 013/014), independente da 023 — nenhum
arquivo tocado aqui participa daquela tela. Em execuções repetidas sem reset o mesmo acúmulo derruba
também `metas.spec.ts` (3× "Migrar banco" → strict mode violation) e `configuracoes.spec.ts` (senha
do admin trocada e não restaurada). Corrigir exige limpeza de estado no `global-setup` do e2e —
spec própria.

## Critérios de pronto

- [x] `bun run test` verde (41 arquivos, 247 testes), com `tests/unit/teams-filter.test.ts` tendo
      sido visto **vermelho** (`Cannot find package '@/lib/teams-filter'`).
- [x] `bun run test:e2e` a partir de banco limpo: **25 passaram**, 1 skip, 1 falha pré-existente
      (`visao-geral`, ver pendência acima). Os 2 testes de `teams.spec.ts` passam, e o 1º foi visto
      **vermelho** (timeout em `team-member-picker-open`, testid inexistente).
- [x] Card **Equipes** renderiza na coluna esquerda, abaixo de Alterar Senha.
- [x] Membros e Projetos usam busca; nenhum `<select>` sobra em `teams-manager.tsx`/`team-row.tsx`.
- [x] Projeto de outra equipe aparece com badge `em {equipe}`.
- [x] `bun run lint` (Biome) e `bun run typecheck` sem erro.
- [x] `DOC.md` atualizados: `src/components/configuracoes` (incl. o `teams-manager.tsx` que a
      spec 022 esqueceu), `src/app/dashboard/configuracoes`, `src/lib`.
- [x] Esta spec marcada `done`, com as divergências registradas acima.
