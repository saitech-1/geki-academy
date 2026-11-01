import { afterEach, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({
  uid: "fixture-user",
  getIdToken: async () => "fixture-token",
}));
vi.mock("./firebase", () => ({
  firebaseAuth: () => ({ currentUser: identity }),
}));
vi.mock("./push-client", () => ({
  clearPushRegistration: vi.fn(async () => {}),
}));
import { ApiError, registerCurrentDevice } from "./api";
afterEach(() => {
  vi.unstubAllGlobals();
});
function setup() {
  const storage = new Map([
    ["geki-device-v1:fixture-user", "revoked-fixture-key"],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  });
  vi.stubGlobal("navigator", { userAgent: "Windows Chrome" });
  vi.stubGlobal("window", {});
  return storage;
}
it("replaces a revoked key once, shares concurrent registration and preserves the revoked record", async () => {
  const storage = setup();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { code: "DEVICE_REVOKED", error: "revoked" },
        { status: 403 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json({ id: "new-registration" }, { status: 201 }),
    );
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([registerCurrentDevice(), registerCurrentDevice()]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const first = JSON.parse(fetcher.mock.calls[0]![1]!.body);
  const second = JSON.parse(fetcher.mock.calls[1]![1]!.body);
  expect(first.key).toBe("revoked-fixture-key");
  expect(second.key).not.toBe(first.key);
  expect(storage.get("geki-device-v1:fixture-user")).toBe(second.key);
});
it("surfaces the normal device-limit prompt when both slots are occupied", async () => {
  setup();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { code: "DEVICE_REVOKED", error: "revoked" },
        { status: 403 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json(
        { code: "DEVICE_LIMIT", error: "Remove one device before continuing." },
        { status: 409 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(registerCurrentDevice()).rejects.toMatchObject({
    code: "DEVICE_LIMIT",
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not rotate a device key for ordinary authorization failures", async () => {
  const storage = setup();
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { code: "ACCOUNT_SUSPENDED", error: "Suspended" },
        { status: 403 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(registerCurrentDevice()).rejects.toBeInstanceOf(ApiError);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(storage.get("geki-device-v1:fixture-user")).toBe(
    "revoked-fixture-key",
  );
});
