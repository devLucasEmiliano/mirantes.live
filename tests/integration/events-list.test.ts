import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { listEvents } from "@/lib/events";
import { createProject } from "@/lib/projects";
import { seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;

async function event(
  projectId: string | null,
  over: Partial<{
    title: string;
    visibleToClient: boolean;
    type: string;
  }> = {},
) {
  return db.event.create({
    data: {
      source: "commit",
      type: over.type ?? "commit.created",
      projectId,
      title: over.title ?? "t",
      visibleToClient: over.visibleToClient ?? true,
    },
  });
}

it("cliente vê só eventos do seu projeto (ou globais) e visíveis; admin vê tudo", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const b = await seedUser({ email: "b@x.com", password: "p", role: "client" });
  const pa = await createProject({
    userId: a.id,
    name: "A",
    owner: "o",
    repo: "a",
  });
  const pb = await createProject({
    userId: b.id,
    name: "B",
    owner: "o",
    repo: "b",
  });
  if (!pa.ok || !pb.ok) throw new Error("setup");
  await event(pa.project.id, { title: "do A" });
  await event(pb.project.id, { title: "do B" });
  await event(null, { title: "global" });

  const cliA = (await listEvents(asClient(a.id))).events.map((e) => e.title);
  expect(cliA).toContain("do A");
  expect(cliA).toContain("global");
  expect(cliA).not.toContain("do B");
  expect((await listEvents(ADMIN)).events).toHaveLength(3);
});

it("evento invisível some p/ cliente e aparece p/ admin", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const pa = await createProject({
    userId: a.id,
    name: "A",
    owner: "o",
    repo: "a",
  });
  if (!pa.ok) throw new Error("setup");
  await event(pa.project.id, { title: "secreto", visibleToClient: false });
  expect((await listEvents(asClient(a.id))).events).toHaveLength(0);
  expect((await listEvents(ADMIN)).events.map((e) => e.title)).toEqual([
    "secreto",
  ]);
});

it("filtra por projeto e ordena id desc", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p1 = await createProject({
    userId: a.id,
    name: "P1",
    owner: "o",
    repo: "p1",
  });
  const p2 = await createProject({
    userId: a.id,
    name: "P2",
    owner: "o",
    repo: "p2",
  });
  if (!p1.ok || !p2.ok) throw new Error("setup");
  await event(p1.project.id, { title: "p1-velho" });
  await event(p1.project.id, { title: "p1-novo" });
  await event(p2.project.id, { title: "p2" });
  const got = await listEvents(ADMIN, { projectId: p1.project.id });
  expect(got.events.map((e) => e.title)).toEqual(["p1-novo", "p1-velho"]); // id desc
});

it("paginação por cursor", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({
    userId: a.id,
    name: "P",
    owner: "o",
    repo: "p",
  });
  if (!p.ok) throw new Error("setup");
  for (let i = 1; i <= 3; i++) await event(p.project.id, { title: `e${i}` });
  const page1 = await listEvents(ADMIN, { limit: 2 });
  expect(page1.events.map((e) => e.title)).toEqual(["e3", "e2"]);
  expect(page1.nextCursor).not.toBeNull();
  const page2 = await listEvents(ADMIN, {
    limit: 2,
    cursor: page1.nextCursor ?? undefined,
  });
  expect(page2.events.map((e) => e.title)).toEqual(["e1"]);
  expect(page2.nextCursor).toBeNull();
});

it("serializa id (bigint) e createdAt como string", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({
    userId: a.id,
    name: "P",
    owner: "o",
    repo: "p",
  });
  if (!p.ok) throw new Error("setup");
  await event(p.project.id, { title: "x" });
  const [ev] = (await listEvents(ADMIN)).events;
  expect(typeof ev?.id).toBe("string");
  expect(typeof ev?.createdAt).toBe("string");
});
