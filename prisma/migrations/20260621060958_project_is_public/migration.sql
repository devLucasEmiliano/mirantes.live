-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "projects_is_public_idx" ON "projects"("is_public");
