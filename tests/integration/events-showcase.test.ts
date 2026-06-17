import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { listShowcaseEvents } from "@/lib/events";
import { createProject } from "@/lib/projects";
import { seedUser } from "../setup/db";

// Vitrine da home pública (spec 012, divergência aprovada): projeto mais antigo de um admin,
// só `visibleToClient:true`. Sem `Scope` — visitante anônimo é menos privilegiado que client.

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

it("vitrine = projeto mais antigo de um admin; devolve só os visíveis dele", async () => {
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
    userId: admin.id,
    name: "Novo",
    owner: "o",
    repo: "novo",
  });
  const clientProj = await createProject({
    userId: client.id,
    name: "Cli",
    owner: "o",
    repo: "cli",
  });
  if (!old.ok || !recent.ok || !clientProj.ok) throw new Error("setup");

  await eventOn(old.project.id, { title: "vitrine-visível" });
  await eventOn(old.project.id, {
    title: "vitrine-oculto",
    visibleToClient: false,
  });
  await eventOn(recent.project.id, { title: "outro-admin-projeto" });
  await eventOn(clientProj.project.id, { title: "projeto-de-client" });

  const titles = (await listShowcaseEvents()).map((e) => e.title);
  expect(titles).toEqual(["vitrine-visível"]);
});

it("sem projeto de admin → vazio", async () => {
  const client = await seedUser({
    email: "cli@x.com",
    password: "p",
    role: "client",
  });
  const p = await createProject({
    userId: client.id,
    name: "Cli",
    owner: "o",
    repo: "cli",
  });
  if (!p.ok) throw new Error("setup");
  await eventOn(p.project.id, { title: "x" });
  expect(await listShowcaseEvents()).toEqual([]);
});
