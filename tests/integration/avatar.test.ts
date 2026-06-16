import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { clearAvatar, getAvatar, setAvatar } from "@/lib/account/avatar";
import { seedUser } from "../setup/db";

const PNG = readFileSync(
  fileURLToPath(new URL("../fixtures/avatar.png", import.meta.url)),
);

it("grava e lê os bytes da imagem (round-trip idêntico)", async () => {
  const user = await seedUser({ email: "a@x.com", password: "pass-123" });
  await setAvatar(user.id, { bytes: PNG, mimeType: "image/png" });

  const got = await getAvatar(user.id);
  expect(got?.mimeType).toBe("image/png");
  expect(got?.data.equals(PNG)).toBe(true);
});

it("upsert: a segunda gravação substitui a anterior", async () => {
  const user = await seedUser({ email: "b@x.com", password: "pass-123" });
  await setAvatar(user.id, {
    bytes: Buffer.from([1, 2, 3]),
    mimeType: "image/png",
  });
  await setAvatar(user.id, { bytes: PNG, mimeType: "image/webp" });

  const got = await getAvatar(user.id);
  expect(got?.mimeType).toBe("image/webp");
  expect(got?.data.equals(PNG)).toBe(true);
});

it("clearAvatar remove a linha (e é idempotente)", async () => {
  const user = await seedUser({ email: "c@x.com", password: "pass-123" });
  await setAvatar(user.id, { bytes: PNG, mimeType: "image/png" });

  await clearAvatar(user.id);
  expect(await getAvatar(user.id)).toBeNull();
  await clearAvatar(user.id); // idempotente
  expect(await getAvatar(user.id)).toBeNull();
});
