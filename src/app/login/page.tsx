import type { Metadata } from "next";
import { LoginForm } from "@/components/login/login-form";

export const metadata: Metadata = {
  title: "Entrar — Mirantes.Live",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-1 bg-surface-primary">
      {/* Painel de marca */}
      <div className="hidden w-[560px] shrink-0 flex-col justify-between bg-surface-inverse p-[60px] lg:flex">
        <span className="font-display text-2xl font-bold text-foreground-inverse">
          Mirantes.Live
        </span>

        <div className="flex flex-col gap-5">
          <h1 className="max-w-[440px] font-display text-[40px] font-extrabold leading-[1.1] text-foreground-inverse">
            Acompanhe o progresso do seu projeto.
          </h1>
          <p className="max-w-[400px] text-base leading-[1.5] text-foreground-muted">
            Visualize metas, acompanhe atualizações em tempo real e tenha total
            transparência sobre cada etapa do desenvolvimento.
          </p>
          <span className="h-1 w-[60px] rounded-full bg-accent-primary" />
        </div>

        <span className="font-body text-xs text-foreground-muted">
          © 2025 Mirantes.Live. Todos os direitos reservados.
        </span>
      </div>

      {/* Painel do formulário */}
      <div className="flex flex-1 items-center justify-center p-[60px]">
        <LoginForm />
      </div>
    </div>
  );
}
