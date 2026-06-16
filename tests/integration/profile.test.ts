import { expect, it } from "vitest";
import { updateProfile } from "@/lib/account/profile";
import { db } from "@/lib/db";
import { seedUser } from "../setup/db";

it("atualiza nome e email (lowercased)", async () => {
  const user = await seedUser({
    email: "old@x.com",
    password: "pass-123",
    name: "Old",
  });

  const res = await updateProfile(user.id, {
    name: "Novo Nome",
    email: "NOVO@X.COM",
  });

  expect(res.ok).toBe(true);
  const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.name).toBe("Novo Nome");
  expect(after.email).toBe("novo@x.com");
});

it("recusa email já em uso por outro usuário", async () => {
  const a = await seedUser({ email: "a@x.com", password: "pass-123", name: "A" });
  await seedUser({ email: "b@x.com", password: "pass-123", name: "B" });

  const res = await updateProfile(a.id, { name: "A", email: "b@x.com" });

  expect(res).toEqual({ ok: false, error: "email_taken" });
  const after = await db.user.findUniqueOrThrow({ where: { id: a.id } });
  expect(after.email).toBe("a@x.com");
});
