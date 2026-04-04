-- AlterTable
ALTER TABLE "farms" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "farms_slug_key" ON "farms"("slug");
