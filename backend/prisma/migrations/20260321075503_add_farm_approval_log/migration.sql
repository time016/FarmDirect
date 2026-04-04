-- CreateEnum
CREATE TYPE "FarmApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateTable
CREATE TABLE "farm_approval_logs" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "FarmApprovalAction" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_approval_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "farm_approval_logs" ADD CONSTRAINT "farm_approval_logs_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_approval_logs" ADD CONSTRAINT "farm_approval_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
