import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: "invalid_current_password" | "user_not_found" };

/**
 * Troca a senha do usuário e invalida TODAS as outras sessões (mantém keepSessionId
 * — a sessão atual de quem está trocando). Núcleo extraído do Route Handler p/ ser
 * testável fora do runtime Next (não depende de cookies()/getCurrentUser).
 */
export async function changePassword(
  userId: string,
  input: {
    currentPassword: string;
    newPassword: string;
    keepSessionId: string;
  },
): Promise<ChangePasswordResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "user_not_found" };

  const valid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!valid) return { ok: false, error: "invalid_current_password" };

  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.session.deleteMany({
      where: { userId: user.id, NOT: { id: input.keepSessionId } },
    }),
  ]);
  return { ok: true };
}
