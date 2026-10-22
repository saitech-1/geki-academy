export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Lazy loading keeps database/auth runtime configuration out of static builds.
async function handle(request: Request) {
  const { handleApi } = await import("@/server/app");
  return handleApi(request);
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
  handle as OPTIONS,
};
