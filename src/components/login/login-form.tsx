"use client";

import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Formulário de login mock: sem autenticação real — apenas navega para
 * /dashboard ao enviar. A spec de auth real substituirá o onSubmit.
 */
export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      className="w-[400px] rounded-sm bg-surface-card"
      onSubmit={(event) => {
        event.preventDefault();
        router.push("/dashboard");
      }}
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
              type="email"
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
              type={showPassword ? "text" : "password"}
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

        <button
          type="submit"
          className="flex items-center justify-center rounded-sm bg-accent-primary py-3 text-sm font-semibold text-foreground-inverse transition-opacity hover:opacity-90"
        >
          Entrar
        </button>
      </div>
    </form>
  );
}
