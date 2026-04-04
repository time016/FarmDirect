-- AlterTable
ALTER TABLE "farms" ADD COLUMN     "shippingFreeThreshold" DOUBLE PRECISION,
ADD COLUMN     "shippingPerKgRate" DOUBLE PRECISION,
ADD COLUMN     "shippingWeightLimitKg" DOUBLE PRECISION;
