-- CreateTable
CREATE TABLE "geki"."PushSubscription" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_deviceId_key" ON "geki"."PushSubscription"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "geki"."PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "geki"."PushSubscription" ADD CONSTRAINT "PushSubscription_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "geki"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Push endpoints and encryption keys are server-only account data.
ALTER TABLE "geki"."PushSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_data_api ON "geki"."PushSubscription" AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='geki_api') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "geki"."PushSubscription" TO geki_api;
  END IF;
END $$;
