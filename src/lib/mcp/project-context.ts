// "Projeto atual" do MCP (spec 015 + 020): `detectCurrentRepo` lê o `git remote origin` do cwd e
// resolve p/ um `projectId` do escopo. No transporte HTTP (`/api/mcp`, spec 020) o git fica
// DESLIGADO via `resolveProjectId(..., { detectRepo: false })` — o repo do servidor não é o do
// cliente; a função segue existindo p/ uso futuro. `parseGitRemote` é PURO (unit). `detectCurrentRepo`
// é o ÚNICO ponto de I/O com o git externo. `resolveProjectId` delega ao domínio de projetos
// (`findProjectByRef`), nunca toca Postgres aqui.
import { execFileSync } from "node:child_process";
import { findProjectByRef, type Scope } from "@/lib/projects";

/**
 * Extrai `{owner, repo}` de uma URL de remote do GitHub, cobrindo as três formas usuais:
 * `https://github.com/o/r(.git)`, `git@github.com:o/r.git` (scp-like) e `ssh://git@host/o/r.git`.
 * Tolera `.git` final e barra final. Qualquer coisa fora do padrão → `null` (puro, sem I/O).
 */
export function parseGitRemote(
  url: string,
): { owner: string; repo: string } | null {
  const trimmed = url.trim();
  if (trimmed === "") return null;

  // scp-like: [user@]host:owner/repo(.git) — exige `:` separando host de owner.
  const scp = /^[^@\s]+@([^:/\s]+):([^/\s]+)\/(.+?)(?:\.git)?\/?$/.exec(
    trimmed,
  );
  if (scp) return { owner: scp[2], repo: scp[3] };

  // url-like: scheme://[user@]host/owner/repo(.git)
  const url2 =
    /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/\s]+@)?[^/\s]+\/([^/\s]+)\/(.+?)(?:\.git)?\/?$/.exec(
      trimmed,
    );
  if (url2) return { owner: url2[1], repo: url2[2] };

  return null;
}

/**
 * Lê o `git remote get-url origin` do diretório (default: cwd do processo MCP = raiz do repo)
 * e parseia. Sem git, sem remote `origin` ou fora de um repo → `null` (nunca lança). É o único
 * I/O externo do módulo; stderr é descartado p/ não poluir o protocolo stdio.
 */
export function detectCurrentRepo(
  cwd?: string,
): { owner: string; repo: string } | null {
  try {
    const out = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parseGitRemote(out);
  } catch {
    return null;
  }
}

/**
 * Resolve o `projectId` alvo do escopo (spec 015):
 * - `override` (string humana) → `findProjectByRef`; `ambiguous`/`not_found` → lança erro legível
 *   (o usuário pediu um projeto explícito; falhar é o correto).
 * - sem `override` → tenta o "projeto atual" via `git remote origin`. Repo não detectável → `null`
 *   (caller cai p/ todo o escopo). Repo detectado mas não cadastrado → `null` (graceful);
 *   `ambiguous` → lança (há projetos demais casando, precisa desambiguar).
 *
 * `opts.detectRepo` (spec 020): no transporte HTTP (`/api/mcp`) o git do SERVIDOR não faz sentido
 * (leria o repo do servidor, não o do cliente) → passar `false` desliga o `detectCurrentRepo()` e,
 * sem override, devolve `null` (escopo inteiro) sem nenhum I/O. Default (`undefined`/`true`) mantém
 * o comportamento do stdio. É um *seam*: cortamos a dependência em vez de stubá-la (CLAUDE §5.3).
 */
export async function resolveProjectId(
  scope: Scope,
  override?: string,
  opts?: { detectRepo?: boolean },
): Promise<string | null> {
  if (override !== undefined && override.trim() !== "") {
    const match = await findProjectByRef(scope, override);
    if (match.ok) return match.project.id;
    if (match.error === "ambiguous") {
      throw new Error(
        `Projeto ambíguo para "${override}": ${candidates(match.matches)}. Use "owner/repo".`,
      );
    }
    throw new Error(
      `Projeto "${override}" não encontrado no escopo. Use metas_projects para listar.`,
    );
  }

  if (opts?.detectRepo === false) return null;

  const repo = detectCurrentRepo();
  if (!repo) return null;
  const match = await findProjectByRef(scope, `${repo.owner}/${repo.repo}`);
  if (match.ok) return match.project.id;
  if (match.error === "ambiguous") {
    throw new Error(
      `Projeto ambíguo para "${repo.owner}/${repo.repo}": ${candidates(match.matches)}.`,
    );
  }
  return null; // repo atual não cadastrado: caller lista todo o escopo
}

function candidates(
  matches: { name: string; owner: string; repo: string }[],
): string {
  return matches.map((m) => `${m.owner}/${m.repo}`).join(", ");
}
