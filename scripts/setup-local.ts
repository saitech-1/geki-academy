import { copyFile, mkdir, access } from "node:fs/promises";
for (const [source, target] of [
  [".env.example", ".env"],
  ["apps/web/.env.example", "apps/web/.env.local"],
]) {
  try {
    await access(target!);
  } catch {
    await copyFile(source!, target!);
    console.log(`Created ${target}`);
  }
}
await mkdir(".local/uploads", { recursive: true });
console.log(
  "Next: start npm run db:local and npm run auth:emulator, then npm run db:migrate and npm run db:seed.",
);
