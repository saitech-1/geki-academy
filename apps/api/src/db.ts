import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config.js";
export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.databaseUrl }),
});
export async function lockUser(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "geki"."User" WHERE id=${id} FOR UPDATE`;
}
