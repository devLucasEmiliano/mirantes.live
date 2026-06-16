import { hash, verify } from "@node-rs/argon2";

// argon2id é o algoritmo padrão do @node-rs/argon2 (por isso `algorithm` é omitido;
// além disso `Algorithm` é um `const enum` e não pode ser importado sob
// `isolatedModules`). Parâmetros alinhados à recomendação OWASP de 2024.
const ARGON2_OPTIONS = {
  memoryCost: 19_456, // 19 MiB por thread
  timeCost: 2, // iterações
  parallelism: 1, // threads
};

/** Deriva o hash argon2id de uma senha (o salt vai embutido no digest). */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/** Confere a senha contra o digest (parâmetros lidos do próprio hash). */
export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
