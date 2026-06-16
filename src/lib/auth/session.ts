import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import {
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "./cookie";

// DAL (Data Access Layer) de autenticação — a fonte de verdade da identidade.
// O proxy faz só o gate ótimista (assinatura); aqui validamos contra o banco.

export type UserRole = "admin" | "client";

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  /** Sessão atual — usada para invalidar as DEMAIS na troca de senha. */
  sessionId: string;
}

// Só renova `expires_at` quando falta menos que isto p/ expirar — evita um UPDATE
// a cada request mantendo o efeito "sliding" (no máximo ~1 renovação por dia).
const SLIDE_THRESHOLD_MS = 6 * 24 * 60 * 60 * 1000;

function expiryFromNow(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

/**
 * Cria a linha em `sessions` e grava o cookie httpOnly assinado.
 * Só pode ser chamada em Route Handler / Server Action (escreve cookie).
 */
export async function createSession(userId: string): Promise<void> {
  const session = await db.session.create({
    data: { userId, expiresAt: expiryFromNow() },
  });
  const store = await cookies();
  store.set(
    SESSION_COOKIE_NAME,
    signSessionToken(session.id),
    buildSessionCookieOptions(),
  );
}

/**
 * Resolve o usuário atual: assinatura do cookie → linha no banco → expiração →
 * sliding de `expires_at`. Memoizada por render (React `cache`) p/ não repetir a
 * query no layout e nas páginas do mesmo request. Retorna null se não autenticado.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const sessionId = verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value);
  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session) return null;

  // Expirada: limpa a linha (best-effort) e trata como deslogado.
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Sliding: estende a validade no banco quando já passou tempo suficiente.
  if (session.expiresAt.getTime() - Date.now() < SLIDE_THRESHOLD_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: { expiresAt: expiryFromNow() },
      })
      .catch(() => {});
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role as UserRole,
    sessionId: session.id,
  };
});

/**
 * Logout: apaga a linha de sessão e limpa o cookie.
 * Só em Route Handler / Server Action (escreve cookie).
 */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sessionId = verifySessionToken(store.get(SESSION_COOKIE_NAME)?.value);
  if (sessionId) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE_NAME);
}

/** Exige sessão válida; senão redireciona para /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige papel admin; usuário `client` é mandado de volta ao dashboard. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
