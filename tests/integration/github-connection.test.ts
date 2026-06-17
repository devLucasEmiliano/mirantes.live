import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  connectGithub,
  disconnectGithub,
  getConnectionStatus,
  resolveUserToken,
} from "@/lib/github/connection";
import { seedUser } from "../setup/db";

const CONN = {
  accessToken: "gho_test_token_123",
  login: "ana-gh",
  githubUserId: 4242,
  scopes: "repo,read:user",
};

it("connect cifra o token (não grava em claro) e resolveUserToken devolve o claro", async () => {
  const user = await seedUser({ email: "a@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  const row = await db.githubConnection.findUniqueOrThrow({
    where: { userId: user.id },
  });
  expect(row.tokenCiphertext).not.toBe(CONN.accessToken);
  expect(row.githubLogin).toBe("ana-gh");
  expect(await resolveUserToken(user.id)).toEqual({
    ok: true,
    token: "gho_test_token_123",
  });
});

it("resolveUserToken → not_connected sem conexão", async () => {
  const user = await seedUser({ email: "b@x.com", password: "pass-123" });
  expect(await resolveUserToken(user.id)).toEqual({
    ok: false,
    error: "not_connected",
  });
});

it("resolveUserToken → invalid_token com ciphertext corrompido", async () => {
  const user = await seedUser({ email: "c@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  await db.githubConnection.update({
    where: { userId: user.id },
    data: { tokenCiphertext: "Y29ycnVwdG8=" },
  });
  expect(await resolveUserToken(user.id)).toEqual({
    ok: false,
    error: "invalid_token",
  });
});

it("getConnectionStatus não expõe o token", async () => {
  const user = await seedUser({ email: "d@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  const status = await getConnectionStatus(user.id);
  expect(status.connected).toBe(true);
  expect(status.githubLogin).toBe("ana-gh");
  expect(JSON.stringify(status)).not.toContain("gho_test_token_123");
});

it("disconnect remove a conexão", async () => {
  const user = await seedUser({ email: "e@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  await disconnectGithub(user.id);
  expect(
    await db.githubConnection.findUnique({ where: { userId: user.id } }),
  ).toBeNull();
  expect(await getConnectionStatus(user.id)).toEqual({
    connected: false,
    githubLogin: null,
    connectedAt: null,
  });
});

it("apagar o usuário cascateia a conexão", async () => {
  const user = await seedUser({ email: "f@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  await db.user.delete({ where: { id: user.id } });
  expect(await db.githubConnection.count()).toBe(0);
});
