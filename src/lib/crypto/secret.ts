import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

// Cifra simétrica em repouso (SPEC §11) p/ o token OAuth do GitHub: AES-256-GCM.
// GCM dá confidencialidade + integridade — a `authTag` detecta adulteração e a
// chave errada, então `decryptSecret` LANÇA nesses casos (o chamador trata como
// `invalid_token`). A chave vive só em `env.GITHUB_TOKEN_ENC_KEY` (32 bytes base64,
// validada no boot) — nunca no banco, log ou resposta ao cliente.

/** Campos base64 guardados lado a lado no Postgres (github_connections). */
export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function key(): Buffer {
  return Buffer.from(env.GITHUB_TOKEN_ENC_KEY, "base64"); // 32 bytes (validado no env)
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12); // nonce GCM novo a cada chamada (nunca reusar sob a mesma chave)
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(input: EncryptedSecret): string {
  // Lança em adulteração (ciphertext/iv/authTag) ou chave errada — a integridade do GCM.
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(input.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
