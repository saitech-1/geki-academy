import assert from "node:assert/strict";
import { randomUUID, createECDH, randomBytes } from "node:crypto";
import webpush from "web-push";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import { firebaseAdmin } from "../src/server/auth.js";
import {
  paymentPushNotifications,
  deliverPushMessages,
  pushSettings,
  validPushEndpoint,
  PUSH_MESSAGE,
} from "../src/server/push.js";

assert.equal(
  new URL(config.databaseUrl).hostname,
  "127.0.0.1",
  "Push fixtures require local PostgreSQL",
);
assert.notEqual(process.env.NODE_ENV, "production");
const vapid = webpush.generateVAPIDKeys();
process.env.WEB_PUSH_PUBLIC_KEY = vapid.publicKey;
process.env.WEB_PUSH_PRIVATE_KEY = vapid.privateKey;
process.env.WEB_PUSH_SUBJECT = "mailto:fixture@example.com";
assert.equal(pushSettings().publicKey, vapid.publicKey);
for (const endpoint of [
  "http://fcm.googleapis.com/x",
  "https://localhost/x",
  "https://fcm.googleapis.com.evil.test/x",
  "https://user:pass@fcm.googleapis.com/x",
  "https://fcm.googleapis.com:444/x",
])
  assert.equal(validPushEndpoint(endpoint), false);
assert.equal(
  validPushEndpoint("https://fcm.googleapis.com/fcm/send/fixture"),
  true,
);
const id = randomUUID();
const users: string[] = [];
const identities: string[] = [];
let courseId = "",
  orderId = "";
try {
  for (const role of ["STUDENT", "ADMIN"] as const) {
    const user = await db.user.create({
      data: {
        firebaseUid: `${id}-${role}`,
        email: `${id}-${role}@example.com`,
        displayName: "Push fixture",
        role,
      },
    });
    users.push(user.id);
    const device = await db.device.create({
      data: {
        userId: user.id,
        secretHash: randomUUID(),
        label: "Fixture browser",
      },
    });
    const curve = createECDH("prime256v1");
    curve.generateKeys();
    await db.pushSubscription.create({
      data: {
        deviceId: device.id,
        endpoint: `https://fcm.googleapis.com/fcm/send/${id}-${role}`,
        p256dh: curve.getPublicKey().toString("base64url"),
        auth: randomBytes(16).toString("base64url"),
        keyId: pushSettings().keyId,
      },
    });
  }
  const course = await db.course.create({
    data: {
      slug: `push-${id}`,
      title: "Push fixture",
      description: "Test only",
    },
  });
  courseId = course.id;
  const order = await db.paymentOrder.create({
    data: {
      userId: users[0],
      courseId,
      amountMinor: 3500000,
      status: "SUBMITTED",
      submissions: 1,
      qrImage: "fixture",
      recipient: "fixture",
    },
  });
  orderId = order.id;
  const scope = {
    kind: PUSH_MESSAGE,
    payload: { path: ["orderId"], equals: orderId },
  };
  const worker = (options: Parameters<typeof deliverPushMessages>[1]) =>
    deliverPushMessages(db, { ...options, orderId, limit: 10 });
  await db.$transaction(async (tx) => {
    await paymentPushNotifications(tx, orderId, "SUBMITTED");
    await paymentPushNotifications(tx, orderId, "SUBMITTED");
  });
  assert.equal(
    await db.job.count({ where: scope }),
    1,
    "Duplicate event must not queue twice",
  );
  await assert.rejects(
    db.$transaction((tx) => paymentPushNotifications(tx, orderId, "APPROVED")),
  );
  let sends = 0;
  const send: typeof webpush.sendNotification = async (
    subscription,
    payload,
    options,
  ) => {
    sends++;
    const message = JSON.parse(String(payload));
    assert.ok(!message.body.includes("35,000") && !message.body.includes("@"));
    assert.ok(["/admin/payments", "/my-learning"].includes(message.href));
    const encrypted = webpush.generateRequestDetails(
      subscription,
      payload,
      options,
    );
    assert.ok(
      encrypted.body && encrypted.headers.Authorization,
      "Payload must be encrypted and VAPID signed",
    );
    return { statusCode: 201, body: "", headers: {} };
  };
  await Promise.all([worker({ send }), worker({ send })]);
  assert.equal(sends, 1, "Concurrent workers must claim only once");
  await db.$transaction(async (tx) => {
    await tx.paymentOrder.update({
      where: { id: orderId },
      data: { status: "APPROVED" },
    });
    await tx.coursePurchase.create({
      data: {
        userId: users[0],
        courseId,
        paymentReference: id,
        amountMinor: 3500000,
        currency: "MMK",
      },
    });
    await paymentPushNotifications(tx, orderId, "APPROVED", users[1]);
    await paymentPushNotifications(tx, orderId, "APPROVED", users[1]);
  });
  assert.equal(
    await db.job.count({ where: scope }),
    3,
    "Learner and reviewer each receive approval",
  );
  const now = new Date(Date.now() + 1000);
  await worker({
    now,
    send: async () => {
      throw Object.assign(Error("secret must not persist"), {
        statusCode: 429,
      });
    },
  });
  assert.equal(
    await db.job.count({
      where: { ...scope, status: "PENDING", lastError: "PUSH_429" },
    }),
    2,
  );
  assert.equal(
    await db.coursePurchase.count({
      where: { userId: users[0], revokedAt: null },
    }),
    1,
    "Delivery failure must not reverse access",
  );
  await worker({ now: new Date(now.getTime() + 61000), send });
  assert.equal(sends, 3);
  await db.job.updateMany({
    where: scope,
    data: { status: "PENDING", attempts: 0, runAt: now },
  });
  await worker({ now, send });
  assert.equal(
    sends,
    5,
    "Stale submitted alert must be skipped after approval",
  );
  await db.device.updateMany({
    where: { userId: users[0] },
    data: { revokedAt: now },
  });
  await db.job.updateMany({
    where: { ...scope, status: "SENT" },
    data: { status: "PENDING", attempts: 0, runAt: now },
  });
  await worker({ now, send });
  assert.equal(
    sends,
    6,
    "Revoked learner device must not receive push; active admin still receives it",
  );
  await db.device.updateMany({
    where: { userId: users[0] },
    data: { revokedAt: null },
  });
  await db.job.updateMany({
    where: { ...scope, status: { in: ["SENT", "SKIPPED"] } },
    data: { status: "PENDING", attempts: 0, runAt: now },
  });
  await worker({
    now,
    send: async () => {
      throw Object.assign(Error("expired"), { statusCode: 410 });
    },
  });
  assert.equal(
    await db.pushSubscription.count({
      where: { device: { userId: { in: users } } },
    }),
    0,
    "Expired subscriptions must be removed",
  );
  // Exercise authenticated HTTP ownership against the running local app as well.
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
  const tokens: string[] = [],
    deviceKeys: string[] = [];
  for (const userId of users) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const identity = await firebaseAdmin.createUser({
      uid: user.firebaseUid,
      email: user.email,
      password: "GekiLocal!2026",
      emailVerified: true,
    });
    identities.push(identity.uid);
    const result = (await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: "GekiLocal!2026",
          returnSecureToken: true,
        }),
      },
    ).then((r) => r.json())) as { idToken: string };
    assert.ok(result.idToken);
    tokens.push(result.idToken);
    const key = randomBytes(32).toString("hex");
    deviceKeys.push(key);
    const { createHash } = await import("node:crypto");
    await db.device.updateMany({
      where: { userId },
      data: { secretHash: createHash("sha256").update(key).digest("hex") },
    });
  }
  const call = async (
    index: number,
    method: string,
    path: string,
    body?: unknown,
    device = deviceKeys[index],
  ) => {
    const response = await fetch("http://127.0.0.1:3000/api/me/push/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + tokens[index],
        "Content-Type": "application/json",
        "X-Device-Key": device,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  };
  const status = await call(0, "GET", "status");
  assert.equal(status.body.configured, true);
  assert.equal(status.body.privateKey, undefined);
  const curve = createECDH("prime256v1");
  curve.generateKeys();
  const input = {
    endpoint: `https://fcm.googleapis.com/fcm/send/api-${id}`,
    keys: {
      p256dh: curve.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  assert.equal(
    (
      await call(
        0,
        "POST",
        "subscription",
        input,
        "unregistered-" + randomUUID(),
      )
    ).status,
    403,
  );
  assert.equal((await call(0, "POST", "subscription", input)).status, 200);
  assert.equal((await call(0, "GET", "status")).body.enabled, true);
  assert.equal((await call(1, "POST", "subscription", input)).status, 409);
  await call(1, "DELETE", "subscription", { endpoint: input.endpoint });
  assert.equal(
    (await call(0, "GET", "status")).body.enabled,
    true,
    "Other accounts cannot delete this device subscription",
  );
  await call(0, "DELETE", "subscription", { endpoint: input.endpoint });
  assert.equal((await call(0, "GET", "status")).body.enabled, false);
  console.log(
    "Push integration passed: endpoint safety, encrypted VAPID requests, event deduplication, concurrent leases, approval audiences, retry, stale-event suppression, expired subscriptions and preserved access.",
  );
} finally {
  for (const uid of identities) await firebaseAdmin.deleteUser(uid);
  if (orderId)
    await db.job.deleteMany({
      where: {
        kind: PUSH_MESSAGE,
        payload: { path: ["orderId"], equals: orderId },
      },
    });
  await db.notification.deleteMany({ where: { userId: { in: users } } });
  await db.coursePurchase.deleteMany({ where: { userId: { in: users } } });
  await db.paymentOrder.deleteMany({ where: { userId: { in: users } } });
  if (courseId) await db.course.delete({ where: { id: courseId } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
