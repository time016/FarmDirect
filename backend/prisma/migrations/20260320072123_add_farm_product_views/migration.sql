-- CreateTable
CREATE TABLE "farm_views" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_views" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "farm_views_farmId_viewedAt_idx" ON "farm_views"("farmId", "viewedAt");

-- CreateIndex
CREATE INDEX "product_views_productId_viewedAt_idx" ON "product_views"("productId", "viewedAt");

-- AddForeignKey
ALTER TABLE "farm_views" ADD CONSTRAINT "farm_views_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
