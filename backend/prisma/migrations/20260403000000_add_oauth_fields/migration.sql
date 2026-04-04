-- AlterTable: make password nullable for OAuth users
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable: add OAuth and password reset fields
ALTER TABLE "users"
ADD COLUMN "googleId" TEXT,
ADD COLUMN "lineId" TEXT,
ADD COLUMN "passwordResetToken" TEXT,
ADD COLUMN "passwordResetExpiry" TIMESTAMP(3);

-- CreateIndex: unique constraints for OAuth IDs
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
CREATE UNIQUE INDEX "users_lineId_key" ON "users"("lineId");
