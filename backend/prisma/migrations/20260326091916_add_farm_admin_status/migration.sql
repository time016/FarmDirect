-- CreateEnum
CREATE TYPE "FarmAdminStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "farm_admins" ADD COLUMN     "status" "FarmAdminStatus" NOT NULL DEFAULT 'PENDING';
