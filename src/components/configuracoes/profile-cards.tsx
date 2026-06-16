import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  GitBranch,
  Lock,
  Plus,
  RefreshCw,
} from "lucide-react";
import { mockUser } from "@/lib/mock-data";

function CardShell({
  title,
  children,
  headerExtra,
  footer,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-sm bg-surface-card">
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-5">
        <h2 className="font-display text-base font-bold text-foreground-primary">
          {title}
        </h2>
        {headerExtra}
      </div>
      {children}
      {footer && (
        <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
          {footer}
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="font-body text-xs font-medium text-foreground-primary">
        {label}
      </span>
      <span className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary">
        {icon}
        {value}
      </span>
    </div>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90"
    >
      {children}
    </button>
  );
}

/** Card "Perfil do Usuário". */
export function ProfileCard() {
  return (
    <CardShell
      title="Perfil do Usuário"
      footer={<PrimaryButton>Salvar Perfil</PrimaryButton>}
    >
      <div className="flex items-center gap-5 p-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-accent-secondary">
            <span className="text-2xl font-bold text-foreground-inverse">
              {mockUser.initials}
            </span>
          </div>
          <span className="font-body text-xs text-accent-primary">
            Alterar foto
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex gap-4">
            <ReadOnlyField label="Nome" value={mockUser.name} />
            <ReadOnlyField label="Email" value={mockUser.email} />
          </div>
          <div className="flex gap-4">
            <ReadOnlyField label="Membro desde" value="02 Mar 2026" />
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/** Card "Projetos": projeto ativo expandido + projeto recolhido. */
export function ProjectCard() {
  return (
    <CardShell
      title={
        <span className="flex items-center gap-2.5">
          Projetos
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground-primary">
            2
          </span>
        </span>
      }
      headerExtra={
        <span className="flex items-center gap-1.5 rounded-full bg-[#E8F5E9] px-2.5 py-1">
          <span className="size-1.5 rounded-full bg-status-done" />
          <span className="font-body text-[11px] font-medium text-status-done">
            Conectado
          </span>
        </span>
      }
      footer={
        <>
          <button
            type="button"
            className="mr-auto flex items-center gap-1.5 rounded-sm border border-border-subtle px-4 py-2.5 text-[13px] font-medium text-foreground-primary transition-colors hover:bg-surface-elevated"
          >
            <RefreshCw className="size-3.5" />
            Sincronizar Agora
          </button>
          <PrimaryButton>Salvar Projeto</PrimaryButton>
        </>
      }
    >
      <div className="flex items-center justify-between bg-accent-primary px-6 py-3.5">
        <span className="flex items-center gap-2.5">
          <ChevronDown className="size-3.5 text-foreground-inverse" />
          <span className="text-sm font-semibold text-foreground-inverse">
            Mirantes.Live Dashboard
          </span>
        </span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 font-body text-[11px] text-foreground-inverse">
          ativo
        </span>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        <div className="flex gap-4">
          <ReadOnlyField
            label="Nome do Projeto"
            value="Mirantes.Live Dashboard"
          />
          <ReadOnlyField
            label="Repositório GitHub"
            value="devlucasemiliano/mirantes.live"
            icon={<GitBranch className="size-4 text-foreground-muted" />}
          />
        </div>
        <div className="flex flex-col gap-2 rounded-sm bg-surface-elevated p-4">
          <span className="font-body text-xs font-medium text-foreground-muted">
            Último commit sincronizado
          </span>
          <span className="font-mono text-xs text-accent-primary">a3f8c2d</span>
          <span className="text-[13px] text-foreground-primary">
            feat: add SSE endpoint for real-time updates
          </span>
          <span className="font-body text-[11px] text-foreground-muted">
            devlucasemiliano · há 2 horas
          </span>
        </div>
        <div className="flex gap-4">
          <ReadOnlyField label="Branch monitorada" value="main" />
          <ReadOnlyField label="Sincronização" value="A cada 5 minutos" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border-subtle px-6 py-3.5">
        <span className="flex items-center gap-2.5">
          <ChevronRight className="size-3.5 text-foreground-muted" />
          <span className="text-sm font-medium text-foreground-primary">
            Landing Page Corporativa
          </span>
        </span>
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-body text-[11px] text-foreground-muted">
          pausado
        </span>
      </div>

      <button
        type="button"
        className="flex items-center justify-center gap-2 border-t border-border-subtle px-6 py-3.5 text-[13px] font-medium text-accent-primary transition-colors hover:bg-surface-elevated"
      >
        <Plus className="size-4" />
        Adicionar Projeto
      </button>
    </CardShell>
  );
}

function PasswordField({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "" : "flex-1"}`}>
      <span className="font-body text-xs font-medium text-foreground-primary">
        {label}
      </span>
      <span className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5">
        <Lock className="size-4 shrink-0 text-foreground-muted" />
        <span className="flex-1 text-sm text-foreground-primary">••••••••</span>
        <EyeOff className="size-4 shrink-0 text-foreground-muted" />
      </span>
    </div>
  );
}

/** Card "Alterar Senha" (PRD §3: troca de senha do usuário logado). */
export function PasswordCard() {
  return (
    <CardShell
      title="Alterar Senha"
      footer={<PrimaryButton>Atualizar Senha</PrimaryButton>}
    >
      <div className="flex flex-col gap-4 p-6">
        <PasswordField label="Senha Atual" wide />
        <div className="flex gap-4">
          <PasswordField label="Nova Senha" />
          <PasswordField label="Confirmar Nova Senha" />
        </div>
      </div>
    </CardShell>
  );
}
