import type { GhCommit } from "./client";

// Mapeadores puros (unit-testáveis): convertem payloads do GitHub em linhas/strings
// do domínio. Sem I/O, sem Prisma — só transformação.

export interface MappedCommit {
  sha: string;
  message: string;
  author: string;
  /** 2+ parents no GitHub = commit de merge. */
  isMerge: boolean;
  committedAt: Date;
}

/** Estado normalizado de um workflow run, para o badge da UI. */
export type RunStatus =
  | "success"
  | "failure"
  | "cancelled"
  | "running"
  | "queued"
  | "neutral";

/**
 * Achata um commit do GitHub para a linha persistida. `message` é só o **subject**
 * (1ª linha). O autor resolve em cascata: nome git → login da conta → "desconhecido".
 */
export function mapCommit(input: GhCommit): MappedCommit {
  const subject = input.commit.message.split("\n")[0] ?? "";
  const author =
    input.commit.author.name ?? input.author?.login ?? "desconhecido";
  return {
    sha: input.sha,
    message: subject,
    author,
    isMerge: (input.parents?.length ?? 0) > 1,
    committedAt: new Date(input.commit.author.date),
  };
}

/** Texto do lote de commits p/ a Timeline. Vazio quando não há commits novos. */
export function summarizeCommitBatch(count: number, repo: string): string {
  if (count <= 0) return "";
  const noun = count === 1 ? "commit" : "commits";
  return `${count} ${noun} em ${repo}`;
}

/** Normaliza (status, conclusion) do GitHub Actions no estado do badge. */
export function deriveRunStatus(run: {
  status: string;
  conclusion: string | null;
}): RunStatus {
  if (run.status === "in_progress") return "running";
  if (run.status === "queued") return "queued";
  if (run.status === "completed") {
    switch (run.conclusion) {
      case "success":
        return "success";
      case "failure":
        return "failure";
      case "cancelled":
        return "cancelled";
      default:
        return "neutral";
    }
  }
  return "neutral";
}

/**
 * Valida o par owner/repo de um repositório GitHub: ambos não-vazios e restritos ao
 * charset permitido (alfanumérico + `.`, `_`, `-`). Sem espaços nem barras. Espelhado
 * no client (projects-manager) antes do POST.
 */
export function isValidRepoSlug(owner: string, repo: string): boolean {
  const slug = /^[A-Za-z0-9._-]+$/;
  return slug.test(owner) && slug.test(repo);
}

/**
 * Formata a variação % de commits vs. a semana anterior (card "Commits da Semana").
 * Sem nada nas duas janelas → "sem commits ainda"; semana anterior zerada e atual > 0
 * → "+100%". O sinal `-` já vem embutido em percentuais negativos.
 */
export function formatWeeklyDelta(count: number, previous: number): string {
  if (count === 0 && previous === 0) return "sem commits ainda";
  if (previous === 0) return "+100% vs semana anterior";
  const pct = Math.round(((count - previous) / previous) * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}% vs semana anterior`;
}
