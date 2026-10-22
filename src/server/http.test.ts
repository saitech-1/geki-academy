import { describe, expect, it } from "vitest";
import {
  createEndpoints,
  jsonBody,
  type Request,
  type Response,
} from "./http";
import { HttpError } from "./domain";
const error = (error: unknown, _req: Request, res: Response) =>
  res
    .status(error instanceof HttpError ? error.status : 500)
    .json({ code: error instanceof HttpError ? error.code : "INTERNAL_ERROR" });
describe("Next.js endpoint request boundary", () => {
  it("runs authentication before mounted handlers and preserves route parameters", async () => {
    const api = createEndpoints();
    const group = createEndpoints();
    group.get("/:id", (req, res) =>
      res.json({ id: req.params.id, user: req.account.id }),
    );
    api.use(
      "/api/private",
      (req, _res, next) => {
        if (!req.headers.authorization)
          return next(new HttpError(401, "UNAUTHENTICATED", "Sign in"));
        req.account = { id: "verified-user" } as Request["account"];
        next();
      },
      group,
    );
    const denied = await api.handle(
      new globalThis.Request("https://geki.test/api/private/lesson"),
      error,
    );
    expect(denied.status).toBe(401);
    const allowed = await api.handle(
      new globalThis.Request("https://geki.test/api/private/lesson", {
        headers: { Authorization: "Bearer test" },
      }),
      error,
    );
    expect(await allowed.json()).toEqual({
      id: "lesson",
      user: "verified-user",
    });
    expect(allowed.headers.get("cache-control")).toBe("no-store");
    expect(allowed.headers.get("x-request-id")).toBeTruthy();
  });
  it("does not run a similarly named public path through private middleware", async () => {
    const api = createEndpoints();
    api.use("/api/me", () => {
      throw new Error("Unexpected match");
    });
    api.get("/api/media", (_req, res) => res.json({ public: true }));
    const response = await api.handle(
      new globalThis.Request("https://geki.test/api/media"),
      error,
    );
    expect(response.status).toBe(200);
  });
  it("rejects an oversized JSON stream without relying on Content-Length", async () => {
    const api = createEndpoints();
    api.use("/api", jsonBody);
    api.post("/api/data", (_req, res) => res.json({ accepted: true }));
    const response = await api.handle(
      new globalThis.Request("https://geki.test/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(1024 * 1024) }),
      }),
      error,
    );
    expect(response.status).toBe(413);
  });
  it("returns an empty HEAD body and isolates unknown endpoints", async () => {
    const api = createEndpoints();
    api.get("/api/health", (_req, res) => res.json({ ok: true }));
    const response = await api.handle(
      new globalThis.Request("https://geki.test/api/health", {
        method: "HEAD",
      }),
      error,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(
      (
        await api.handle(
          new globalThis.Request("https://geki.test/api/unknown"),
          error,
        )
      ).status,
    ).toBe(404);
  });
});
