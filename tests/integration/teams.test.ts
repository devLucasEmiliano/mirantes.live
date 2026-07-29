import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  archiveGoal,
  createGoal,
  listGoals,
  updateGoal,
} from "@/lib/goals/service";
import { createProject } from "@/lib/projects";
import {
  addMember,
  assignProject,
  createTeam,
  listTeamProjectIdsForUser,
  removeMember,
  unassignProject,
} from "@/lib/teams";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;

async function ownedProject(email: string) {
  const u = await seedUser({ email, password: "p", role: "client" });
  const p = await createProject({
    userId: u.id,
    name: "P",
    owner: "o",
    repo: email.split("@")[0],
  });
  if (!p.ok) throw new Error("setup");
  return { user: u, project: p.project };
}

it("membro de equipe LÊ as metas do projeto compartilhado; dono continua vendo as suas", async () => {
  const dono = await ownedProject("dono@x.com");
  const membro = await seedUser({
    email: "membro@x.com",
    password: "p",
    role: "client",
  });
  await createGoal(ADMIN, {
    projectId: dono.project.id,
    title: "meta compartilhada",
    dueDate: future(),
  });

  // sem equipe ainda: membro não vê nada do projeto do dono
  expect(await listGoals(asClient(membro.id))).toHaveLength(0);

  const team = await createTeam("Equipe QA");
  await addMember(team.id, membro.id);
  await assignProject(team.id, dono.project.id);

  const seen = await listGoals(asClient(membro.id));
  expect(seen.map((g) => g.title)).toEqual(["meta compartilhada"]);
  // o dono segue vendo a própria (sem duplicar)
  expect(await listGoals(asClient(dono.user.id))).toHaveLength(1);
});

it("membro de equipe NÃO consegue mutar (criar/editar/arquivar) meta do projeto compartilhado", async () => {
  const dono = await ownedProject("dono2@x.com");
  const membro = await seedUser({
    email: "membro2@x.com",
    password: "p",
    role: "client",
  });
  const goal = await createGoal(ADMIN, {
    projectId: dono.project.id,
    title: "M",
    dueDate: future(),
  });
  if (!goal.ok) throw new Error("setup");

  const team = await createTeam("Equipe QA 2");
  await addMember(team.id, membro.id);
  await assignProject(team.id, dono.project.id);

  const create = await createGoal(asClient(membro.id), {
    projectId: dono.project.id,
    title: "tentativa",
    dueDate: future(),
  });
  expect(create).toEqual({ ok: false, error: "not_found" });

  const update = await updateGoal(asClient(membro.id), goal.goal.id, {
    title: "hack",
  });
  expect(update).toEqual({ ok: false, error: "not_found" });

  const archive = await archiveGoal(asClient(membro.id), goal.goal.id);
  expect(archive).toEqual({ ok: false, error: "not_found" });
});

it("remover membro ou desatribuir projeto revoga o acesso de leitura", async () => {
  const dono = await ownedProject("dono3@x.com");
  const membro = await seedUser({
    email: "membro3@x.com",
    password: "p",
    role: "client",
  });
  await createGoal(ADMIN, {
    projectId: dono.project.id,
    title: "M",
    dueDate: future(),
  });
  const team = await createTeam("Equipe QA 3");
  await addMember(team.id, membro.id);
  await assignProject(team.id, dono.project.id);
  expect(await listGoals(asClient(membro.id))).toHaveLength(1);

  await removeMember(team.id, membro.id);
  expect(await listGoals(asClient(membro.id))).toHaveLength(0);

  await addMember(team.id, membro.id);
  expect(await listGoals(asClient(membro.id))).toHaveLength(1);
  await unassignProject(team.id, dono.project.id);
  expect(await listGoals(asClient(membro.id))).toHaveLength(0);
});

it("1 projeto → no máx. 1 equipe: atribuir a uma 2ª equipe move (não duplica leitura)", async () => {
  const dono = await ownedProject("dono4@x.com");
  const m1 = await seedUser({
    email: "m1@x.com",
    password: "p",
    role: "client",
  });
  const m2 = await seedUser({
    email: "m2@x.com",
    password: "p",
    role: "client",
  });
  await createGoal(ADMIN, {
    projectId: dono.project.id,
    title: "M",
    dueDate: future(),
  });
  const teamA = await createTeam("A");
  const teamB = await createTeam("B");
  await addMember(teamA.id, m1.id);
  await addMember(teamB.id, m2.id);
  await assignProject(teamA.id, dono.project.id);
  expect(await listTeamProjectIdsForUser(m1.id)).toEqual([dono.project.id]);

  await assignProject(teamB.id, dono.project.id); // move de A para B
  expect(await listTeamProjectIdsForUser(m1.id)).toEqual([]); // A perdeu
  expect(await listTeamProjectIdsForUser(m2.id)).toEqual([dono.project.id]); // B ganhou
  expect(
    (await db.project.findUniqueOrThrow({ where: { id: dono.project.id } }))
      .teamId,
  ).toBe(teamB.id);
});

it("deletar a equipe libera o projeto (teamId volta a null) e remove os membros", async () => {
  const dono = await ownedProject("dono5@x.com");
  const membro = await seedUser({
    email: "membro5@x.com",
    password: "p",
    role: "client",
  });
  const team = await createTeam("Efêmera");
  await addMember(team.id, membro.id);
  await assignProject(team.id, dono.project.id);

  await db.team.delete({ where: { id: team.id } });
  expect(
    (await db.project.findUniqueOrThrow({ where: { id: dono.project.id } }))
      .teamId,
  ).toBeNull();
  expect(await db.teamMember.count({ where: { teamId: team.id } })).toBe(0);
});
