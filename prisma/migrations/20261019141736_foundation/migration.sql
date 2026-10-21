-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "geki";

-- CreateEnum
CREATE TYPE "geki"."Role" AS ENUM ('STUDENT', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "geki"."ContentStatus" AS ENUM ('DRAFT', 'PROCESSING', 'REVIEW', 'READY', 'PUBLISHED');

-- CreateTable
CREATE TABLE "geki"."User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "geki"."Role" NOT NULL DEFAULT 'STUDENT',
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "accountType" TEXT NOT NULL DEFAULT 'ADULT',
    "consentAt" TIMESTAMP(3),
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleMm" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "descriptionMm" TEXT NOT NULL DEFAULT '',
    "instructor" TEXT NOT NULL DEFAULT 'GEKI Instruction Team',
    "thumbnail" TEXT NOT NULL DEFAULT '/images/hero.jpg',
    "category" TEXT NOT NULL DEFAULT 'Kihon',
    "status" "geki"."ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Section" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleMm" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "providerAssetId" TEXT,
    "localPath" TEXT,
    "mimeType" TEXT,
    "status" "geki"."ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Subtitle" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subtitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Lesson" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleMm" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "preview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "watchedSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "watchedRanges" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Quiz" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."QuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "review" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."DeviceReplacement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceReplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."PlaybackSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PlaybackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT NOT NULL DEFAULT '/dashboard',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geki"."Job" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "geki"."User"("firebaseUid");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "geki"."User"("email");

-- CreateIndex
CREATE INDEX "Membership_userId_endsAt_idx" ON "geki"."Membership"("userId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "geki"."Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Section_courseId_position_key" ON "geki"."Section"("courseId", "position");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "geki"."Video"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Subtitle_videoId_language_key" ON "geki"."Subtitle"("videoId", "language");

-- CreateIndex
CREATE INDEX "Lesson_videoId_idx" ON "geki"."Lesson"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_sectionId_position_key" ON "geki"."Lesson"("sectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_userId_videoId_key" ON "geki"."Progress"("userId", "videoId");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_courseId_key" ON "geki"."Quiz"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_quizId_position_key" ON "geki"."Question"("quizId", "position");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_idx" ON "geki"."QuizAttempt"("userId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_secretHash_key" ON "geki"."Device"("secretHash");

-- CreateIndex
CREATE INDEX "Device_userId_revokedAt_idx" ON "geki"."Device"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "DeviceReplacement_userId_createdAt_idx" ON "geki"."DeviceReplacement"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybackSession_userId_key" ON "geki"."PlaybackSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "geki"."Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "geki"."Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "geki"."Payment"("providerReference");

-- AddForeignKey
ALTER TABLE "geki"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Section" ADD CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "geki"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Subtitle" ADD CONSTRAINT "Subtitle_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "geki"."Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Lesson" ADD CONSTRAINT "Lesson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "geki"."Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Lesson" ADD CONSTRAINT "Lesson_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "geki"."Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Progress" ADD CONSTRAINT "Progress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "geki"."Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Quiz" ADD CONSTRAINT "Quiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "geki"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "geki"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "geki"."Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."DeviceReplacement" ADD CONSTRAINT "DeviceReplacement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."PlaybackSession" ADD CONSTRAINT "PlaybackSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "geki"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geki"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "geki"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
