import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { listShowcaseEvents } from "@/lib/events";
import { createProject } from "@/lib/projects";
import { seedUser } from "../setup/db";

// Vitrine da home pública (spec 016): projeto PÚBLICO mais antigo (antes "mais antigo de um
// admin"), só `visibleToClient:true`. Sem `Scope` — a visibilidade `isPublic` é a autorização.

async function eventOn(
  projectId: string,
  over: Partial<{ title: string; visibleToClient: boolean }> = {},
) {
  return db.event.create({
    data: {
      source: "commit",
      type: "commit.created",
      projectId,
      title: over.title ?? "t",
      visibleToClient: over.visibleToClient ?? true,
    },
  });
}

it("vitrine = projeto PÚBLICO mais antigo; devolve só os visíveis dele", async () => {
  const admin = await seedUser({
    email: "admin@x.com",
    password: "p",
    role: "admin",
  });
  const client = await seedUser({
    email: "cli@x.com",
    password: "p",
    role: "client",
  });
  const old = await createProject({
    userId: admin.id,
    name: "Velho",
    owner: "o",
    repo: "velho",
  });
  const recent = await createProject({
    userId: client.id,
    name: "Novo",
    owner: "o",
    repo: "novo",
  });
  const privateProj = await createProject({
    userId: admin.id,
    name: "Privado",
    owner: "o",
    repo: "priv",
  });
  if (!old.ok || !recent.ok || !privateProj.ok) throw new Error("setup");
  // Vitrine = público mais antigo (de qualquer dono); `privateProj` fica privado e fora.
  await db.project.updateMany({
    where: { id: { in: [old.project.id, recent.project.id] } },
    data: { isPublic: true },
  });

  await eventOn(old.project.id, { title: "vitrine-visível" });
  await eventOn(old.project.id, {
    title: "vitrine-oculto",
    visibleToClient: false,
  });
  await eventOn(recent.project.id, { title: "outro-público" });
  await eventOn(privateProj.project.id, { title: "de-projeto-privado" });

  const titles = (await listShowcaseEvents()).map((e) => e.title);
  expect(titles).toEqual(["vitrine-visível"]);
});

it("sem projeto público → vazio", async () => {
  const admin = await seedUser({
    email: "admin@x.com",
    password: "p",
    role: "admin",
  });
  const p = await createProject({
    userId: admin.id,
    name: "Privado",
    owner: "o",
    repo: "priv",
  });
  if (!p.ok) throw new Error("setup");
  await eventOn(p.project.id, { title: "x" }); // projeto privado (default)
  expect(await listShowcaseEvents()).toEqual([]);
});
