export const ALLOWED_AVATAR_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MiB

type ValidateResult =
  | { ok: true }
  | { ok: false; error: "unsupported_type" | "too_large" };

// STUB (passo vermelho §5.4). Reais vêm no green.
export function validateAvatar(_input: {
  mimeType: string;
  size: number;
}): ValidateResult {
  return { ok: false, error: "not_implemented" as never };
}

export async function setAvatar(
  _userId: string,
  _input: { bytes: Buffer; mimeType: string },
): Promise<void> {
  // STUB no-op.
}

export async function getAvatar(
  _userId: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  return null;
}

export async function clearAvatar(_userId: string): Promise<void> {
  // STUB no-op.
}
