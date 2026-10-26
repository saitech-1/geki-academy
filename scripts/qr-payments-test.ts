import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import { firebaseAdmin } from "../src/server/auth.js";
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  !config.databaseUrl.includes("127.0.0.1")
)
  throw Error("Local services only.");
const base = "http://127.0.0.1:3000/api";
async function login(email: string) {
  const data = (await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "GekiLocal!2026",
        returnSecureToken: true,
      }),
    },
  ).then((r) => r.json())) as { idToken: string };
  assert.ok(data.idToken);
  return data.idToken;
}
async function call(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: (await r.json()) as Record<string, any> };
}
const reason = "Local payment verification fixture, no real money moved";
async function buyer() {
  const email = `qr-test-${randomUUID()}@geki.local`;
  const identity = await firebaseAdmin.createUser({
    email,
    password: "GekiLocal!2026",
    emailVerified: true,
  });
  const user = await db.user.create({
    data: {
      firebaseUid: identity.uid,
      email,
      displayName: "QR checkout test",
      onboarded: true,
      consentAt: new Date(),
    },
  });
  return { email, user, token: await login(email) };
}
try {
  const admin = await login("admin@geki.local");
  const a = await buyer(),
    b = await buyer(),
    browser = await buyer(),
    devicesBuyer = await buyer();
  const course = await db.course.create({
    data: {
      title: "KBZPay QR verification package",
      slug: "qr-test-" + randomUUID(),
      description: "Local verification fixture only",
      status: "PUBLISHED",
      kbzPayEnabled: true,
      priceMinor: 5000000,
      currency: "MMK",
    },
  });
  const make = () =>
    call("/checkout", a.token, "POST", { courseId: course.id });
  assert.equal(
    (await call("/checkout", undefined, "POST", { courseId: course.id }))
      .status,
    401,
  );
  assert.equal(
    (
      await call("/checkout", a.token, "POST", {
        courseId: course.id,
        amountMinor: 1,
      })
    ).status,
    400,
  );
  const [one, two] = await Promise.all([make(), make()]);
  assert.equal(one.status, 200);
  assert.equal(one.data.id, two.data.id);
  assert.equal(one.data.amountMinor, 5000000);
  const order = one.data;
  const other = (
    await call("/checkout", b.token, "POST", { courseId: course.id })
  ).data;
  assert.equal(
    (await call("/me/payment-orders/" + order.id, b.token)).status,
    404,
  );
  assert.equal((await call("/admin/payment-orders", a.token)).status, 403);
  const bytes = Buffer.concat([
    await readFile("public/images/hero.jpg"),
    Buffer.from("test-fixture-" + randomUUID()),
  ]);
  const txid = "KBZTEST" + Date.now();
  function evidence(
    transactionId = txid,
    data: Uint8Array = bytes,
    type = "image/jpeg",
  ) {
    const f = new FormData();
    f.set("transactionId", transactionId);
    f.set("proof", new Blob([data as BlobPart], { type }), "receipt.jpg");
    return f;
  }
  assert.equal(
    (
      await call(
        `/me/payment-orders/${order.id}/proof`,
        a.token,
        "POST",
        evidence(txid, new TextEncoder().encode("not an image")),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        `/me/payment-orders/${order.id}/proof`,
        a.token,
        "POST",
        evidence(txid, bytes, "image/svg+xml"),
      )
    ).status,
    400,
  );
  const submitted = await call(
    `/me/payment-orders/${order.id}/proof`,
    a.token,
    "POST",
    evidence(),
  );
  assert.equal(submitted.status, 200);
  assert.equal(submitted.data.status, "SUBMITTED");
  assert.equal("proofPath" in submitted.data, false);
  assert.equal(
    await db.coursePurchase.count({ where: { userId: a.user.id } }),
    0,
  );
  assert.equal(
    (
      await call(
        `/me/payment-orders/${order.id}/proof`,
        a.token,
        "POST",
        evidence(),
      )
    ).status,
    409,
  );
  const proof = await fetch(base + `/me/payment-orders/${order.id}/proof`, {
    headers: { Authorization: "Bearer " + a.token },
  });
  assert.equal(proof.status, 200);
  assert.equal(proof.headers.get("content-type"), "image/jpeg");
  assert.match(proof.headers.get("cache-control") || "", /no-store/);
  assert.equal(
    (
      await fetch(base + `/me/payment-orders/${order.id}/proof`, {
        headers: { Authorization: "Bearer " + b.token },
      })
    ).status,
    404,
  );
  assert.equal(
    (await fetch(base + `/me/payment-orders/${order.id}/proof`)).status,
    401,
  );
  assert.equal(
    (
      await call(
        `/me/payment-orders/${other.id}/proof`,
        b.token,
        "POST",
        evidence(txid, Buffer.concat([bytes, Buffer.from("other")])),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        `/me/payment-orders/${other.id}/proof`,
        b.token,
        "POST",
        evidence(txid + "OTHER"),
      )
    ).status,
    409,
  );
  const review = (body: unknown) =>
    call(`/admin/payment-orders/${order.id}/review`, admin, "POST", body);
  assert.equal(
    (await review({ decision: "APPROVE", verifiedInKbzPay: false, reason }))
      .status,
    400,
  );
  assert.equal(
    (
      await call(`/admin/payment-orders/${order.id}/review`, a.token, "POST", {
        decision: "APPROVE",
        verifiedInKbzPay: true,
        reason,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await review({
        decision: "REJECT",
        reason:
          "Please submit a receipt showing the successful incoming transfer.",
      })
    ).status,
    200,
  );
  assert.equal(
    await db.coursePurchase.count({ where: { userId: a.user.id } }),
    0,
  );
  assert.equal(
    (
      await call(
        `/me/payment-orders/${order.id}/proof`,
        a.token,
        "POST",
        evidence(txid + "CORRECTED"),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        `/me/payment-orders/${other.id}/proof`,
        b.token,
        "POST",
        evidence(
          txid,
          Buffer.concat([bytes, Buffer.from("reused-old-reference")]),
        ),
      )
    ).status,
    409,
  );
  const approvals = await Promise.all([
    review({ decision: "APPROVE", verifiedInKbzPay: true, reason }),
    review({ decision: "APPROVE", verifiedInKbzPay: true, reason }),
  ]);
  assert.deepEqual(
    approvals.map((r) => r.status),
    [200, 200],
  );
  assert.equal(
    await db.coursePurchase.count({
      where: { userId: a.user.id, courseId: course.id },
    }),
    1,
  );
  assert.equal(
    await db.auditEvent.count({
      where: { target: order.id, action: "PAYMENT_APPROVED" },
    }),
    1,
  );
  assert.equal((await make()).status, 409);
  assert.equal((await review({ decision: "REJECT", reason })).status, 409);
  await db.coursePurchase.updateMany({
    where: { userId: a.user.id, courseId: course.id },
    data: { revokedAt: new Date() },
  });
  assert.equal(
    (await review({ decision: "APPROVE", verifiedInKbzPay: true, reason }))
      .status,
    200,
  );
  assert.ok(
    (
      await db.coursePurchase.findUniqueOrThrow({
        where: { userId_courseId: { userId: a.user.id, courseId: course.id } },
      })
    ).revokedAt,
  );
  // A learner submits only a photo; the administrator records the bank reference.
  const photoOnly = new FormData();
  photoOnly.set(
    "proof",
    new Blob([Buffer.concat([bytes, Buffer.from("photo-only")])], {
      type: "image/jpeg",
    }),
    "receipt.jpg",
  );
  const photoSubmitted = await call(
    `/me/payment-orders/${other.id}/proof`,
    b.token,
    "POST",
    photoOnly,
  );
  assert.equal(photoSubmitted.status, 200);
  assert.equal(photoSubmitted.data.transactionId, null);
  assert.equal(
    (
      await call(`/admin/payment-orders/${other.id}/review`, admin, "POST", {
        decision: "APPROVE",
        verifiedInKbzPay: true,
        reason,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/admin/payment-orders/${other.id}/review`, admin, "POST", {
        decision: "APPROVE",
        verifiedInKbzPay: true,
        bankReference: txid + "CORRECTED",
        reason,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`/admin/payment-orders/${other.id}/review`, admin, "POST", {
        decision: "APPROVE",
        verifiedInKbzPay: true,
        bankReference: txid + "PHOTOONLY",
        reason,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await db.coursePurchase.findUniqueOrThrow({
        where: { userId_courseId: { userId: b.user.id, courseId: course.id } },
      })
    ).amountMinor,
    5000000,
  );

  const original = await db.course.findUniqueOrThrow({
    where: { slug: "geki-kihon-package" },
  });
  const fixtureSuffix = randomUUID();
  let pricingCourse: { id: string } | undefined;
  const fixtureUsers: string[] = [];
  await db.course.update({
    where: { id: original.id },
    data: { slug: "original-kihon-" + fixtureSuffix },
  });
  try {
    pricingCourse = await db.course.create({
      data: {
        title: "Founding pricing test",
        slug: "geki-kihon-package",
        description: "Local fixture",
        status: "PUBLISHED",
        kbzPayEnabled: true,
        priceMinor: 5000000,
        currency: "MMK",
      },
    });
    for (let i = 0; i < 49; i++) {
      const u = await db.user.create({
        data: {
          firebaseUid: `pricing-${fixtureSuffix}-${i}`,
          email: `pricing-${i}@geki.local`,
          displayName: "Pricing fixture",
        },
      });
      fixtureUsers.push(u.id);
      await db.coursePurchase.create({
        data: {
          userId: u.id,
          courseId: pricingCourse.id,
          amountMinor: 3500000,
          currency: "MMK",
          paymentReference: `pricing-${fixtureSuffix}-${i}`,
        },
      });
    }
    const results = await Promise.all(
      [a, b].map((u) =>
        call("/checkout", u.token, "POST", { courseId: pricingCourse!.id }),
      ),
    );
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200],
    );
    assert.deepEqual(
      results.map((r) => r.data.amountMinor).sort(),
      [3500000, 5000000],
    );
    const discounted = results.find((r) => r.data.amountMinor === 3500000)!;
    assert.equal(
      (await call("/checkout/quote/" + pricingCourse.id, browser.token)).data
        .amountMinor,
      5000000,
    );
    await db.paymentOrder.update({
      where: { id: discounted.data.id },
      data: { updatedAt: new Date(Date.now() - 25 * 3600000) },
    });
    const expiredPhoto = new FormData();
    expiredPhoto.set(
      "proof",
      new Blob([bytes], { type: "image/jpeg" }),
      "receipt.jpg",
    );
    const owner = discounted.data.id === results[0].data.id ? a : b;
    assert.equal(
      (
        await call(
          `/me/payment-orders/${discounted.data.id}/proof`,
          owner.token,
          "POST",
          expiredPhoto,
        )
      ).data.code,
      "ORDER_EXPIRED",
    );
    assert.equal(
      (
        await call("/checkout", browser.token, "POST", {
          courseId: pricingCourse.id,
        })
      ).data.amountMinor,
      3500000,
    );
    console.log(
      "Founding price: 49 paid + concurrent final place, normal 50,000, and expired reservation checks passed",
    );
  } finally {
    if (pricingCourse) {
      await db.paymentOrder.deleteMany({
        where: { courseId: pricingCourse.id },
      });
      await db.coursePurchase.deleteMany({
        where: { courseId: pricingCourse.id },
      });
      await db.course.delete({ where: { id: pricingCourse.id } });
    }
    await db.user.deleteMany({ where: { id: { in: fixtureUsers } } });
    await db.course.update({
      where: { id: original.id },
      data: { slug: original.slug },
    });
  }
  await writeFile(
    ".local/qr-payment-fixture.json",
    JSON.stringify({
      courseId: course.id,
      slug: course.slug,
      email: browser.email,
      deviceEmail: devicesBuyer.email,
      password: "GekiLocal!2026",
    }),
  );
  console.log(
    JSON.stringify({
      serverAuthoritativePrice: "passed",
      idempotentOrders: "passed",
      privateReceiptAuthorization: "passed",
      invalidFileRejection: "passed",
      duplicateEvidenceRejection: "passed",
      noUnlockBeforeReview: "passed",
      rejectionAndResubmission: "passed",
      atomicIdempotentApproval: "passed",
      revocationPreservedOnRetry: "passed",
    }),
  );
} finally {
  await db.$disconnect();
}
