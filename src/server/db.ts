import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config";
import { databaseConnection } from "./database-connection";
const shared = globalThis as typeof globalThis & { gekiDatabase?: PrismaClient };
export const db = shared.gekiDatabase ?? new PrismaClient({
  adapter: new PrismaPg(
    databaseConnection(config.databaseUrl, process.env.DATABASE_SSL_CA),
  ),
});
if (process.env.NODE_ENV !== "production") shared.gekiDatabase = db;
export async function lockUser(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "geki"."User" WHERE id=${id} FOR UPDATE`;
}
