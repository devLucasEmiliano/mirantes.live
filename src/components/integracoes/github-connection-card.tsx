"use client";

import { Loader2, Plug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GithubMark } from "@/components/integracoes/github-mark";

// Cartão de conexão do GitHub (spec 009). Cada usuário conecta/desconecta a SUA conta.
// "Conectar" leva ao OAuth (GET /api/github/oauth/start → GitHub → callback). "Desconectar"
// chama DELETE /api/github/connection. Sem segredo aqui: só status + ações (fetch/nav).
// Barra fina (não CardShell): casa visualmente com o cabeçalho do card de Projetos, que
// espelha o mesmo status como badge.

export function GithubConnectionCard({
  connection,
}: {
  connection: { connected: boolean; githubLogin: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/github/connection", { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-sm bg-surface-card px-6 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-surface-elevated text-foreground-primary">
          <GithubMark className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground-primary">
            Conexão com o GitHub
          </span>
          {connection.connected ? (
            <span className="flex items-center gap-1.5 text-[12px] text-foreground-muted">
              <span className="size-1.5 rounded-full bg-status-done" />
              Conectado como{" "}
              <span className="font-mono font-medium text-foreground-primary">
                @{connection.githubLogin}
              </span>
            </span>
          ) : (
            <span className="truncate text-[12px] text-foreground-muted">
              Conecte sua conta para sincronizar seus repositórios privados.
            </span>
          )}
        </div>
      </div>
      {connection.connected ? (
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-border-subtle px-4 py-2 text-[13px] font-medium text-foreground-primary transition-colors hover:bg-surface-elevated disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Desconectar
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            window.location.href = "/api/github/oauth/start";
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90"
        >
          <Plug className="size-4" />
          Conectar GitHub
        </button>
      )}
    </div>
  );
}
