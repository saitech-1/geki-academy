import { expect, it } from "vitest";
import { summarizeCourseLearning } from "./course-learning";
const lessons = [
  { id: "lesson-a", videoId: "a" },
  { id: "lesson-b", videoId: "b" },
];
const progress = [
  {
    videoId: "a",
    completedAt: "2026-10-01",
    position: 100,
    updatedAt: "2026-10-01",
  },
  { videoId: "b", completedAt: null, position: 30, updatedAt: "2026-10-02" },
  {
    videoId: "unowned",
    completedAt: "2026-10-01",
    position: 100,
    updatedAt: "2026-10-03",
  },
];
it("excludes unrelated progress and resumes the correct owned lesson", () => {
  expect(
    summarizeCourseLearning(lessons, progress, true, "APPROVED"),
  ).toMatchObject({
    percent: 50,
    completedLessons: 1,
    resumeLessonId: "lesson-b",
    status: "ENROLLED",
  });
});
it("never unlocks pending, rejected, or revoked access based on old watch history", () => {
  for (const payment of [
    "SUBMITTED",
    "REJECTED",
    "APPROVED",
    "AWAITING_PAYMENT",
  ])
    expect(
      summarizeCourseLearning(lessons, progress, false, payment),
    ).toMatchObject({ hasAccess: false, percent: 0, resumeLessonId: null });
});
it("only completes nonempty courses with every lesson completed", () => {
  expect(summarizeCourseLearning([], [], true, null).status).toBe("ENROLLED");
  expect(
    summarizeCourseLearning(lessons.slice(0, 1), progress, true, null),
  ).toMatchObject({ status: "COMPLETED", percent: 100 });
});
