import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
dotenv({
  path: resolve(
    process.cwd(),
    process.env.NODE_ENV === "production"
      ? ".env.production.local"
      : ".env.development.local",
  ),
  quiet: true,
});
const root = process.cwd();
export const config = {
  production: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://geki:geki_local_only@127.0.0.1:5433/geki",
  projectId: process.env.FIREBASE_PROJECT_ID || "demo-geki-academy",
  ownerEmail: process.env.BOOTSTRAP_OWNER_EMAIL,
  origins: (
    process.env.WEB_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000"
  ).split(","),
  uploadDir: resolve(
    /* turbopackIgnore: true */ root,
    process.env.UPLOAD_DIR || ".local/uploads",
  ),
  mediaMode: process.env.MEDIA_MODE || "disabled",
  videoSecret: process.env.VDOCIPHER_API_SECRET,
};
if (config.production) {
  if (
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    config.projectId.startsWith("demo-")
  )
    throw new Error("Production cannot use the Firebase Auth Emulator.");
  if (
    !process.env.DATABASE_URL ||
    config.databaseUrl.includes("geki_local_only")
  )
    throw new Error("Production needs its own database credentials.");
  if (config.mediaMode === "local")
    throw new Error(
      "Local media mode is development-only; configure protected production streaming.",
    );
}
