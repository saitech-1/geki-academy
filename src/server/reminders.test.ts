import { describe, it, expect } from "vitest";
import { reminderFor } from "./reminders";
const now = new Date("2026-10-20T12:00:00Z");
const period = (days: number) => ({
  id: String(days),
  startsAt: new Date("2026-10-01"),
  endsAt: new Date(now.getTime() + days * 86400000),
  revokedAt: null,
});
describe("membership reminders", () => {
  it("selects seven-day, one-day and expiry reminders at their boundaries", () => {
    expect(reminderFor([period(7)], now)?.stage).toBe("SEVEN_DAYS");
    expect(reminderFor([period(1)], now)?.stage).toBe("ONE_DAY");
    expect(reminderFor([period(0)], now)?.stage).toBe("EXPIRED");
    expect(reminderFor([period(4)], now)).toBeNull();
    expect(reminderFor([period(-7)], now)).toBeNull();
  });
  it("does not remind revoked or future-only memberships", () => {
    expect(reminderFor([{ ...period(1), revokedAt: now }], now)).toBeNull();
    expect(
      reminderFor(
        [{ ...period(1), startsAt: new Date(now.getTime() + 1) }],
        now,
      ),
    ).toBeNull();
  });
  it("uses contiguous paid renewals without suppressing reminders for a gap", () => {
    const current = period(1);
    const renewal = { ...period(31), startsAt: current.endsAt };
    expect(reminderFor([current, renewal], now)).toBeNull();
    expect(
      reminderFor(
        [
          current,
          {
            ...renewal,
            startsAt: new Date(current.endsAt.getTime() + 86400000),
          },
        ],
        now,
      )?.stage,
    ).toBe("ONE_DAY");
  });
});
