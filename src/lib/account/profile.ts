import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type UpdateProfileResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        createdAt: Date;
      };
    }
  | { ok: false; error: "email_taken" };

/**
 * Atualiza nome + email do usuário logado. Normaliza o email p/ lowercase. Colisão
 * de email único (Prisma P2002) → email_taken. Retorna o usuário SEM passwordHash.
 */
export async function updateProfile(
  userId: string,
  input: { name: string; email: string },
): Promise<UpdateProfileResult> {
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { name: input.name, email: input.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    return { ok: true, user };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "email_taken" };
    }
    throw error;
  }
}
