export type CourseAccessStatus =
  | "LOCKED"
  | "AWAITING_PAYMENT"
  | "PENDING_PAYMENT"
  | "PAYMENT_REJECTED"
  | "ENROLLED"
  | "COMPLETED";
export function summarizeCourseLearning(
  lessons: { id: string; videoId: string }[],
  progress: {
    videoId: string;
    completedAt: Date | string | null;
    position: number;
    updatedAt: Date | string;
  }[],
  hasAccess: boolean,
  paymentStatus: string | null,
) {
  const byVideo = new Map(progress.map((p) => [p.videoId, p]));
  const completedLessons = lessons.filter(
    (l) => byVideo.get(l.videoId)?.completedAt,
  ).length;
  const last = lessons
    .filter((l) => {
      const p = byVideo.get(l.videoId);
      return p && !p.completedAt && p.position > 0;
    })
    .sort(
      (a, b) =>
        new Date(byVideo.get(b.videoId)!.updatedAt).getTime() -
        new Date(byVideo.get(a.videoId)!.updatedAt).getTime(),
    )[0];
  const complete = lessons.length > 0 && completedLessons === lessons.length;
  const status: CourseAccessStatus = hasAccess
    ? complete
      ? "COMPLETED"
      : "ENROLLED"
    : paymentStatus === "SUBMITTED"
      ? "PENDING_PAYMENT"
      : paymentStatus === "REJECTED"
        ? "PAYMENT_REJECTED"
        : paymentStatus === "AWAITING_PAYMENT"
          ? "AWAITING_PAYMENT"
          : "LOCKED";
  return {
    status,
    hasAccess,
    totalLessons: lessons.length,
    completedLessons: hasAccess ? completedLessons : 0,
    percent:
      hasAccess && lessons.length
        ? Math.floor((completedLessons / lessons.length) * 100)
        : 0,
    resumeLessonId: hasAccess
      ? (
          last ||
          lessons.find((l) => !byVideo.get(l.videoId)?.completedAt) ||
          lessons[0]
        )?.id || null
      : null,
    paymentStatus,
  };
}
