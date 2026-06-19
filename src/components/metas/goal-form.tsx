"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ParentOption {
  id: string;
  label: string;
}

interface GoalFormProps {
  /** Projeto-alvo (selecionado no header). Sem ele, não dá p/ criar. */
  projectId: string | null;
  /** Metas-pai reais do projeto (achatadas) p/ o select. */
  parents: ParentOption[];
}

/** Data prevista default = hoje + 30 dias (AAAA-MM-DD), p/ o campo nunca ir vazio. */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/**
 * Formulário "Criar Nova Meta" — REAL (spec 013): `useState` + `fetch('/api/goals')` (sem
 * react-hook-form). Com "Valor Alvo" preenchido, a meta nasce medível (X→Y); sem ele, manual.
 */
export function GoalForm({ projectId, parents }: GoalFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [status, setStatus] = useState("todo");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [startValue, setStartValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId) {
      setError("Selecione um projeto no topo antes de criar uma meta.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        description: description || undefined,
        parentId: parentId || undefined,
        status,
        dueDate,
        startValue: startValue === "" ? undefined : Number(startValue),
        targetValue: targetValue === "" ? undefined : Number(targetValue),
      }),
    });
    if (!res.ok) {
      setError("Não foi possível criar a meta. Tente novamente.");
      setSubmitting(false);
      return;
    }
    router.push("/dashboard/metas");
    router.refresh();
  }

  return (
    <form
      className="w-[640px] rounded-sm bg-surface-card"
      onSubmit={handleSubmit}
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
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Implementar autenticação JWT"
            className="w-full rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none placeholder:text-foreground-muted focus:border-accent-primary"
          />
        </Field>

        <Field label="Descrição" htmlFor="description">
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full appearance-none rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
              >
                <option value="">Nenhuma (meta de topo)</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
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
                value={status}
                onChange={(e) => setStatus(e.target.value)}
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
          <Field
            label="Valor Inicial (X)"
            htmlFor="startValue"
            className="flex-1"
          >
            <input
              id="startValue"
              type="number"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
              placeholder="0"
              className="w-full rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none placeholder:text-foreground-muted focus:border-accent-primary"
            />
          </Field>

          <Field
            label="Valor Alvo (Y)"
            htmlFor="targetValue"
            className="flex-1"
          >
            <input
              id="targetValue"
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Ex: 5 (vazio = meta manual)"
              className="w-full rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none placeholder:text-foreground-muted focus:border-accent-primary"
            />
          </Field>
        </div>

        <Field label="Data Prevista" htmlFor="dueDate">
          <input
            id="dueDate"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
          />
        </Field>

        {error && (
          <p className="font-body text-[13px] text-status-overdue">{error}</p>
        )}
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
          disabled={submitting}
          className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Check className="size-4" />
          {submitting ? "Criando..." : "Criar Meta"}
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
