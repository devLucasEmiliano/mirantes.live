"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardShell } from "./profile-cards";

type Message = { kind: "ok" | "err"; text: string };

/**
 * Card "Alterar Senha" funcional (spec 007). Liga ao endpoint existente
 * POST /api/auth/password. Valida "nova == confirmar" no client ANTES do request
 * e avisa que as outras sessões serão desconectadas.
 */
export function PasswordForm() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (next !== confirm) {
      // Validação no client: não dispara request (coberto pelo e2e).
      setMessage({ kind: "err", text: "As senhas não conferem." });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (response.ok) {
        setMessage({
          kind: "ok",
          text: "Senha atualizada. As outras sessões foram desconectadas.",
        });
        setCurrent("");
        setNext("");
        setConfirm("");
        router.refresh();
      } else if (response.status === 401) {
        setMessage({ kind: "err", text: "Senha atual incorreta." });
      } else if (response.status === 400) {
        setMessage({
          kind: "err",
          text: "A nova senha precisa de ao menos 8 caracteres.",
        });
      } else if (response.status === 429) {
        setMessage({
          kind: "err",
          text: "Muitas tentativas. Tente novamente em alguns minutos.",
        });
      } else {
        setMessage({ kind: "err", text: "Erro no servidor. Tente novamente." });
      }
    } catch {
      setMessage({ kind: "err", text: "Falha de conexão." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <CardShell
        title="Alterar Senha"
        footer={
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Atualizando…" : "Atualizar Senha"}
          </button>
        }
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex">
            <PasswordField
              id="current-password"
              label="Senha Atual"
              value={current}
              onChange={setCurrent}
              autoComplete="current-password"
            />
          </div>
          <div className="flex gap-4">
            <PasswordField
              id="new-password"
              label="Nova Senha"
              value={next}
              onChange={setNext}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="Confirmar Nova Senha"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
          </div>
          <p className="font-body text-xs text-foreground-muted">
            Ao trocar a senha, as outras sessões ativas serão desconectadas.
          </p>
          {message && (
            <p
              role="alert"
              className={
                message.kind === "ok"
                  ? "text-sm text-status-done"
                  : "text-sm text-red-600"
              }
            >
              {message.text}
            </p>
          )}
        </div>
      </CardShell>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-body text-xs font-medium text-foreground-primary"
      >
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5">
        <Lock className="size-4 shrink-0 text-foreground-muted" />
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-sm text-foreground-primary outline-none"
        />
        <button
          type="button"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setShow((prev) => !prev)}
          className="text-foreground-muted transition-colors hover:text-foreground-primary"
        >
          {show ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
      </div>
    </div>
  );
}
