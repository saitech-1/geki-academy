export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function requireCondition(
  value: unknown,
  status: number,
  code: string,
  message: string,
): asserts value {
  if (!value) throw new HttpError(status, code, message);
}
export function membershipActive(
  m: { startsAt: Date; endsAt: Date; revokedAt: Date | null },
  now = new Date(),
) {
  return !m.revokedAt && m.startsAt <= now && m.endsAt > now;
}
export function watchedRanges(
  previous: unknown,
  start: number,
  end: number,
  duration: number,
) {
  const ranges = (Array.isArray(previous) ? previous : [])
    .filter(
      (v): v is number[] =>
        Array.isArray(v) &&
        v.length === 2 &&
        v.every((n) => typeof n === "number" && Number.isFinite(n)),
    )
    .map((v) => [v[0]!, v[1]!] as [number, number]);
  if (end > start) ranges.push([Math.max(0, start), Math.min(duration, end)]);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1] + 0.1)
      last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  return {
    ranges: merged,
    seconds: merged.reduce((n, [a, b]) => n + b - a, 0),
  };
}
export function grade(
  questions: {
    id: string;
    correctIndex: number;
    prompt: string;
    options: unknown;
    explanation: string;
  }[],
  answers: Record<string, number>,
) {
  requireCondition(
    questions.length > 0,
    409,
    "QUIZ_EMPTY",
    "This quiz has no questions.",
  );
  const review = questions.map((q) => ({
    questionId: q.id,
    prompt: q.prompt,
    options: q.options as string[],
    chosen: answers[q.id] ?? null,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    correct: answers[q.id] === q.correctIndex,
  }));
  const score = Math.round(
    (review.filter((q) => q.correct).length / questions.length) * 100,
  );
  return { score, passed: score >= 80, review };
}
