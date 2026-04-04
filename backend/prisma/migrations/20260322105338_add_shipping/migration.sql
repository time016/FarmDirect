-- AlterTable
ALTER TABLE "farms" ADD COLUMN     "shippingRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- CreateTable
CREATE TABLE "shipping_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseRate" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "weightLimitKg" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "perKgRate" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "freeThreshold" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "minBaseRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "maxBaseRate" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_config_pkey" PRIMARY KEY ("id")
);
