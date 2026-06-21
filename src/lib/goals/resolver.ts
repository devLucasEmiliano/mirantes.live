// Resolver determinístico commit→meta (spec 013) — PURO (sem I/O). É o ÚNICO caminho de atribuição
// (o classificador LLM foi removido na spec 016). Precedência: keyword (M-12 / meta #12) > branch
// (commit na branch vinculada, ou merge cujo título cita a branch) > vínculo manual.

export interface CandidateGoal {
  id: string;
  shortCode: string;
  title: string;
  description?: string | null;
}

export interface DeterministicMatch {
  goalId: string;
  method: "keyword" | "branch" | "manual";
}

export interface ResolverCommit {
  message: string;
  branch: string;
  isMerge: boolean;
}

export interface ResolverContext {
  candidates: CandidateGoal[];
  branchLinks: { branchName: string; goalId: string }[];
  manualGoalId?: string | null;
}

const KEYWORD_PATTERNS = [/\bM-(\d+)\b/i, /\bmeta #(\d+)\b/i];

function matchKeyword(
  message: string,
  candidates: CandidateGoal[],
): string | null {
  for (const re of KEYWORD_PATTERNS) {
    const m = message.match(re);
    if (!m) continue;
    const code = `M-${m[1]}`.toUpperCase();
    const cand = candidates.find((c) => c.shortCode.toUpperCase() === code);
    if (cand) return cand.id;
  }
  return null;
}

function matchBranch(
  commit: ResolverCommit,
  branchLinks: { branchName: string; goalId: string }[],
): string | null {
  for (const link of branchLinks) {
    if (link.branchName === commit.branch) return link.goalId;
    // Merge cujo título cita a branch (ex.: "Merge … from o/feature-login").
    if (commit.isMerge && commit.message.includes(link.branchName)) {
      return link.goalId;
    }
  }
  return null;
}

export function resolveDeterministic(
  commit: ResolverCommit,
  ctx: ResolverContext,
): DeterministicMatch | null {
  const keyword = matchKeyword(commit.message, ctx.candidates);
  if (keyword) return { goalId: keyword, method: "keyword" };

  const branch = matchBranch(commit, ctx.branchLinks);
  if (branch) return { goalId: branch, method: "branch" };

  if (ctx.manualGoalId) return { goalId: ctx.manualGoalId, method: "manual" };

  return null;
}
