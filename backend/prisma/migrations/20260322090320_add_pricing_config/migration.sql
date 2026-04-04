-- CreateTable
CREATE TABLE "pricing_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "pricingModel" TEXT NOT NULL DEFAULT 'A',
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_config_pkey" PRIMARY KEY ("id")
);
