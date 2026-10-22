import { config as dotenv } from "dotenv";
dotenv({
  path:
    process.env.NODE_ENV === "production"
      ? ".env.production.local"
      : ".env.development.local",
  quiet: true,
});
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://geki:geki_local_only@127.0.0.1:5433/geki",
  },
});
