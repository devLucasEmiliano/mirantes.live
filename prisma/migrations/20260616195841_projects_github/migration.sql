-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "description" TEXT,
    "default_branch" TEXT,
    "last_polled_at" TIMESTAMP(3),
    "last_seen_sha" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commits" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "committed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "run_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "head_branch" TEXT,
    "head_sha" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "run_number" INTEGER NOT NULL,
    "html_url" TEXT NOT NULL,
    "run_started_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_owner_repo_key" ON "projects"("owner", "repo");

-- CreateIndex
CREATE INDEX "commits_project_id_committed_at_idx" ON "commits"("project_id", "committed_at");

-- CreateIndex
CREATE UNIQUE INDEX "commits_project_id_sha_key" ON "commits"("project_id", "sha");

-- CreateIndex
CREATE UNIQUE INDEX "branches_project_id_name_key" ON "branches"("project_id", "name");

-- CreateIndex
CREATE INDEX "workflow_runs_project_id_run_started_at_idx" ON "workflow_runs"("project_id", "run_started_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_project_id_run_id_key" ON "workflow_runs"("project_id", "run_id");

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
