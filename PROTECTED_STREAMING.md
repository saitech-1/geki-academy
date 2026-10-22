# Protected streaming operations

GEKI now runs media authorization inside Next.js Route Handlers. There is no separate Express API to restart. Local app and API both use http://localhost:3000.

1. Configure MEDIA*MODE=vdocipher and VDOCIPHER_API_SECRET on the server. Keep the provider secret out of NEXT_PUBLIC* variables and Git. On Vercel, redeploy after changing environment settings; locally use npm run build then npm run start:live with root .env.production.local.
2. In Admin → Videos, save the source, connect it to VdoCipher and refresh provider processing status. Existing provider asset IDs are retained. Do not blindly retry asset creation; the provider trial has an asset quota.
3. Review English/Burmese subtitles. Synchronize approved subtitles to the protected player before publishing. Burmese tracks map to the provider's my language code. Replacing a source clears subtitle approval.
4. Publish only when processing and current subtitle synchronization are ready. Paid learner playback requires a CoursePurchase, including when the learner is an administrator. Protected credentials are issued server-side and are short-lived. Admin source previews are separately signed and role-checked.

Local/persistent-host sources live outside public/. On Vercel, new disk uploads return DIRECT_UPLOAD_REQUIRED until private durable direct-upload storage is integrated. Existing local files are not available in a cloud deployment merely because database rows exist. Student playback for already configured provider assets does not require those private source files.

Provider rejections distinguish quota/account errors where possible; check the VdoCipher dashboard and server-safe error code. Do not expose the API secret in screenshots or support messages. Motion and error toasts remain in the existing UI. Screen capture cannot be universally prevented across browsers and operating systems.
