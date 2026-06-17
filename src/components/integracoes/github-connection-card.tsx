"use client";

import { Loader2, Plug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardShell } from "@/components/configuracoes/profile-cards";

// Cartão de conexão do GitHub (spec 009). Cada usuário conecta/desconecta a SUA conta.
// "Conectar" leva ao OAuth (GET /api/github/oauth/start → GitHub → callback). "Desconectar"
// chama DELETE /api/github/connection. Sem segredo aqui: só status + ações (fetch/nav).

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
    <CardShell title="Conexão com o GitHub">
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        {connection.connected ? (
          <>
            <span className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-status-done" />
              <span className="text-sm text-foreground-primary">
                Conectado como{" "}
                <span className="font-mono font-semibold">
                  @{connection.githubLogin}
                </span>
              </span>
            </span>
            <button
              type="button"
              onClick={disconnect}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-sm border border-border-subtle px-4 py-2 text-[13px] font-medium text-foreground-primary transition-colors hover:bg-surface-elevated disabled:opacity-50"
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Desconectar
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-foreground-muted">
              Conecte sua conta para sincronizar seus repositórios privados.
            </span>
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
          </>
        )}
      </div>
    </CardShell>
  );
}
