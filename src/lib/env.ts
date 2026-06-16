import { z } from "zod";

// Validação das variáveis de ambiente do servidor (SPEC §11). Falha cedo e com
// mensagem clara se algo essencial faltar — melhor explodir no boot do que ter
// um cookie assinado com `undefined` ou uma conexão sem URL.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  REDIS_URL: z.string().min(1, "REDIS_URL é obrigatória"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET precisa de ao menos 32 caracteres"),
  GITHUB_PAT: z.string().optional(),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
