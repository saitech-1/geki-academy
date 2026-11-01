import type { PrismaClient } from "@prisma/client";
import { summarizeCourseLearning } from "../lib/course-learning";

export async function academyCourses(
  db: PrismaClient,
  userId: string,
  ownedOnly: boolean,
) {
  const courses = await db.course.findMany({
    where: {
      status: "PUBLISHED",
      ...(ownedOnly
        ? { purchases: { some: { userId, revokedAt: null } } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { video: { status: "PUBLISHED" } },
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              titleMm: true,
              description: true,
              videoId: true,
              preview: true,
              video: { select: { duration: true } },
            },
          },
        },
      },
      purchases: { where: { userId, revokedAt: null }, select: { id: true } },
      paymentOrders: { where: { userId }, select: { status: true } },
    },
  });
  const progress = await db.progress.findMany({
    where: {
      userId,
      videoId: {
        in: [
          ...new Set(
            courses.flatMap((c) =>
              c.sections.flatMap((s) => s.lessons.map((l) => l.videoId)),
            ),
          ),
        ],
      },
    },
    select: {
      videoId: true,
      completedAt: true,
      position: true,
      updatedAt: true,
    },
  });
  return courses.map(({ purchases, paymentOrders, ...course }) => ({
    ...course,
    learning: summarizeCourseLearning(
      course.sections.flatMap((s) => s.lessons),
      progress,
      purchases.length > 0,
      paymentOrders[0]?.status || null,
    ),
  }));
}
