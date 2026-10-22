import { describe, it, expect } from "vitest";
import { membershipActive, watchedRanges, grade } from "./domain";
describe("membership boundary", () => {
  it("denies expired, future and revoked memberships", () => {
    const now = new Date("2026-11-01");
    const valid = {
      startsAt: new Date("2026-10-01"),
      endsAt: new Date("2026-12-01"),
      revokedAt: null,
    };
    expect(membershipActive(valid, now)).toBe(true);
    expect(membershipActive({ ...valid, endsAt: now }, now)).toBe(false);
    expect(
      membershipActive({ ...valid, startsAt: new Date("2026-12-01") }, now),
    ).toBe(false);
    expect(membershipActive({ ...valid, revokedAt: now }, now)).toBe(false);
  });
});
describe("watch coverage", () => {
  it("does not count rewatches twice or fill skipped gaps", () => {
    const one = watchedRanges([], 0, 10, 100);
    const two = watchedRanges(one.ranges, 5, 15, 100);
    const three = watchedRanges(two.ranges, 80, 90, 100);
    expect(three.seconds).toBe(25);
    expect(three.ranges).toEqual([
      [0, 15],
      [80, 90],
    ]);
  });
});
describe("quiz server grading", () => {
  it("requires 80 percent and preserves explanations", () => {
    const q = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      correctIndex: 0,
      prompt: "Question",
      options: ["A", "B"],
      explanation: "Why",
    }));
    expect(grade(q, { "0": 0, "1": 0, "2": 0, "3": 0, "4": 1 }).passed).toBe(
      true,
    );
    const result = grade(q, { "0": 0, "1": 0, "2": 0, "3": 1, "4": 1 });
    expect(result.score).toBe(60);
    expect(result.passed).toBe(false);
    expect(result.review[0]?.explanation).toBe("Why");
  });
});
