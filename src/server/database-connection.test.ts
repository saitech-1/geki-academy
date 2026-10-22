import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { databaseConnection } from "./database-connection";

const ca = readFileSync(
  new URL("../../certificates/supabase-ca.crt", import.meta.url),
  "utf8",
);
describe("database TLS deployment configuration", () => {
  it("prevents URL SSL settings from overriding verification and keeps other connection options", () => {
    const options = databaseConnection(
      "postgresql://user:password@db.example.com/db?sslmode=disable&sslrootcert=C%3A%2Flocal.crt&sslkey=key&sslcert=cert&uselibpqcompat=true&application_name=geki",
      ca,
    );
    const url = new URL(options.connectionString!);
    expect(url.searchParams.get("application_name")).toBe("geki");
    for (const key of [
      "sslmode",
      "sslrootcert",
      "sslcert",
      "sslkey",
      "uselibpqcompat",
    ])
      expect(url.searchParams.has(key)).toBe(false);
    expect(options.ssl).toEqual({ ca, rejectUnauthorized: true });
  });
  it("accepts escaped PEM newlines and rejects invalid certificates without echoing them", () => {
    expect(
      databaseConnection(
        "postgresql://user:password@db.example.com/db",
        ca.replace(/\n/g, "\\n"),
      ).ssl,
    ).toEqual({ ca, rejectUnauthorized: true });
    expect(() =>
      databaseConnection(
        "postgresql://user:password@db.example.com/db",
        "invalid",
      ),
    ).toThrow("DATABASE_SSL_CA must contain a valid PEM certificate.");
  });
  it("preserves the existing local connection when no CA override is configured", () => {
    const url = "postgresql://geki:local@127.0.0.1:5433/geki";
    expect(databaseConnection(url)).toEqual({ connectionString: url });
  });
});
