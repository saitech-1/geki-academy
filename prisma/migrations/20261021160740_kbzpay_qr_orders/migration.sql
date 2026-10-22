-- AlterTable
ALTER TABLE "geki"."Course" ADD COLUMN     "kbzPayEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "geki"."PaymentOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MMK',
    "status" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "transactionId" TEXT,
    "proofSha" TEXT,
    "proofPath" TEXT,
    "proofMime" TEXT,
    "submissions" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "reviewReason" TEXT,
    "qrImage" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_transactionId_key" ON "geki"."PaymentOrder"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_proofSha_key" ON "geki"."PaymentOrder"("proofSha");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_createdAt_idx" ON "geki"."PaymentOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_courseId_idx" ON "geki"."PaymentOrder"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_userId_courseId_key" ON "geki"."PaymentOrder"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "geki"."PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."PaymentOrder" ADD CONSTRAINT "PaymentOrder_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "geki"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "geki"."PaymentOrder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_data_api ON "geki"."PaymentOrder" AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
ALTER TABLE "geki"."PaymentOrder" ADD CONSTRAINT "PaymentOrder_amount_positive" CHECK ("amountMinor">0);
ALTER TABLE "geki"."PaymentOrder" ADD CONSTRAINT "PaymentOrder_status_valid" CHECK (status IN ('AWAITING_PAYMENT','SUBMITTED','APPROVED','REJECTED'));
