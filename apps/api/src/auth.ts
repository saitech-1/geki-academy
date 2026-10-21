import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@prisma/client";
import { config } from "./config.js";
import { db } from "./db.js";
import { HttpError } from "./domain.js";
import { acceptOwnerInvitation } from "./owner-bootstrap.js";
if (!getApps().length)
  initializeApp({
    projectId: config.projectId,
    ...(!process.env.FIREBASE_AUTH_EMULATOR_HOST
      ? { credential: applicationDefault() }
      : {}),
  });
export const firebaseAdmin = getAuth();
declare global {
  namespace Express {
    interface Request {
      account: User;
      identity: DecodedIdToken;
      deviceId?: string;
      requestId: string;
    }
  }
}
export async function auth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
    let token: DecodedIdToken;
    try {
      token = await firebaseAdmin.verifyIdToken(
        header.slice(7),
        process.env.FIREBASE_CHECK_REVOKED !== "false",
      );
    } catch {
      throw new HttpError(
        401,
        "INVALID_TOKEN",
        "Your sign-in has expired. Please sign in again.",
      );
    }
    let user = await db.user.upsert({
      where: { firebaseUid: token.uid },
      create: {
        firebaseUid: token.uid,
        email: token.email || "",
        displayName: token.name || "GEKI learner",
      },
      update: { email: token.email || "" },
    });
    if (user.suspended)
      throw new HttpError(
        403,
        "ACCOUNT_SUSPENDED",
        "This account is suspended. Contact GEKI support.",
      );
    user = await acceptOwnerInvitation(db, user, token, config.ownerEmail);
    if (user.suspended)
      throw new HttpError(
        403,
        "ACCOUNT_SUSPENDED",
        "This account is suspended. Contact GEKI support.",
      );
    req.account = user;
    req.identity = token;
    next();
  } catch (e) {
    next(e);
  }
}
export function admin(req: Request, _res: Response, next: NextFunction) {
  if (req.account.role === "STUDENT")
    return next(
      new HttpError(403, "FORBIDDEN", "Administrator access is required."),
    );
  if (!req.identity.email_verified)
    return next(
      new HttpError(
        403,
        "EMAIL_UNVERIFIED",
        "Verify your email before continuing.",
      ),
    );
  next();
}
export async function courseAccess(req: Request, courseId: string) {
  if (!req.identity.email_verified)
    throw new HttpError(
      403,
      "EMAIL_UNVERIFIED",
      "Verify your email before accessing paid lessons.",
    );
  if (req.account.role !== "STUDENT") return;
  if (!req.account.onboarded)
    throw new HttpError(
      403,
      "PROFILE_REQUIRED",
      "Complete your adult/guardian learner profile in Settings first.",
    );
  const purchase = await db.coursePurchase.findUnique({
    where: { userId_courseId: { userId: req.account.id, courseId } },
  });
  if (!purchase || purchase.revokedAt)
    throw new HttpError(
      403,
      "COURSE_PURCHASE_REQUIRED",
      "Purchase this course to unlock its lessons and quiz. Your progress remains saved.",
    );
  return purchase;
}
export async function ticketCourseAccess(userId: string, courseId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      suspended: true,
      onboarded: true,
      purchases: { where: { courseId, revokedAt: null }, select: { id: true } },
    },
  });
  return (
    !!user &&
    !user.suspended &&
    (user.role !== "STUDENT" || (user.onboarded && user.purchases.length > 0))
  );
}
