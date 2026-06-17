-- CreateTable: conexão OAuth por usuário (token cifrado em repouso, AES-256-GCM).
CREATE TABLE "github_connections" (
    "user_id" UUID NOT NULL,
    "token_ciphertext" TEXT NOT NULL,
    "token_iv" TEXT NOT NULL,
    "token_auth_tag" TEXT NOT NULL,
    "github_login" TEXT NOT NULL,
    "github_user_id" BIGINT NOT NULL,
    "scopes" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_connections_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey: github_connections.user_id → users.id (cascade apaga a conexão).
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Project ganha dono. Ordem obrigatória (uma FK NÃO-NULA não entra em linhas existentes):
-- 1) coluna NULLABLE primeiro.
ALTER TABLE "projects" ADD COLUMN "user_id" UUID;

-- 2) backfill: linhas pré-existentes apontam para o admin mais antigo (no-op em DB vazio).
UPDATE "projects"
SET "user_id" = (SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at" ASC LIMIT 1)
WHERE "user_id" IS NULL;

-- 3) agora a coluna pode ser NOT NULL.
ALTER TABLE "projects" ALTER COLUMN "user_id" SET NOT NULL;

-- 4) troca a unicidade: (owner, repo) global → (user_id, owner, repo) por dono + índice do dono.
DROP INDEX "projects_owner_repo_key";
CREATE UNIQUE INDEX "projects_user_id_owner_repo_key" ON "projects"("user_id", "owner", "repo");
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- 5) FK por último (coluna já NOT NULL e preenchida).
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
