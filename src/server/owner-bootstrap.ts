import { createHash } from "node:crypto";
import type { PrismaClient, User } from "@prisma/client";
export async function acceptOwnerInvitation(
  db: PrismaClient,
  user: User,
  identity: { email?: string; email_verified?: boolean },
  invitedEmail?: string,
) {
  const owner = invitedEmail?.trim().toLowerCase();
  if (
    !owner ||
    !identity.email_verified ||
    identity.email?.trim().toLowerCase() !== owner ||
    user.suspended
  )
    return user;
  const target = "owner:" + createHash("sha256").update(owner).digest("hex");
  return db.$transaction(async (tx) => {
    // Serialize the initial grant across API instances and concurrent sign-in requests.
    await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(73492181)`;
    const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (current.suspended) return current;
    const accepted = await tx.auditEvent.findFirst({
      where: { action: "OWNER_INVITATION_ACCEPTED", target },
    });
    if (accepted) return current;
    const ownerAccount = await tx.user.update({
      where: { id: current.id },
      data: { role: "SUPER_ADMIN" },
    });
    await tx.auditEvent.create({
      data: {
        actorId: current.id,
        action: "OWNER_INVITATION_ACCEPTED",
        target,
        reason:
          "Server-configured owner invitation accepted after verified Firebase email sign-in",
        data: { userId: current.id },
      },
    });
    return ownerAccount;
  });
}
