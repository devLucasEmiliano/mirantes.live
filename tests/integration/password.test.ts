import { expect, it } from "vitest";
import { changePassword } from "@/lib/account/password";
import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { future, seedUser } from "../setup/db";

it("troca a senha e invalida as OUTRAS sessões (mantém a atual)", async () => {
  const user = await seedUser({ email: "a@x.com", password: "old-pass-123" });
  const keep = await db.session.create({
    data: { userId: user.id, expiresAt: future() },
  });
  const other = await db.session.create({
    data: { userId: user.id, expiresAt: future() },
  });

  const res = await changePassword(user.id, {
    currentPassword: "old-pass-123",
    newPassword: "new-pass-456",
    keepSessionId: keep.id,
  });

  expect(res).toEqual({ ok: true });
  const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(await verifyPassword(after.passwordHash, "new-pass-456")).toBe(true);
  expect(await verifyPassword(after.passwordHash, "old-pass-123")).toBe(false);
  expect(
    await db.session.findUnique({ where: { id: keep.id } }),
  ).not.toBeNull();
  expect(await db.session.findUnique({ where: { id: other.id } })).toBeNull();
});

it("recusa senha atual errada sem alterar nada", async () => {
  const user = await seedUser({ email: "b@x.com", password: "correct-pass" });
  const sess = await db.session.create({
    data: { userId: user.id, expiresAt: future() },
  });
  const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });

  const res = await changePassword(user.id, {
    currentPassword: "WRONG",
    newPassword: "whatever-123",
    keepSessionId: sess.id,
  });

  expect(res).toEqual({ ok: false, error: "invalid_current_password" });
  const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.passwordHash).toBe(before.passwordHash);
  expect(
    await db.session.findUnique({ where: { id: sess.id } }),
  ).not.toBeNull();
});

it("retorna user_not_found para id inexistente", async () => {
  const res = await changePassword("00000000-0000-0000-0000-000000000000", {
    currentPassword: "x",
    newPassword: "yyyyyyyy",
    keepSessionId: "11111111-1111-1111-1111-111111111111",
  });
  expect(res).toEqual({ ok: false, error: "user_not_found" });
});
