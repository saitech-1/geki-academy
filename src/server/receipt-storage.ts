import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { requireCondition, HttpError } from "./domain";

const bucket = "geki-payment-receipts";
export async function ensurePrivateReceiptStorage() {
  requireCondition(
    receiptStorageConfigured(),
    503,
    "RECEIPT_STORAGE_UNAVAILABLE",
    "Private receipt storage is not configured. Contact GEKI before paying.",
  );
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await client.storage.getBucket(bucket);
  requireCondition(
    !result.error &&
      result.data &&
      !result.data.public &&
      result.data.file_size_limit &&
      result.data.file_size_limit <= 5 * 1024 * 1024,
    503,
    "RECEIPT_STORAGE_UNAVAILABLE",
    "Private receipt storage is not ready. Contact GEKI before paying.",
  );
}
export function receiptStorageConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
function storage() {
  requireCondition(
    receiptStorageConfigured(),
    503,
    "RECEIPT_STORAGE_UNAVAILABLE",
    "Receipt uploads are temporarily unavailable. Contact GEKI before paying.",
  );
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ).storage.from(bucket);
}
function signature(value: string) {
  return createHmac("sha256", process.env.SUPABASE_SECRET_KEY!)
    .update("geki-receipt:" + value)
    .digest();
}
export async function createReceiptUpload(userId: string, orderId: string) {
  const path = `${userId}/${orderId}/${randomUUID()}.receipt`;
  const { data, error } = await storage().createSignedUploadUrl(path, {
    upsert: false,
  });
  if (error || !data)
    throw new HttpError(
      503,
      "RECEIPT_STORAGE_UNAVAILABLE",
      "Could not prepare receipt upload. Try again shortly.",
    );
  const value = Buffer.from(
    JSON.stringify({
      path,
      userId,
      orderId,
      expires: Date.now() + 2 * 3600000,
    }),
  ).toString("base64url");
  return {
    signedUrl: data.signedUrl,
    uploadToken: value + "." + signature(value).toString("base64url"),
  };
}
export async function readReceiptUpload(
  token: string,
  userId: string,
  orderId: string,
) {
  storage();
  const [value, mac, extra] = token.split(".");
  const supplied = Buffer.from(mac || "", "base64url");
  const expected = signature(value || "");
  requireCondition(
    value &&
      !extra &&
      supplied.length === expected.length &&
      timingSafeEqual(supplied, expected),
    400,
    "INVALID_UPLOAD",
    "The receipt upload expired. Choose your photo again.",
  );
  let claim;
  try {
    claim = JSON.parse(Buffer.from(value, "base64url").toString());
  } catch {
    throw new HttpError(400, "INVALID_UPLOAD", "Invalid receipt upload.");
  }
  requireCondition(
    claim.userId === userId &&
      claim.orderId === orderId &&
      claim.expires > Date.now() &&
      typeof claim.path === "string" &&
      claim.path.startsWith(`${userId}/${orderId}/`),
    400,
    "INVALID_UPLOAD",
    "The receipt upload expired. Choose your photo again.",
  );
  const { data, error } = await storage().download(claim.path);
  requireCondition(
    !error && data && data.size <= 5 * 1024 * 1024,
    400,
    "INVALID_RECEIPT",
    "Upload a PNG or JPEG receipt smaller than 5 MB.",
  );
  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    path: "supabase:" + claim.path,
  };
}
export async function receiptDownload(path: string) {
  const { data, error } = await storage().createSignedUrl(
    path.slice("supabase:".length),
    60,
  );
  requireCondition(
    !error && data,
    503,
    "RECEIPT_UNAVAILABLE",
    "Receipt temporarily unavailable. Please retry.",
  );
  const response = await fetch(data.signedUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  requireCondition(
    response.ok,
    503,
    "RECEIPT_UNAVAILABLE",
    "Receipt temporarily unavailable. Please retry.",
  );
  return response.body;
}
