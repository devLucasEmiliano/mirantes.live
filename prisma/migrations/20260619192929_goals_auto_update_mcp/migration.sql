-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "project_id" UUID,
    "short_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "due_date" DATE NOT NULL,
    "start_value" DOUBLE PRECISION,
    "target_value" DOUBLE PRECISION,
    "current_value" DOUBLE PRECISION,
    "position" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_branch_links" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "branch_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_branch_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commit_goal_links" (
    "id" UUID NOT NULL,
    "commit_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "applied_value" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commit_goal_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_code_counters" (
    "project_id" UUID NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "goal_code_counters_pkey" PRIMARY KEY ("project_id")
);

-- CreateIndex
CREATE INDEX "goals_parent_id_idx" ON "goals"("parent_id");

-- CreateIndex
CREATE INDEX "goals_deleted_at_idx" ON "goals"("deleted_at");

-- CreateIndex
CREATE INDEX "goals_due_date_idx" ON "goals"("due_date");

-- CreateIndex
CREATE INDEX "goals_project_id_idx" ON "goals"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "goals_project_id_short_code_key" ON "goals"("project_id", "short_code");

-- CreateIndex
CREATE INDEX "goal_branch_links_goal_id_idx" ON "goal_branch_links"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "goal_branch_links_project_id_branch_name_key" ON "goal_branch_links"("project_id", "branch_name");

-- CreateIndex
CREATE INDEX "commit_goal_links_goal_id_idx" ON "commit_goal_links"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "commit_goal_links_commit_id_goal_id_key" ON "commit_goal_links"("commit_id", "goal_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_branch_links" ADD CONSTRAINT "goal_branch_links_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_branch_links" ADD CONSTRAINT "goal_branch_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commit_goal_links" ADD CONSTRAINT "commit_goal_links_commit_id_fkey" FOREIGN KEY ("commit_id") REFERENCES "commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commit_goal_links" ADD CONSTRAINT "commit_goal_links_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_code_counters" ADD CONSTRAINT "goal_code_counters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
