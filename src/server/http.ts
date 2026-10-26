import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import type { DecodedIdToken } from "firebase-admin/auth";
import { HttpError } from "./domain";

export interface Request {
  raw: globalThis.Request;
  headers: Record<string, string | undefined>;
  params: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: any;
  account: User;
  identity: DecodedIdToken;
  requestId: string;
  deviceId?: string;
  file?: { path: string; filename: string; mimetype: string; size: number };
  receipt?: { bytes: Buffer; path: string };
}
export class Response {
  private code = 200;
  private headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "SAMEORIGIN",
  });
  result?: globalThis.Response;
  status(code: number) {
    this.code = code;
    return this;
  }
  setHeader(key: string, value: string | number) {
    this.headers.set(key, String(value));
    return this;
  }
  type(value: string) {
    this.headers.set("Content-Type", value);
    return this;
  }
  json(value: unknown) {
    this.headers.set("Content-Type", "application/json; charset=utf-8");
    return this.send(JSON.stringify(value));
  }
  send(body: BodyInit | null) {
    this.result = new globalThis.Response(body, {
      status: this.code,
      headers: this.headers,
    });
    return this;
  }
  end() {
    return this.send(null);
  }
}
export type NextFunction = (error?: unknown) => void;
export type Handler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => unknown;
type Layer = {
  path: string;
  method?: string;
  handlers: Handler[];
  prefix?: boolean;
};
// Endpoint declarations share business handlers; Next.js owns the HTTP server.
export class EndpointGroup {
  layers: Layer[] = [];
  get(path: string, ...handlers: Handler[]) {
    this.layers.push({ path, method: "GET", handlers });
  }
  post(path: string, ...handlers: Handler[]) {
    this.layers.push({ path, method: "POST", handlers });
  }
  put(path: string, ...handlers: Handler[]) {
    this.layers.push({ path, method: "PUT", handlers });
  }
  patch(path: string, ...handlers: Handler[]) {
    this.layers.push({ path, method: "PATCH", handlers });
  }
  delete(path: string, ...handlers: Handler[]) {
    this.layers.push({ path, method: "DELETE", handlers });
  }
  use(path: string, ...items: (Handler | EndpointGroup)[]) {
    for (const item of items) {
      if (item instanceof EndpointGroup)
        this.layers.push(
          ...item.layers.map((layer) => ({
            ...layer,
            path: path + (layer.path === "/" ? "" : layer.path),
          })),
        );
      else this.layers.push({ path, prefix: true, handlers: [item] });
    }
  }
  async handle(
    raw: globalThis.Request,
    onError: (error: unknown, request: Request, reply: Response) => unknown,
  ) {
    const url = new URL(raw.url);
    const reply = new Response();
    const req = {
      raw,
      headers: Object.fromEntries(raw.headers),
      params: {},
      query: Object.fromEntries(url.searchParams),
      body: {},
      requestId: randomUUID(),
    } as Request;
    reply.setHeader("X-Request-Id", req.requestId);
    try {
      for (const layer of this.layers) {
        if (
          layer.method &&
          layer.method !== (raw.method === "HEAD" ? "GET" : raw.method)
        )
          continue;
        const path = url.pathname.replace(/\/$/, "") || "/";
        const pattern = layer.path.replace(/\/$/, "") || "/";
        const names: string[] = [];
        const regex = pattern
          .split("/")
          .map((part) => {
            if (part.startsWith(":")) {
              names.push(part.slice(1));
              return "([^/]+)";
            }
            return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          })
          .join("/");
        const match = new RegExp(
          "^" + regex + (layer.prefix ? "(?:/|$)" : "$"),
        ).exec(path);
        if (!match) continue;
        req.params = Object.fromEntries(
          names.map((name, i) => [name, decodeURIComponent(match[i + 1]!)]),
        );
        for (const handler of layer.handlers) {
          let proceed = false;
          let failure: unknown;
          await handler(req, reply, (error) => {
            proceed = true;
            failure = error;
          });
          if (failure) throw failure;
          if (reply.result)
            return raw.method === "HEAD"
              ? new globalThis.Response(null, reply.result)
              : reply.result;
          if (!proceed) throw new Error("Endpoint did not return a response");
        }
      }
      throw new HttpError(404, "NOT_FOUND", "Endpoint not found.");
    } catch (error) {
      await onError(error, req, reply);
      return (
        reply.result ??
        globalThis.Response.json(
          { error: "Request failed", code: "INTERNAL_ERROR" },
          { status: 500 },
        )
      );
    }
  }
}
export const createEndpoints = () => new EndpointGroup();

export const jsonBody: Handler = async (req, _res, next) => {
  if (req.raw.headers.get("content-type")?.includes("application/json")) {
    if (Number(req.raw.headers.get("content-length") || 0) > 1024 * 1024)
      throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large.");
    const reader = req.raw.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 1024 * 1024) {
          await reader.cancel();
          throw new HttpError(
            413,
            "BODY_TOO_LARGE",
            "Request body is too large.",
          );
        }
        chunks.push(value);
      }
    const text = Buffer.concat(chunks).toString("utf8");
    req.body = text ? JSON.parse(text) : {};
  }
  next();
};
