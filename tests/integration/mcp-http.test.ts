import { expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { resolveProjectId } from "@/lib/mcp/project-context";
import { createMcpToken } from "@/lib/mcp/tokens";
import { metasCreate } from "@/lib/mcp/tools";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

// Route HTTP do MCP (spec 020): autentica por Bearer (token pessoal → client; env → admin;
// ausente/inválido → 401) e serve as 7 tools de Metas SEM amarra ao git (detectRepo:false),
// stateless + JSON. Postgres real (§5.3); nada externo a stubar — o git é cortado pela opção.

const JSON_HEADERS = (token?: string) => ({
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  ...(token ? { authorization: `Bearer ${token}` } : {}),
});

const initBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "t", version: "1" },
  },
};

const req = (token?: string, body: unknown = initBody) =>
  new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: JSON_HEADERS(token),
    body: JSON.stringify(body),
  });

it("sem Bearer → 401; Bearer inválido → 401", async () => {
  expect((await POST(req(undefined))).status).toBe(401);
  expect((await POST(req("mir_naoexiste"))).status).toBe(401);
});

it("token pessoal + initialize → 200 com serverInfo", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token } = await createMcpToken(u.id, "PC");
  const res = await POST(req(token));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.result?.serverInfo?.name).toBeTruthy();
});

it("detectRepo:false → resolveProjectId sem override devolve null (sem git)", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  expect(
    await resolveProjectId({ role: "admin" }, undefined, { detectRepo: false }),
  ).toBeNull();
  // sanity: com override resolve normalmente
  const p = await createProject({
    userId: u.id,
    name: "X",
    owner: "o",
    repo: "r",
  });
  if (!p.ok) throw new Error("setup");
  expect(
    await resolveProjectId({ role: "admin" }, "o/r", { detectRepo: false }),
  ).toBe(p.project.id);
});

it("tools/call metas_list via HTTP (stateless) devolve as metas do dono do token", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token } = await createMcpToken(u.id, "PC");
  const p = await createProject({
    userId: u.id,
    name: "P",
    owner: "o",
    repo: "r",
  });
  if (!p.ok) throw new Error("setup");
  await metasCreate(
    { role: "client", userId: u.id },
    {
      projectId: p.project.id,
      title: "Minha meta HTTP",
      dueDate: future().toISOString(),
    },
  );
  // Sem projectId: passa por resolveProjectId(detectRepo:false) → null → lista todo o escopo.
  const res = await POST(
    req(token, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "metas_list", arguments: {} },
    }),
  );
  expect(res.status).toBe(200);
  const json = await res.json();
  const text = json.result?.content?.[0]?.text ?? "";
  expect(text).toContain("Minha meta HTTP");
});
