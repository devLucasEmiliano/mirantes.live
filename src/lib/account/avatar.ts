import { db } from "@/lib/db";

export const ALLOWED_AVATAR_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MiB

type ValidateResult =
  | { ok: true }
  | { ok: false; error: "unsupported_type" | "too_large" };

/** Valida tipo (allowlist) e tamanho da imagem — pura, sem I/O. */
export function validateAvatar(input: {
  mimeType: string;
  size: number;
}): ValidateResult {
  const allowed = (ALLOWED_AVATAR_TYPES as readonly string[]).includes(
    input.mimeType,
  );
  if (!allowed) return { ok: false, error: "unsupported_type" };
  if (input.size > MAX_AVATAR_BYTES) return { ok: false, error: "too_large" };
  return { ok: true };
}

/** Grava (cria/substitui) a foto do usuário como bytea na tabela lateral `avatars`. */
export async function setAvatar(
  userId: string,
  input: { bytes: Buffer; mimeType: string },
): Promise<void> {
  // Prisma `Bytes` espera Uint8Array<ArrayBuffer>; Buffer é <ArrayBufferLike>.
  // new Uint8Array(...) copia p/ um ArrayBuffer "puro" e satisfaz o tipo.
  const data = new Uint8Array(input.bytes);
  await db.avatar.upsert({
    where: { userId },
    create: { userId, data, mimeType: input.mimeType },
    update: { data, mimeType: input.mimeType },
  });
}

/** Lê a foto do usuário (bytes + mime), ou null se não houver. */
export async function getAvatar(
  userId: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const row = await db.avatar.findUnique({ where: { userId } });
  if (!row) return null;
  return { data: Buffer.from(row.data), mimeType: row.mimeType };
}

/** Remove a foto (idempotente — `deleteMany` não lança se a linha não existir). */
export async function clearAvatar(userId: string): Promise<void> {
  await db.avatar.deleteMany({ where: { userId } });
}
