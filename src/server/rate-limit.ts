import type { Handler, Request } from "./http";

// Shared within each Next.js instance. Payment submission and device limits also
// have durable database constraints; this is an additional per-instance throttle.
export function rateLimit(options: {
  windowMs: number;
  limit: number;
  keyGenerator?: (req: Request) => string;
  handler?: Handler;
  standardHeaders?: string;
  legacyHeaders?: boolean;
}): Handler {
  const buckets = new Map<string, { expires: number; count: number }>();
  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 10000)
      for (const [key, bucket] of buckets)
        if (bucket.expires <= now) buckets.delete(key);
    const key =
      options.keyGenerator?.(req) ||
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      "local";
    let bucket = buckets.get(key);
    if (!bucket || bucket.expires <= now) {
      bucket = { expires: now + options.windowMs, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > options.limit) {
      res.setHeader(
        "Retry-After",
        Math.max(1, Math.ceil((bucket.expires - now) / 1000)),
      );
      return options.handler
        ? options.handler(req, res, next)
        : res
            .status(429)
            .json({
              error: "Too many requests. Try again shortly.",
              code: "RATE_LIMIT",
            });
    }
    next();
  };
}
