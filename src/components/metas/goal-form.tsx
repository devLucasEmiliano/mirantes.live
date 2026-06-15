"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mockGoals } from "@/lib/mock-data";

/**
 * Formulário "Criar Nova Meta" — mock: o submit apenas volta para a
 * lista de metas. A spec de CRUD substituirá o onSubmit pela API real.
 */
export function GoalForm() {
  const router = useRouter();

  return (
    <form
      className="w-[640px] rounded-sm bg-surface-card"
      onSubmit={(event) => {
        event.preventDefault();
        router.push("/dashboard/metas");
      }}
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-7 py-6">
        <h2 className="font-display text-lg font-bold text-foreground-primary">
          Criar Nova Meta
        </h2>
        <span className="font-body text-xs text-foreground-muted">
          Preencha os campos abaixo
        </span>
      </div>

      <div className="flex flex-col gap-6 p-7">
        <Field label="Título da Meta" htmlFor="title">
          <input
            id="title"
            type="text"
            placeholder="Ex: Implementar autenticação JWT"
            className="w-full rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none placeholder:text-foreground-muted focus:border-accent-primary"
          />
        </Field>

        <Field label="Descrição" htmlFor="description">
          <textarea
            id="description"
            placeholder="Descreva o objetivo e critérios de conclusão..."
            className="h-[100px] w-full resize-none rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none placeholder:text-foreground-muted focus:border-accent-primary"
          />
        </Field>

        <div className="flex gap-4">
          <Field
            label="Meta Pai (opcional)"
            htmlFor="parent"
            className="flex-1"
          >
            <span className="relative flex items-center">
              <select
                id="parent"
                defaultValue=""
                className="w-full appearance-none rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
              >
                <option value="">Nenhuma (meta de topo)</option>
                {mockGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 size-4 text-foreground-muted" />
            </span>
          </Field>

          <Field label="Status Inicial" htmlFor="status" className="flex-1">
            <span className="relative flex items-center">
              <select
                id="status"
                defaultValue="todo"
                className="w-full appearance-none rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
              >
                <option value="todo">A Fazer</option>
                <option value="in_progress">Em Progresso</option>
                <option value="done">Concluído</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 size-4 text-foreground-muted" />
            </span>
          </Field>
        </div>

        <div className="flex gap-4">
          <Field label="Data Prevista" htmlFor="dueDate" className="flex-1">
            <input
              id="dueDate"
              type="date"
              required
              className="w-full rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
            />
          </Field>

          <Field
            label="Posição na Ordenação"
            htmlFor="position"
            className="flex-1"
          >
            <input
              id="position"
              type="number"
              min={1}
              defaultValue={1}
              className="w-[120px] rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-7 py-5">
        <Link
          href="/dashboard/metas"
          className="rounded-sm border border-border-subtle px-5 py-2.5 text-[13px] font-medium text-foreground-primary transition-colors hover:bg-surface-elevated"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90"
        >
          <Check className="size-4" />
          Criar Meta
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label
        htmlFor={htmlFor}
        className="font-body text-xs font-medium text-foreground-primary"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
