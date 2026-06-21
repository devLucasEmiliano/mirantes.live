import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { syncProject } from "./sync";

// Worker de polling do GitHub (SPEC §7): a cada `intervalMs`, percorre todos os projetos
// e chama o MESMO núcleo `syncProject` do botão manual. Loga só contagens de `inserted`
// (NUNCA o token). Sobrevive a erro por-projeto. Encerra limpo em SIGINT/SIGTERM.
// Arranca no boot do app via `src/instrumentation.ts` (spec 016, mesmo container) e
// também roda standalone por `bun run src/lib/github/worker.ts` (script `worker:github`).
// O loop é fino — os testes unit cobrem só os helpers PUROS abaixo; o núcleo I/O é `syncProject`.

// Piso p/ não despencar o intervalo por engano e estourar o rate limit do GitHub
// (cada ciclo faz 4 chamadas REST por projeto — ver SPEC §12).
export const MIN_INTERVAL_MS = 15_000;

export interface SyncLoopOptions {
  intervalMs?: number;
}

// raw = override de runGitHubSyncLoop({intervalMs}); fallback = env.GITHUB_SYNC_INTERVAL_MS.
// undefined / NaN / não-positivo → fallback. Senão clampa no piso. Puro (não lê env aqui).
export function resolveSyncInterval(
  raw: number | undefined,
  fallback: number,
  floor = MIN_INTERVAL_MS,
): number {
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.max(floor, raw);
}

// Liga o loop só no runtime Node do Next e com o flag "1". Puro.
export function shouldAutostart(
  runtime: string | undefined,
  flag: string,
): boolean {
  return runtime === "nodejs" && flag === "1";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function syncAllOnce(): Promise<void> {
  const projects = await db.project.findMany({
    select: { id: true, owner: true, repo: true },
    orderBy: { createdAt: "asc" },
  });
  for (const project of projects) {
    const slug = `${project.owner}/${project.repo}`;
    try {
      const result = await syncProject(project.id);
      if (result.ok) {
        const { commits, branches, runs } = result.inserted;
        console.log(
          `[github-sync] ${slug}: +${commits} commits, ${branches} branches, ${runs} runs`,
        );
      } else {
        // not_connected / project_not_found / github_error — nunca expõe o token.
        console.warn(`[github-sync] ${slug}: ${result.error}`);
      }
    } catch (error) {
      // Falha inesperada de 1 projeto não derruba o loop.
      console.error(`[github-sync] ${slug}: erro inesperado`, error);
    }
  }
}

/** Loop de polling. Resolve quando recebe SIGINT/SIGTERM (encerramento limpo). */
export async function runGitHubSyncLoop({
  intervalMs,
}: SyncLoopOptions = {}): Promise<void> {
  const interval = resolveSyncInterval(intervalMs, env.GITHUB_SYNC_INTERVAL_MS);
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(
    `[github-sync] worker iniciado (intervalo ${Math.round(interval / 1000)}s)`,
  );
  while (!stopped) {
    await syncAllOnce();
    if (stopped) break;
    await sleep(interval);
  }
  console.log("[github-sync] worker encerrado");
  await db.$disconnect();
}

// Guarda de instância única: o HMR do dev pode reimportar este módulo, e queremos
// UM loop por processo. `globalThis` (via Symbol.for) sobrevive à reimportação.
// Fire-and-forget de propósito: `register()` do instrumentation bloqueia o boot até
// resolver, então NÃO se dá `await` no loop infinito (ver `src/instrumentation.ts`).
const SYNC_LOOP_STARTED = Symbol.for("mirantes.github-sync.started");

export function startGitHubSyncLoopOnce(): void {
  const g = globalThis as typeof globalThis & {
    [SYNC_LOOP_STARTED]?: boolean;
  };
  if (g[SYNC_LOOP_STARTED]) return;
  g[SYNC_LOOP_STARTED] = true;
  void runGitHubSyncLoop().catch((error) => {
    console.error("[github-sync] loop falhou:", error);
  });
}

// Auto-run quando executado direto (`bun run src/lib/github/worker.ts`). O cast evita
// depender de `bun-types` p/ `import.meta.main` no `tsc --noEmit`.
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  runGitHubSyncLoop().catch((error) => {
    console.error("[github-sync] loop falhou:", error);
    process.exitCode = 1;
  });
}
