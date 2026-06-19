---
id: 015
title: MCP de Metas opera no "projeto atual" (por repo/nome, auto via git remote) + ref por short code
status: draft        # draft | approved | tests-red | done
test_levels: [unit, integration]
created: 2026-06-19
---

# 015 — MCP de Metas no projeto atual (auto git) + ref por short code + descoberta

## Objetivo

Tornar o servidor MCP de Metas (spec 013) **natural de usar dentro de um repositório**. Hoje
toda tool exige `projectId` **UUID** cru e referencia metas só por `goalId` UUID. Passa a:

1. **Descobrir o "projeto atual" automaticamente** pelo `git remote origin` do diretório onde o
   MCP sobe (o `.mcp.json` roda `bun run mcp` com cwd = raiz do repo). Em `mirantes.live`,
   `metas_list()` / `metas_create({...})` "simplesmente funcionam", sem UUID.
2. Aceitar um **override `project`** (string: `owner/repo`, `repo` ou `name`, case-insensitive)
   em todas as tools que precisam de projeto.
3. **Referenciar metas por short code** (`M-1`) além de `goalId`, resolvido no projeto atual.
4. Adicionar a tool **`metas_projects`** (descoberta: lista `{ id, name, owner, repo }` do escopo).

Sem mudar REST/UI; é só a camada MCP + dois helpers reutilizáveis no domínio de projetos.

## Contexto e justificativa

- `src/lib/mcp/tools.ts` + `server.ts` expõem 6 tools; **todas** dependem de `projectId`/`goalId`
  UUID (`server.ts:50,63,89,115,128,148`). Não existe resolução por nome/repo — só
  `getProject(id)` (`projects.ts:116`).
- O `Project` tem `name/owner/repo` com `@@unique([userId, owner, repo])`
  (`prisma/schema.prisma:75`); `repo` **não** é único global, mas `owner/repo` identifica bem.
  O MCP roda em escopo **admin** (token de serviço), então a resolução varre todos os projetos
  do escopo — daí o tratamento de `ambiguous`.
- O MCP é subprocesso stdio lançado pelo `.mcp.json` (cwd = repo), então `process.cwd()` +
  `git remote get-url origin` → `owner/repo` é forma confiável de inferir "onde estamos", e casa
  com `Project.owner/repo`.
- Reuso de padrões existentes: helper **puro** + função **I/O** (espelha
  `pickSelectedProject`/`resolveSelectedProject` em `src/lib/projects/select.ts:13,29`); o service
  de metas segue o **único portão Postgres** (`goals/service.ts`).

## Dependência de ordem (CLAUDE.md §5.5)

Depende do harness verde da 013 (MCP/service/Postgres reais). Faseado: unit (puros) → integração
(tools no Postgres real). Sem e2e (MCP é stdio, não-browser).

## Arquivos a criar / alterar

### Domínio de projetos
- **Criar `src/lib/projects/ref.ts`** (puro) — `matchProjectRef(projects, ref)` + tipo
  `MatchProjectResult`.
- **Alterar `src/lib/projects.ts`** — `findProjectByRef(scope, ref)` (carrega `listProjects` +
  delega ao puro).
- **Alterar `src/lib/goals/service.ts`** — `findGoalIdByShortCode(scope, projectId, shortCode)`
  (resolve `(projectId, shortCode)` escopado; mantém o portão Postgres das metas).

### MCP
- **Criar `src/lib/mcp/project-context.ts`** — `parseGitRemote` (puro), `detectCurrentRepo`
  (I/O git), `resolveProjectId(scope, override?)`.
- **Alterar `src/lib/mcp/tools.ts`** — `metasList`/`metasCreate`/`metasUpdate`/`metasArchive`/
  `metasLinkBranch`/`metasLinkCommit` resolvem projeto (override→git) e meta (goalId|shortCode);
  novo `metasProjects(scope)`.
- **Alterar `src/lib/mcp/server.ts`** — schemas: `project?`/`shortCode?`, `goalId` opcional;
  registrar `metas_projects`; atualizar descrições.

### DOC.md (CLAUDE.md §2)
- **Alterar** `src/lib/mcp/DOC.md`, `src/lib/projects/DOC.md`, `src/lib/goals/DOC.md`,
  e `src/lib/DOC.md` (se mencionar arquivos do domínio).

### Testes
- **Criar** `tests/unit/projects-ref.test.ts`, `tests/unit/mcp-git-remote.test.ts`.
- **Alterar** `tests/integration/goals-mcp.test.ts` (novos casos por ref/short code/projects).

## Contratos

### `src/lib/projects/ref.ts` (puro)
```ts
export interface ProjectRefLike { name: string; owner: string; repo: string; }
export type MatchProjectResult<P extends ProjectRefLike> =
  | { ok: true; project: P }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "ambiguous"; matches: P[] };

// Precedência (case-insensitive, trim): "owner/repo" exato → "repo" exato → "name" exato.
// 1 match no 1º nível que casar → ok. >1 no mesmo nível → ambiguous. Nenhum em nenhum → not_found.
export function matchProjectRef<P extends ProjectRefLike>(
  projects: P[], ref: string,
): MatchProjectResult<P>
```

### `src/lib/projects.ts`
```ts
export async function findProjectByRef(
  scope: Scope, ref: string,
): Promise<MatchProjectResult<Project>>   // listProjects(scope) → matchProjectRef
```

### `src/lib/goals/service.ts`
```ts
export async function findGoalIdByShortCode(
  scope: Scope, projectId: string, shortCode: string,
): Promise<string | null>   // where {projectId, shortCode, deletedAt:null, ...goalOwnerWhere}
```

### `src/lib/mcp/project-context.ts`
```ts
export function parseGitRemote(url: string): { owner: string; repo: string } | null
//   git@github.com:o/r.git | https://github.com/o/r(.git) | ssh://git@github.com/o/r.git
export function detectCurrentRepo(cwd?: string): { owner: string; repo: string } | null
//   execFileSync("git", ["remote","get-url","origin"], {cwd}) → parseGitRemote; erro → null
export async function resolveProjectId(scope: Scope, override?: string): Promise<string | null>
//   override → findProjectByRef(scope, override)
//   senão detectCurrentRepo() → findProjectByRef(scope, `${owner}/${repo}`)
//   ambiguous/not_found → throw Error legível (lista candidatos); sem projeto resolvível → null
```

### `src/lib/mcp/tools.ts` (inputs)
```ts
metasList(scope, { project? })                       // resolve; sem projeto → lista todo o escopo
metasCreate(scope, { project?, title, dueDate, ... })// projectId resolvido (erro se não resolver)
metasUpdate(scope, { project?, goalId?, shortCode?, ...patch })
metasArchive(scope, { project?, goalId?, shortCode? })
metasLinkBranch(scope, { project?, goalId?, shortCode?, branchName })
metasLinkCommit(scope, { project?, goalId?, shortCode?, commitSha })
metasProjects(scope): Promise<{ id; name; owner; repo }[]>
// helper: resolveGoalId(scope, {goalId?, shortCode?, projectId}) — goalId direto OU shortCode→id
```

## Impacto em PRD/SPEC

- **`.docs/SPEC.MD` §13 (MCP server)**: documentar resolução do projeto atual (git remote +
  override `project`), ref de meta por short code e a tool `metas_projects`.
- PRD não muda (comportamento de produto idêntico; é ergonomia de tooling).

## Desenho dos testes

**Infra real (§5.3):** Postgres real na integração; o **único externo é o git** → coberto só no
unit puro `parseGitRemote` (não dá para semear `origin` em CI). Na integração testa-se o caminho
**`override`** de `resolveProjectId` (sem git). `MCP_SERVICE_TOKEN` já vem do `vitest.config`.

**Passo vermelho (§5.4):** criar `ref.ts`/`project-context.ts`/`findGoalIdByShortCode` como
sentinelas (`matchProjectRef`→`{ok:false,error:"not_found"}`, `parseGitRemote`→`null`,
`findGoalIdByShortCode`→`null`) e deixar as novas tools ignorando `project`/`shortCode` →
asserções concretas **falham** → `tests-red` → implementar até verde sem alterar os testes.

### Unit — `tests/unit/projects-ref.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { matchProjectRef } from "@/lib/projects/ref";

const P = (over: Partial<{ id: string; name: string; owner: string; repo: string }>) => ({
  id: over.id ?? "id", name: over.name ?? "n", owner: over.owner ?? "o", repo: over.repo ?? "r",
});

describe("matchProjectRef", () => {
  const projects = [
    P({ id: "1", name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" }),
    P({ id: "2", name: "Outro", owner: "acme", repo: "site" }),
  ];
  it("owner/repo exato", () => {
    const r = matchProjectRef(projects, "devlucasemiliano/mirantes.live");
    expect(r.ok && r.project.id).toBe("1");
  });
  it("repo sozinho", () => {
    const r = matchProjectRef(projects, "site");
    expect(r.ok && r.project.id).toBe("2");
  });
  it("name", () => {
    const r = matchProjectRef(projects, "Mirantes");
    expect(r.ok && r.project.id).toBe("1");
  });
  it("case-insensitive + trim", () => {
    const r = matchProjectRef(projects, "  MIRANTES.LIVE ");
    expect(r.ok && r.project.id).toBe("1");
  });
  it("precedência: owner/repo vence name", () => {
    const tricky = [
      P({ id: "a", name: "x/y", owner: "o", repo: "r1" }),
      P({ id: "b", name: "ignored", owner: "x", repo: "y" }),
    ];
    const r = matchProjectRef(tricky, "x/y");
    expect(r.ok && r.project.id).toBe("b"); // casa owner/repo antes de name
  });
  it("nada casa → not_found", () => {
    expect(matchProjectRef(projects, "zzz")).toEqual({ ok: false, error: "not_found" });
  });
  it("dois com o mesmo repo → ambiguous", () => {
    const dup = [P({ id: "1", repo: "dup" }), P({ id: "2", repo: "dup" })];
    const r = matchProjectRef(dup, "dup");
    expect(r.ok).toBe(false);
    if (!r.ok && r.error === "ambiguous") expect(r.matches.map((p) => p.id)).toEqual(["1", "2"]);
    else throw new Error("esperava ambiguous");
  });
});
```

### Unit — `tests/unit/mcp-git-remote.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { parseGitRemote } from "@/lib/mcp/project-context";

describe("parseGitRemote", () => {
  it("https com .git", () =>
    expect(parseGitRemote("https://github.com/devlucasemiliano/mirantes.live.git"))
      .toEqual({ owner: "devlucasemiliano", repo: "mirantes.live" }));
  it("https sem .git", () =>
    expect(parseGitRemote("https://github.com/o/r"))
      .toEqual({ owner: "o", repo: "r" }));
  it("ssh scp-like", () =>
    expect(parseGitRemote("git@github.com:o/r.git"))
      .toEqual({ owner: "o", repo: "r" }));
  it("ssh:// url", () =>
    expect(parseGitRemote("ssh://git@github.com/o/r.git"))
      .toEqual({ owner: "o", repo: "r" }));
  it("lixo → null", () => expect(parseGitRemote("not a url")).toBeNull());
  it("vazio → null", () => expect(parseGitRemote("")).toBeNull());
});
```

### Integração — `tests/integration/goals-mcp.test.ts` (acrescentar)
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  metasArchive, metasCreate, metasList, metasProjects, metasUpdate,
} from "@/lib/mcp/tools";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;

async function twoProjects() {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const a = await createProject({ userId: u.id, name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" });
  const b = await createProject({ userId: u.id, name: "Outro", owner: "acme", repo: "site" });
  if (!a.ok || !b.ok) throw new Error("setup");
  return { mirantes: a.project, outro: b.project };
}

it("metasCreate por ref de projeto (sem UUID) cria no projeto certo", async () => {
  const { mirantes } = await twoProjects();
  const g = await metasCreate(ADMIN, { project: "mirantes.live", title: "Via ref", dueDate: future().toISOString() });
  expect(g.projectId).toBe(mirantes.id);
  expect(g.shortCode).toBe("M-1");
});

it("metasList por ref retorna só as metas daquele projeto", async () => {
  const { mirantes, outro } = await twoProjects();
  await metasCreate(ADMIN, { project: "mirantes.live", title: "do mirantes", dueDate: future().toISOString() });
  await metasCreate(ADMIN, { project: "acme/site", title: "do outro", dueDate: future().toISOString() });
  const list = await metasList(ADMIN, { project: "mirantes.live" });
  expect(list.map((m) => m.title)).toEqual(["do mirantes"]);
  expect(list.every((m) => m.projectId === mirantes.id)).toBe(true);
  expect(outro.id).not.toBe(mirantes.id);
});

it("metasUpdate por shortCode + project muda a meta certa", async () => {
  await twoProjects();
  await metasCreate(ADMIN, { project: "mirantes.live", title: "M1", dueDate: future().toISOString() });
  const updated = await metasUpdate(ADMIN, { project: "mirantes.live", shortCode: "M-1", status: "in_progress" });
  expect(updated.status).toBe("in_progress");
  expect((await db.goal.findUniqueOrThrow({ where: { id: updated.id } })).status).toBe("in_progress");
});

it("metasArchive por shortCode arquiva e some do list", async () => {
  await twoProjects();
  await metasCreate(ADMIN, { project: "mirantes.live", title: "a arquivar", dueDate: future().toISOString() });
  await metasArchive(ADMIN, { project: "mirantes.live", shortCode: "M-1" });
  expect(await metasList(ADMIN, { project: "mirantes.live" })).toHaveLength(0);
});

it("metasProjects lista os projetos do escopo", async () => {
  const { mirantes } = await twoProjects();
  const list = await metasProjects(ADMIN);
  const found = list.find((p) => p.id === mirantes.id);
  expect(found).toMatchObject({ name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" });
});

it("ref de projeto inexistente → erro", async () => {
  await twoProjects();
  await expect(metasList(ADMIN, { project: "naoexiste" })).rejects.toThrow();
});

it("goalId direto ainda funciona (compat)", async () => {
  await twoProjects();
  const g = await metasCreate(ADMIN, { project: "mirantes.live", title: "por id", dueDate: future().toISOString() });
  const up = await metasUpdate(ADMIN, { goalId: g.id, status: "done" });
  expect(up.status).toBe("done");
});
```
> Os 2 testes originais (`metasCreate + metasList` por `projectId`, `metasLinkCommit` idempotente)
> **permanecem** — `projectId`/`goalId` continuam aceitos (retrocompatível).

## Critérios de pronto

- [ ] Unit + integração verdes (vistos vermelhos antes); ordem §5.5.
- [ ] `projectId`/`goalId` antigos continuam funcionando (testes originais passam).
- [ ] `metas_list()` sem args usa o projeto do git; override `project` e `shortCode` funcionam.
- [ ] `metas_projects` registrada e respondendo.
- [ ] Biome + `tsc --noEmit` limpos; `DOC.md` atualizados; SPEC §13 atualizada.
- [ ] Spec marcada `done` (atualizada se divergiu).

## Fora de escopo

- `MCP_DEFAULT_PROJECT` por env (git auto + override cobrem).
- URL completa do GitHub / múltiplos remotes (só `origin`).
- REST `/api/goals*` e UI (inalterados).
- MCP HTTP/remoto e tokens por-usuário (seguem fora, como na 013).
```
