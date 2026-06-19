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
  // OAuth App do GitHub (spec 009): cada usuário conecta a própria conta e o
  // token vai cifrado p/ o banco — não há mais PAT global.
  GITHUB_OAUTH_CLIENT_ID: z
    .string()
    .min(1, "GITHUB_OAUTH_CLIENT_ID é obrigatória"),
  GITHUB_OAUTH_CLIENT_SECRET: z
    .string()
    .min(1, "GITHUB_OAUTH_CLIENT_SECRET é obrigatória"),
  // Chave AES-256-GCM (32 bytes em base64) que cifra o token OAuth em repouso.
  GITHUB_TOKEN_ENC_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "GITHUB_TOKEN_ENC_KEY precisa decodificar para 32 bytes (base64)",
    ),
  // Base pública do app — monta o redirect_uri do OAuth e os 303 de retorno.
  APP_BASE_URL: z.string().url("APP_BASE_URL precisa ser uma URL válida"),
  // "1" curto-circuita a ida ao github.com no e2e (sem rede). Opcional.
  GITHUB_OAUTH_FAKE: z.string().optional(),
  // --- Classificador LLM commit→meta (spec 013) — runtime externo OPCIONAL e plugável.
  // Default `none` (offline) → atribuição cai no resolver determinístico. `http` fala
  // OpenAI-compatível (Ollama/LM Studio/Unsloth) via fetch nativo; `mcp` via MCP.
  LLM_CLASSIFIER_KIND: z.enum(["http", "mcp", "none"]).default("none"),
  LLM_CLASSIFIER_BASE_URL: z.string().url().optional(),
  LLM_CLASSIFIER_MODEL: z.string().optional(),
  LLM_CLASSIFIER_API_KEY: z.string().optional(),
  LLM_CLASSIFIER_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  // Peso por commit atribuído: avança `current_value` da meta. CI não conta (§spec 013).
  GOAL_WEIGHT_COMMIT: z.coerce.number().default(1),
  GOAL_WEIGHT_MERGE: z.coerce.number().default(5),
  // Token de serviço do servidor MCP (stdio). Obrigatório p/ INICIAR o MCP (fail-closed);
  // opcional no resto do app (o boot do Next não exige).
  MCP_SERVICE_TOKEN: z.string().min(16).optional(),
  MCP_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
  MCP_HTTP_PORT: z.coerce.number().int().positive().optional(),
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
