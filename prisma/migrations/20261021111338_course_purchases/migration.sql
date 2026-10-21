-- AlterTable
ALTER TABLE "geki"."Course" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MMK',
ADD COLUMN     "priceMinor" INTEGER;

-- CreateTable
CREATE TABLE "geki"."CoursePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CoursePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoursePurchase_paymentReference_key" ON "geki"."CoursePurchase"("paymentReference");

-- CreateIndex
CREATE INDEX "CoursePurchase_courseId_idx" ON "geki"."CoursePurchase"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePurchase_userId_courseId_key" ON "geki"."CoursePurchase"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "geki"."CoursePurchase" ADD CONSTRAINT "CoursePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."CoursePurchase" ADD CONSTRAINT "CoursePurchase_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "geki"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "geki"."CoursePurchase" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_data_api ON "geki"."CoursePurchase" AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
ALTER TABLE "geki"."CoursePurchase" ADD CONSTRAINT "CoursePurchase_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "geki"."Course" ADD CONSTRAINT "Course_price_positive" CHECK ("priceMinor" IS NULL OR "priceMinor" > 0);
