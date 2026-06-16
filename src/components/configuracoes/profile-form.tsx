"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deriveInitials } from "@/lib/account/initials";
import { CardShell, ReadOnlyField } from "./profile-cards";

type Message = { kind: "ok" | "err"; text: string };

/**
 * Card "Perfil do Usuário" funcional (spec 007). Nome+email via PATCH /api/account/profile;
 * foto via PUT/DELETE /api/account/avatar (upload real). Sem foto, mostra as iniciais reais.
 * Espelha o padrão de src/components/login/login-form.tsx (estado + fetch + router.refresh()).
 */
export function ProfileForm({
  initialName,
  initialEmail,
  memberSince,
  initialHasAvatar,
  initialAvatarVersion,
}: {
  initialName: string;
  initialEmail: string;
  memberSince: string;
  initialHasAvatar: boolean;
  initialAvatarVersion: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [hasAvatar, setHasAvatar] = useState(initialHasAvatar);
  const [avatarVersion, setAvatarVersion] = useState(initialAvatarVersion);
  const [message, setMessage] = useState<Message | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (response.ok) {
        setMessage({ kind: "ok", text: "Perfil atualizado." });
        router.refresh();
      } else if (response.status === 409) {
        setMessage({ kind: "err", text: "Esse email já está em uso." });
      } else if (response.status === 400) {
        setMessage({ kind: "err", text: "Verifique o nome e o email." });
      } else if (response.status === 401) {
        setMessage({ kind: "err", text: "Sessão expirada. Entre novamente." });
      } else {
        setMessage({ kind: "err", text: "Erro no servidor. Tente novamente." });
      }
    } catch {
      setMessage({ kind: "err", text: "Falha de conexão." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/account/avatar", {
        method: "PUT",
        body,
      });
      if (response.ok) {
        setHasAvatar(true);
        setAvatarVersion(Date.now()); // força o <img> a refazer o GET com a nova foto
        setMessage({ kind: "ok", text: "Foto atualizada." });
        router.refresh();
      } else if (response.status === 400) {
        setMessage({
          kind: "err",
          text: "Imagem inválida — use PNG, JPEG ou WebP de até 2 MB.",
        });
      } else {
        setMessage({ kind: "err", text: "Não foi possível enviar a foto." });
      }
    } catch {
      setMessage({ kind: "err", text: "Falha de conexão." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemovePhoto() {
    setMessage(null);
    try {
      const response = await fetch("/api/account/avatar", { method: "DELETE" });
      if (response.ok) {
        setHasAvatar(false);
        setMessage({ kind: "ok", text: "Foto removida." });
        router.refresh();
      } else {
        setMessage({ kind: "err", text: "Não foi possível remover a foto." });
      }
    } catch {
      setMessage({ kind: "err", text: "Falha de conexão." });
    }
  }

  return (
    <form onSubmit={handleSave}>
      <CardShell
        title="Perfil do Usuário"
        footer={
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Salvando…" : "Salvar Perfil"}
          </button>
        }
      >
        <div className="flex items-center gap-5 p-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-[72px] items-center justify-center overflow-hidden rounded-full bg-accent-secondary">
              {hasAvatar ? (
                // biome-ignore lint/performance/noImgElement: avatar vem de rota autenticada que devolve bytea cru; next/image não se aplica a esse byte-stream dinâmico
                <img
                  src={`/api/account/avatar?v=${avatarVersion}`}
                  alt="Foto de perfil"
                  data-testid="avatar-image"
                  className="size-full object-cover"
                />
              ) : (
                <span
                  data-testid="avatar-initials"
                  className="text-2xl font-bold text-foreground-inverse"
                >
                  {deriveInitials(name)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="font-body text-xs text-accent-primary hover:underline"
            >
              Alterar foto
            </button>
            {hasAvatar && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="font-body text-xs text-foreground-muted transition-colors hover:text-foreground-primary"
              >
                Remover foto
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              data-testid="avatar-input"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex gap-4">
              <Field
                id="profile-name"
                label="Nome"
                value={name}
                onChange={setName}
              />
              <Field
                id="profile-email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
              />
            </div>
            <div className="flex gap-4">
              <ReadOnlyField label="Membro desde" value={memberSince} />
            </div>
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
        </div>
      </CardShell>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-body text-xs font-medium text-foreground-primary"
      >
        {label}
      </label>
      <div className="flex items-center rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-foreground-primary outline-none"
        />
      </div>
    </div>
  );
}
