"use client";

import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Formulário de login real: envia para POST /api/auth/login. O Route Handler grava
 * o cookie de sessão; aqui só tratamos a resposta (401/429) e navegamos no sucesso.
 */
export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        // router.refresh() força os Server Components (layout/sidebar) a relerem a sessão.
        router.push("/dashboard");
        router.refresh();
        return;
      }
      if (response.status === 429) {
        setError("Muitas tentativas. Tente novamente em alguns minutos.");
      } else if (response.status === 401) {
        setError("Email ou senha inválidos.");
      } else if (response.status === 400) {
        // 400 = corpo inválido (ex.: email com formato que o servidor recusa —
        // a validação do zod é mais estrita que a do <input type="email">).
        setError("Verifique o email e a senha digitados.");
      } else {
        setError("Erro no servidor. Tente novamente em instantes.");
      }
    } catch {
      setError("Falha de conexão. Verifique sua rede e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="w-[400px] rounded-sm bg-surface-card"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-2 px-8 pb-6 pt-8">
        <h2 className="font-display text-2xl font-bold text-foreground-primary">
          Entrar
        </h2>
        <p className="text-sm text-foreground-muted">
          Acesse o painel do seu projeto
        </p>
      </div>

      <div className="flex flex-col gap-5 px-8 pb-8">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="font-body text-xs font-medium text-foreground-primary"
          >
            Email
          </label>
          <div className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-3">
            <Mail className="size-4 shrink-0 text-foreground-muted" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-transparent text-sm text-foreground-primary outline-none placeholder:text-foreground-muted"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="font-body text-xs font-medium text-foreground-primary"
          >
            Senha
          </label>
          <div className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-3">
            <Lock className="size-4 shrink-0 text-foreground-muted" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent text-sm text-foreground-primary outline-none placeholder:text-foreground-muted"
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((value) => !value)}
              className="text-foreground-muted transition-colors hover:text-foreground-primary"
            >
              {showPassword ? (
                <Eye className="size-4" />
              ) : (
                <EyeOff className="size-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center rounded-sm bg-accent-primary py-3 text-sm font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </form>
  );
}
