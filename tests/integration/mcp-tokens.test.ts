import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { resolveScopeFromToken } from "@/lib/mcp/auth";
import {
  createMcpToken,
  hashToken,
  listMcpTokens,
  revokeMcpToken,
} from "@/lib/mcp/tokens";
import { metasCreate, metasList } from "@/lib/mcp/tools";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

const asClient = (userId: string) => ({ role: "client", userId }) as const;

it("createMcpToken grava só o hash+prefixo (texto não persiste) e devolve o texto uma vez", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token, view } = await createMcpToken(u.id, "Notebook");
  expect(token.startsWith("mir_")).toBe(true);
  const row = await db.mcpToken.findUniqueOrThrow({ where: { id: view.id } });
  expect(row.tokenHash).toBe(hashToken(token));
  expect(row.tokenPrefix).toBe(view.prefix);
  // o texto puro não aparece em nenhuma coluna persistida
  expect(row.tokenHash).not.toBe(token);
  expect(row.tokenPrefix).not.toBe(token);
});

it("resolveScopeFromToken: token de usuário → client+userId e carimba lastUsedAt", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token, view } = await createMcpToken(u.id, "PC");
  expect(await resolveScopeFromToken(token)).toEqual({
    role: "client",
    userId: u.id,
  });
  const row = await db.mcpToken.findUniqueOrThrow({ where: { id: view.id } });
  expect(row.lastUsedAt).not.toBeNull();
});

it("MCP_SERVICE_TOKEN (env) ainda resolve admin; token desconhecido → null", async () => {
  // vitest.config injeta MCP_SERVICE_TOKEN = "test-mcp-token-aaaaaaaa"
  expect(await resolveScopeFromToken("test-mcp-token-aaaaaaaa")).toEqual({
    role: "admin",
  });
  expect(await resolveScopeFromToken("mir_desconhecido")).toBeNull();
  expect(await resolveScopeFromToken(undefined)).toBeNull();
});

it("revogar invalida o token (resolve passa a null) e some do list ativo", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token, view } = await createMcpToken(u.id, "antigo");
  expect(await resolveScopeFromToken(token)).not.toBeNull();
  expect(await revokeMcpToken(u.id, view.id)).toEqual({ ok: true });
  expect(await resolveScopeFromToken(token)).toBeNull();
  const ativos = (await listMcpTokens(u.id)).filter(
    (t) => t.revokedAt === null,
  );
  expect(ativos).toHaveLength(0);
});

it("revogar token de OUTRO usuário não funciona (escopo)", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const b = await seedUser({ email: "b@x.com", password: "p", role: "client" });
  const { view } = await createMcpToken(a.id, "do A");
  expect(await revokeMcpToken(b.id, view.id)).toEqual({ ok: false });
  expect(
    (await db.mcpToken.findUniqueOrThrow({ where: { id: view.id } })).revokedAt,
  ).toBeNull();
});

it("escopo client do token só enxerga/mexe nas metas do próprio dono", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const b = await seedUser({ email: "b@x.com", password: "p", role: "client" });
  const pa = await createProject({
    userId: a.id,
    name: "A",
    owner: "oa",
    repo: "ra",
  });
  if (!pa.ok) throw new Error("setup");
  await metasCreate(asClient(a.id), {
    projectId: pa.project.id,
    title: "meta do A",
    dueDate: future().toISOString(),
  });
  // B (escopo do token de B) não resolve o projeto do A → erro
  await expect(
    metasList(asClient(b.id), { project: "oa/ra" }),
  ).rejects.toThrow();
  // A enxerga a sua
  expect(
    (await metasList(asClient(a.id), { projectId: pa.project.id })).map(
      (m) => m.title,
    ),
  ).toEqual(["meta do A"]);
});
