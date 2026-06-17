-- CreateTable
CREATE TABLE "events" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref_id" TEXT,
    "project_id" UUID,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "visible_to_client" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_created_at_idx" ON "events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "events_visible_to_client_created_at_idx" ON "events"("visible_to_client", "created_at" DESC);

-- CreateIndex
CREATE INDEX "events_project_id_created_at_idx" ON "events"("project_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
