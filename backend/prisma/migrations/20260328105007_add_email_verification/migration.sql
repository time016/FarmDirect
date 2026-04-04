-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailVerifyCode" TEXT,
ADD COLUMN     "emailVerifyExpiry" TIMESTAMP(3);
