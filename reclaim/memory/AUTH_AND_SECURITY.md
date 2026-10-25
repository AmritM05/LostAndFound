# Authentication, authorization and privacy

## Student demo authentication: implemented

`app/api/session/route.ts` accepts normal syntactically valid email plus optional name; it deliberately calls `universityEmail(email, [])`, so the configured domain helper is bypassed at login. There is no password, email confirmation, SSO or verified email ownership. `startSession` creates/retrieves a lowercase-email `users` record and a random 32-byte token; Neon stores only SHA-256 of that token. The `magpie_demo_session` cookie is HttpOnly, SameSite=Lax, Path=/, seven-day Max-Age, Secure in production. Refresh persists the session; logout deletes the matching session record and expires the cookie.

`currentUser` always returns role=student and verified=false, even if that same email's database user has role=admin. A shared identity row must never become an email-only privilege escalation. Student routes render shells without server layout authentication, but private APIs require `requireUser` and apply ownership checks.

**Critical demo limitation:** anyone who knows a student's email can impersonate that student and access their private reports/photos. Privacy protections restrict unrelated sessions, not verified real-world identity. Use synthetic information until identity verification is implemented.

## Staff demo authentication: implemented

`components/admin/AdminLogin.tsx` posts email/password to `app/api/admin/session/route.ts`. Server-only variables hold the configured credential pair. `lib/server/adminSession.ts` compares fixed-size SHA-256 digests with timingSafeEqual, creates/marks the staff user, and issues a separate random token. Only its hash is stored in `admin_sessions`. `magpie_admin_session` is an eight-hour HttpOnly/SameSite cookie with Secure in production; logout revokes its row. `verified=true` in the Profile is an application assertion of staff demo authentication, not SSO or identity proof.

`app/admin/(portal)/layout.tsx` authenticates server-side and redirects to `/admin/login/`; every staff API independently requires admin. No role toggle or browser-local admin flag grants access. The password is not saved to localStorage, sessionStorage or plaintext cookies; the form clears after submission. Invalid credentials use one generic message.

Invalid attempt throttling is per-process and keyed by submitted email. A persistent counter exists but is only reached after valid credential comparison and cleared after success, so it is not comprehensive distributed brute-force protection. There are no distinct staff accounts, MFA, credential rotation/revocation controls across all sessions, managed identity provider or sophisticated abuse controls.

## Image access and mixed sessions

Shared image routes use `requirePhotoUser`: default requires a student session; `workspace=admin` requires a real admin session. A caller cannot gain admin authority by adding that parameter. Reservations persist `upload_role`; token and completion routes match owner and role; a SQL trigger rejects mismatched report binding. Staff can read all uploaded private report images; students can read only their own student-role images. Signing into the student form with the staff email still cannot read staff uploads.

Photos go directly to a **private** Blob store with narrow short-lived client tokens. The long-lived Blob token never leaves the server. Finalization checks private hostname, expected original pathname/type/size, plus preview type/size/private hostname. Shared validation accepts extension/MIME metadata; it is not content-based malware scanning or forensic file-type validation. Original downloads use attachment headers for HEIC and explicit originals; private responses are no-store, Vary:Cookie and nosniff. No public Blob URL appears in generic Search or student workspace projections.

## Request validation and CSRF

`lib/server/origin.ts` centralizes allowed origins. Mutation routes call `sameOrigin`, except SDK-signed upload completion callbacks which are verified by the Blob SDK. Development loopback aliases/ports are accepted against local/all-interface bindings; production supports current/configured application origins and trusted Vercel deployment headers. No wildcard CORS is enabled. Missing/foreign origins are rejected. Custom proxies require explicit trusted-origin configuration; production-mode local tests need an explicit loopback allowlist.

JSON bodies are bounded at 100,000 declared bytes/characters; field validators enforce IDs, lengths, date, category, location and image references. This is not a general streaming body-limit or full schema-validation framework. Invalid non-object JSON is not comprehensively normalized by all handlers; investigate 503 classifications before treating them as service outages.

## Ownership and visibility

- Student report save/edit/delete derives owner from server session, not payload reporterId.
- Student search is anonymous-accessible but returns only the six-field view. Match endpoints validate ownership and return match metadata without other-report photos/details.
- Claim evidence and private notes are available only to the owner and authorized staff. Staff approval is independent of similarity score.
- Active recovery blocks destructive student deletion; database transaction queues storage cleanup before removing metadata.
- Staff portal data is intentionally broad to authorized staff; no per-desk staff scoping or tenant isolation exists.
- No public messaging, mail sending, SMS or realtime notification service is implemented.

## Diagnostics and production prerequisites

`diagnostics.ts` logs route/method/status/operation and safe code/reason instead of raw provider errors, database URLs, keys or report payloads. Blob cleanup separately redacts the known Blob token from truncated error text; this is narrower than a universal secret scrubber.

Before real private data: verified student identity, appropriate staff accounts, strict tenant/desk authorization, distributed rate limits, credential/session rotation, dependency/transport review, content validation and retention/deletion policies, reliable cleanup scheduling and deployment smoke tests are required. These are backlog items, not features added by this documentation task.

References: `lib/server/session.ts`, `adminSession.ts`, `origin.ts`, `http.ts`, `blob.ts`, `blobCleanup.ts`, `app/api/images/`, `db/migrations/002_report_deletion.sql`, `003_admin_portal.sql`. See [API contracts](API_CONTRACTS.md) and [known bugs](KNOWN_BUGS.md).
