"use client";

import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardShell } from "@/components/configuracoes/profile-cards";

// Card "MCP / Claude Code" (spec 019): gere os tokens pessoais que o servidor MCP de Metas
// resolve p/ o escopo do usuário ({ role: "client", userId }). Fala SÓ com a API via `fetch`
// (nada de Prisma/segredo aqui); o gate de auth é da página. Lista os tokens ATIVOS (props do
// Server Component), gera um novo (mostra o texto puro UMA vez, copiável) e revoga. Após cada
// mutação chama router.refresh().
//
// O comando de setup (`claude mcp add … /api/mcp …`) entra na spec 020 (MCP via HTTP); aqui o
// card só vive p/ gerir os tokens.

export interface McpTokenItem {
  id: string;
  name: string;
  prefix: string;
  /** ISO 8601 ou null. */
  lastUsedAt: string | null;
  /** ISO 8601. */
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function McpSetupCard({ tokens }: { tokens: McpTokenItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPlaintext(null);
    setCreating(true);
    try {
      const res = await fetch("/api/mcp-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Token" }),
      });
      if (!res.ok) {
        setError("Não foi possível gerar o token.");
        return;
      }
      const json = (await res.json()) as { token: string };
      setPlaintext(json.token);
      setName("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await fetch(`/api/mcp-tokens/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRevokingId(null);
    }
  }

  async function copyToken() {
    if (!plaintext) return;
    await navigator.clipboard?.writeText(plaintext).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <CardShell
      title={
        <span className="flex items-center gap-2.5">
          MCP / Claude Code
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground-primary">
            {tokens.length}
          </span>
        </span>
      }
    >
      <div className="flex flex-col">
        <p className="px-6 pt-5 text-[13px] text-foreground-muted">
          Tokens pessoais que o servidor MCP de Metas usa para operar apenas nos
          seus projetos. Cada token é exibido uma única vez na geração.
        </p>

        {tokens.length === 0 ? (
          <p className="px-6 py-5 text-sm text-foreground-muted">
            Nenhum token ainda. Gere um abaixo para conectar o Claude Code.
          </p>
        ) : (
          <div className="flex flex-col px-6 py-4">
            {tokens.map((token) => {
              const busy = revokingId === token.id;
              return (
                <div
                  key={token.id}
                  data-testid="mcp-token-row"
                  data-prefix={token.prefix}
                  className="flex items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <KeyRound className="size-4 shrink-0 text-foreground-muted" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold text-foreground-primary">
                        {token.name}
                      </span>
                      <span className="flex items-center gap-2 font-mono text-[12px] text-foreground-muted">
                        <span>{token.prefix}</span>
                        <span>
                          {token.lastUsedAt
                            ? `usado ${timeAgo(token.lastUsedAt)}`
                            : "nunca usado"}
                        </span>
                      </span>
                    </span>
                  </span>
                  <button
                    type="button"
                    data-testid="mcp-token-revoke"
                    aria-label={`Revogar ${token.name}`}
                    onClick={() => handleRevoke(token.id)}
                    disabled={busy}
                    className="text-foreground-muted transition-colors hover:text-status-overdue disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {plaintext && (
          <div className="mx-6 mb-4 flex flex-col gap-2 rounded-sm border border-accent-secondary/40 bg-accent-secondary/10 p-4">
            <span className="text-[12px] font-medium text-foreground-primary">
              Copie agora — este token não será exibido novamente.
            </span>
            <div className="flex items-center gap-2">
              <code
                data-testid="mcp-token-plaintext"
                className="min-w-0 flex-1 truncate rounded-sm border border-border-subtle bg-surface-primary px-3 py-2 font-mono text-[12px] text-foreground-primary"
              >
                {plaintext}
              </code>
              <button
                type="button"
                data-testid="mcp-token-copy"
                onClick={copyToken}
                className="flex shrink-0 items-center gap-1.5 rounded-sm border border-border-subtle px-3 py-2 text-[12px] font-medium text-foreground-primary transition-colors hover:bg-surface-elevated"
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        <form
          onSubmit={handleCreate}
          aria-label="Gerar token MCP"
          className="flex flex-col gap-3 border-t border-border-subtle px-6 py-5"
        >
          <span className="flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            <Plus className="size-3.5 text-accent-primary" />
            Gerar token
          </span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              data-testid="mcp-token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Rótulo (ex. Notebook)"
              maxLength={60}
              className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
            />
            <button
              type="submit"
              data-testid="mcp-token-generate"
              disabled={creating}
              className="flex items-center gap-1.5 self-start rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Gerar token
            </button>
          </div>
          {error && (
            <span className="text-[12px] text-status-overdue">{error}</span>
          )}
        </form>
      </div>
    </CardShell>
  );
}
