# Course thumbnail uploads

In Admin → Courses → Edit course, choose **Upload from device**, select a JPG, PNG or WebP image up to 2 MB, review the preview, then **Save course**. An optional image URL field remains available. Course saving is disabled during upload.

The admin-only endpoint streams a bounded request, validates actual image decoding and pixel count, rejects animation/SVG, strips metadata, and converts artwork to a WebP within 1600×900. Source files do not enter the database. The course stores the resulting image URL when saved.

Production uses the public Supabase Storage bucket `geki-course-thumbnails` with a 2 MB limit and `image/webp` allowlist. Server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` use the existing configuration. Public course artwork can be read without signing in; uploads pass through admin authorization. No anonymous Storage write policy is needed. The bucket has been provisioned on the GEKI project.

Local emulator development uses `.local/uploads/course-thumbnails` (under the configured `UPLOAD_DIR`) and a public image endpoint. This filesystem fallback is disabled in production.

Verification: `npm test`, `npm run build`, and `npx tsx scripts/thumbnail-test.ts`. The integration check covers device selection, upload, preview, save/reload, invalid images, anonymous request rejection and mobile layout. Cloud HTTP upload verification on November 1, 2026 was blocked by a local outbound connection failure to the Supabase Storage host; bucket settings were verified through the connected Supabase API.
