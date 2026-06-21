// Next 16 chama `register()` UMA vez por instância do servidor, e o boot bloqueia
// até ela resolver. Por isso o disparo do loop é fire-and-forget (em
// `startGitHubSyncLoopOnce`), nunca `await` no loop infinito.
//
// `register()` roda também no runtime Edge — saímos cedo lá para não carregar Prisma
// nem sockets no bundle Edge. O `import()` é dinâmico de propósito: só o caminho Node
// puxa `@/lib/env` e `@/lib/github/worker` (spec 016).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { env } = await import("@/lib/env");
  const { shouldAutostart, startGitHubSyncLoopOnce } = await import(
    "@/lib/github/worker"
  );

  if (!shouldAutostart(process.env.NEXT_RUNTIME, env.GITHUB_SYNC_AUTOSTART)) {
    return;
  }

  startGitHubSyncLoopOnce();
}
