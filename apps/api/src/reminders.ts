import type { PrismaClient } from "@prisma/client";
type Period = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  revokedAt: Date | null;
};
const DAY = 86400000;
export function reminderFor(periods: Period[], now: Date) {
  const valid = periods
    .filter((p) => !p.revokedAt && p.startsAt <= now)
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
  let period = valid[0];
  if (!period) return null;
  // An already purchased, contiguous renewal extends the effective access horizon.
  for (;;) {
    const renewal = periods
      .filter(
        (p) =>
          !p.revokedAt &&
          p.startsAt <= period!.endsAt &&
          p.endsAt > period!.endsAt,
      )
      .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
    if (!renewal) break;
    period = renewal;
  }
  const remaining = period.endsAt.getTime() - now.getTime();
  const stage =
    remaining <= 0 && remaining > -7 * DAY
      ? "EXPIRED"
      : remaining > 0 && remaining <= DAY
        ? "ONE_DAY"
        : remaining > 6 * DAY && remaining <= 7 * DAY
          ? "SEVEN_DAYS"
          : null;
  return stage ? { period, stage } : null;
}
export async function createMembershipReminders(
  db: PrismaClient,
  now = new Date(),
) {
  let cursor: string | undefined;
  let created = 0;
  for (;;) {
    const users = await db.user.findMany({
      where: {
        suspended: false,
        memberships: {
          some: {
            revokedAt: null,
            startsAt: { lte: now },
            endsAt: { gt: new Date(now.getTime() - 7 * DAY) },
          },
        },
      },
      orderBy: { id: "asc" },
      take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        language: true,
        memberships: {
          where: { revokedAt: null },
          select: { id: true, startsAt: true, endsAt: true, revokedAt: true },
        },
      },
    });
    if (!users.length) break;
    const notifications = users.flatMap((user) => {
      const reminder = reminderFor(user.memberships, now);
      if (!reminder) return [];
      const expired = reminder.stage === "EXPIRED";
      const burmese = user.language === "mm";
      const date = reminder.period.endsAt.toISOString().slice(0, 10);
      return [
        {
          userId: user.id,
          title: burmese
            ? expired
              ? "အဖွဲ့ဝင်သက်တမ်း ကုန်ဆုံးသွားပါပြီ"
              : "အဖွဲ့ဝင်သက်တမ်း မကြာမီ ကုန်ဆုံးပါမည်"
            : expired
              ? "Your membership has expired"
              : "Your membership expires soon",
          body: burmese
            ? `${date} တွင် သက်တမ်းကုန်ဆုံးပါသည်။ သင်ယူမှုမှတ်တမ်းများကို သိမ်းဆည်းထားပါသည်။`
            : `Your learning access ${expired ? "ended" : "ends"} on ${date} (UTC). Your progress and quiz results remain saved. View membership details to renew.`,
          href: "/membership",
          dedupeKey: `membership:${reminder.period.id}:${date}:${reminder.stage}`,
        },
      ];
    });
    if (notifications.length)
      created += (
        await db.notification.createMany({
          data: notifications,
          skipDuplicates: true,
        })
      ).count;
    cursor = users.at(-1)!.id;
  }
  return { created };
}
