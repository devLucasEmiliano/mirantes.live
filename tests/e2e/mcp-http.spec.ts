import { expect, type Page, test } from "@playwright/test";

// Jornada do MCP via HTTP (spec 020): na tela de Integrações, o card "MCP / Claude Code" mostra o
// comando copiável `claude mcp add --transport http …` com a APP_BASE_URL do app. Antes de gerar é
// um template (`<SEU_TOKEN>`); ao gerar, embute o token real (1×). O route `/api/mcp` autentica por
// Bearer: token válido → 200 + serverInfo; sem Bearer → 401; e opera nos projetos do dono do token.
// O banco do e2e NÃO é resetado entre execuções → o teste mira o token recém gerado, não contagem.

const CLIENT = { email: "cliente@mirantes.live", password: "cliente-dev-2026" };
const BASE = "http://localhost:3100";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

const JSON_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};
const initBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "e2e", version: "1" },
  },
};

test("card mostra o comando HTTP e /api/mcp autentica por Bearer", async ({
  page,
}) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");

  // Comando copiável: transporte HTTP + base URL do app + template antes de gerar.
  const command = page.getByTestId("mcp-setup-command");
  await expect(command).toBeVisible();
  const template = (await command.textContent()) ?? "";
  expect(template).toContain("claude mcp add --transport http");
  expect(template).toContain(`${BASE}/api/mcp`);
  expect(template).toContain("<SEU_TOKEN>");

  // Gera um token: o texto puro aparece UMA vez e o comando passa a embuti-lo.
  await page.getByTestId("mcp-token-name").fill("E2E HTTP");
  await page.getByTestId("mcp-token-generate").click();
  const plain = page.getByTestId("mcp-token-plaintext");
  await expect(plain).toBeVisible();
  const token = ((await plain.textContent()) ?? "").trim();
  expect(token.startsWith("mir_")).toBe(true);
  await expect(command).toContainText(token);

  // Route HTTP: Bearer válido → 200 + serverInfo.
  const ok = await page.request.post(`${BASE}/api/mcp`, {
    headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` },
    data: initBody,
  });
  expect(ok.status()).toBe(200);
  const okBody = await ok.json();
  expect(okBody.result?.serverInfo?.name).toBeTruthy();

  // Sem Bearer → 401 (a sessão por cookie não conta: o route só lê o header Authorization).
  const denied = await page.request.post(`${BASE}/api/mcp`, {
    headers: JSON_HEADERS,
    data: initBody,
  });
  expect(denied.status()).toBe(401);

  // Opera nos projetos do dono do token: metas_projects traz o repo do cliente.
  const tool = await page.request.post(`${BASE}/api/mcp`, {
    headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` },
    data: {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "metas_projects", arguments: {} },
    },
  });
  expect(tool.status()).toBe(200);
  const toolBody = await tool.json();
  const text = toolBody.result?.content?.[0]?.text ?? "";
  expect(text).toContain("cliente-repo");
});
