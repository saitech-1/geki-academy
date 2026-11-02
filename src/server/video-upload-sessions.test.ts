import { expect, it } from "vitest";
import { credentialExpiry } from "./video-upload-sessions";
const credentials = (
  conditions: unknown[],
  expiration = new Date(Date.now() + 600000).toISOString(),
  uploadLink = "https://fixture.s3.amazonaws.com/",
) => ({
  uploadLink,
  key: "restricted-source",
  policy: Buffer.from(JSON.stringify({ expiration, conditions })).toString(
    "base64",
  ),
  "x-amz-signature": "fixture",
  "x-amz-algorithm": "fixture",
  "x-amz-date": "fixture",
  "x-amz-credential": "fixture",
});
it("accepts provider authorization restricted to the exact source object", () => {
  expect(
    credentialExpiry(credentials([{ key: "restricted-source" }])),
  ).toBeGreaterThan(Date.now());
  expect(
    credentialExpiry(credentials([["eq", "$key", "restricted-source"]])),
  ).toBeGreaterThan(Date.now());
});
it("rejects expired and unrestricted upload authorization", () => {
  expect(() =>
    credentialExpiry(
      credentials([{ key: "restricted-source" }], new Date(0).toISOString()),
    ),
  ).toThrow();
  expect(() =>
    credentialExpiry(credentials([["starts-with", "$key", ""]])),
  ).toThrow();
});
it("rejects unexpected upload hosts and malformed policies", () => {
  expect(() =>
    credentialExpiry(
      credentials(
        [{ key: "restricted-source" }],
        undefined,
        "https://evil.example/",
      ),
    ),
  ).toThrow();
  expect(() =>
    credentialExpiry({ ...credentials([]), policy: "invalid" }),
  ).toThrow();
});
