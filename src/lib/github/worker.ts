import { db } from "@/lib/db";
import { syncProject } from "./sync";

// Worker de polling do GitHub (SPEC §7): a cada `intervalMs`, percorre todos os projetos
// e chama o MESMO núcleo `syncProject` do botão manual. Loga só contagens de `inserted`
// (NUNCA o token). Sobrevive a erro por-projeto. Encerra limpo em SIGINT/SIGTERM.
// Rodado por `bun run src/lib/github/worker.ts` (script `worker:github`). Sem testes
// (fino) — o núcleo coberto é `syncProject`.

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export interface SyncLoopOptions {
  intervalMs?: number;
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
  intervalMs = DEFAULT_INTERVAL_MS,
}: SyncLoopOptions = {}): Promise<void> {
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(
    `[github-sync] worker iniciado (intervalo ${Math.round(intervalMs / 1000)}s)`,
  );
  while (!stopped) {
    await syncAllOnce();
    if (stopped) break;
    await sleep(intervalMs);
  }
  console.log("[github-sync] worker encerrado");
  await db.$disconnect();
}

// Auto-run quando executado direto (`bun run src/lib/github/worker.ts`). O cast evita
// depender de `bun-types` p/ `import.meta.main` no `tsc --noEmit`.
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  runGitHubSyncLoop().catch((error) => {
    console.error("[github-sync] loop falhou:", error);
    process.exitCode = 1;
  });
}
