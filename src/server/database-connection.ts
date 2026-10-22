import type { PoolConfig } from "pg";
import { X509Certificate } from "node:crypto";

// Cloud runtimes cannot read the Windows certificate path in a local DB URL.
// Supplying the public CA as an environment value keeps hostname verification.
export function databaseConnection(
  connectionString: string,
  certificate?: string,
): PoolConfig {
  if (!certificate) return { connectionString };
  const ca = certificate.replace(/\\n/g, "\n");
  try {
    new X509Certificate(ca);
  } catch {
    throw new Error("DATABASE_SSL_CA must contain a valid PEM certificate.");
  }
  const url = new URL(connectionString);
  // pg would otherwise replace the explicit ssl object with URL SSL options.
  for (const key of [
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "uselibpqcompat",
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true },
  };
}
