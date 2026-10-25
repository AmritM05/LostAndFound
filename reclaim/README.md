# Magpie

Existing student campus lost-and-found application, with a server-side Neon PostgreSQL backend, private Vercel Blob photos, and email-only hackathon login. The student design, full OSU building selector, and interactive Google Maps are preserved. Supabase is not a runtime dependency.

## Setup

Use Node.js 22.13 or later.

```sh
npm install
# Create .env.local from .env.example and fill the server credentials below.
npm run db:migrate
npm run dev
```

Required ignored `.env.local` values:

```dotenv
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
ADMIN_DEMO_EMAIL=
ADMIN_DEMO_PASSWORD=
ALLOWED_ORIGINS=
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=
```

Never prefix `DATABASE_URL` or `BLOB_READ_WRITE_TOKEN` with `NEXT_PUBLIC`. Neither is imported by client code. The Google API key is a public browser key and must have API/referrer restrictions. Blank Map ID uses `DEMO_MAP_ID`; blank email domains accept any normal valid email. Restart after changing local environment values and rebuild after changing public values.

### Neon dashboard

Create/select a Neon PostgreSQL project and database, open **Connect**, and copy the full PostgreSQL connection string (beginning `postgresql://`, including user, password, hostname, database, and SSL parameters). Put only that connection string in `DATABASE_URL`, not a project ID, key, hostname, `psql` command, or SQL statement. Run `npm run db:migrate` from this directory. The migration command applies every idempotent SQL migration in `db/migrations/`, then creates the relational schema and upserts all 251 bundled OSU buildings. Use a dedicated application database/role; keep access server-side.

The migration script reports configuration failures without printing credentials. It uses Neon's WebSocket driver for the migration batch; application queries use Neon's HTTP driver with parameterized SQL. No ORM is required.

### Vercel dashboard and deployment

Create a **private** Blob store under Vercel Storage, connect it to the app project, and add its `BLOB_READ_WRITE_TOKEN` to local/deployment server environment variables. Public stores are unsupported: finalization verifies the private Blob hostname. For deployment, import this directory as a **Next.js** project, configure the same environment variables for the intended environments, and deploy. Alternatively run `npm run build` then `npm start` on a Node-capable host. No Vercel deployment credentials are included in the repository.

This is now a server application with Next.js Route Handlers. It cannot run on the previous static Sites host or by serving `out/`; `output: export` has been removed. The previously published Sites URL remains the older browser-only demo until a compatible server deployment is configured. Its existing audience is unchanged. Do not publish the old `out/` directory as this backend release.

Direct-to-Blob multipart client uploads avoid the Vercel Function request-body limit. The app server issues a short-lived token scoped to an authenticated user's reserved image path, type, and size. Only image IDs/metadata are sent when creating a report. Completion verifies Blob metadata and does not depend on delivery of a local webhook. If callback testing is wanted locally, configure `VERCEL_BLOB_CALLBACK_URL` with a reachable HTTPS tunnel. The Blob write token remains server-only.

### Google Cloud

Enable Maps JavaScript API and billing. Restrict the browser key to this API and the actual localhost/deployed HTTP referrers. Leave Map ID blank for the development fallback or use a real JavaScript Map ID. A map error never prevents building-only or unknown-location reporting.

## Student flow and demo sessions

Enter an email and press **Continue**. The server creates/retrieves a `users` record with a default student role, stores only a hash of a random session token in Neon, and sets a seven-day HTTP-only SameSite cookie (Secure in production). Refresh preserves the session; Logout deletes it. No password, confirmation email, SSO, or Supabase setup is used. The auth adapter is isolated in `lib/server/session.ts`.

This is intentionally **not production identity verification**: anyone who knows an email can enter as that user. Use sample information. Email-only sessions always receive student privileges even if the underlying user record is manually marked admin. There is no role selector or student Found Item form. Staff use the separate `/admin/login/` page and server-verified credentials. Real verified student identity must replace email-only login before private real-world use.

Reports, private descriptions, notes, updates, image associations, and users persist in Neon. Existing reports stored by the earlier browser-only version are left untouched in browser storage and are not silently uploaded. There is no local-storage fallback that claims a failed remote save succeeded.

## Relational model and staff operations

`db/migrations/001_student_backend.sql` defines:

- `users`, `demo_sessions`
- `buildings`, `dropoff_zones`
- one `reports` table supporting both lost and found reports, with normalized category/name/brand/model/two colors/description/time/location/custody fields
- `private_report_details`, `report_images`
- `potential_matches`, `claims`, `pickups`, `updates`, `report_notes`

The reporter email is obtained through the user foreign key rather than copied into every report. Original and preview Blob metadata live in `report_images`; binary data never enters PostgreSQL. Private ownership fields are separate from reports. Staff intake, custody management, automatic matching, claims, verification, and single-use pickup use these same tables through authenticated server routes. No parallel reports/images/claims model is introduced.

`save_student_report` atomically saves the report, ownership details, image links, and initial update. It enforces student lost-only submission, owner-scoped editing, valid active buildings, valid coordinates, and completed owned images. Building coordinates come from the database. Unknown locations clear building and coordinates; a map-only point is valid. The original instant remains in `occurred_at`; `lost_date` and `lost_time` are its UTC components.

Queries enforce ownership server-side. The app does not rely on old Supabase RLS or any client-supplied reporter ID. The legacy `supabase/` SQL and its tests remain only as reference; do not apply that schema to Neon.

## Private images and HEIC

JPEG/JPG, PNG, WebP, HEIC, and HEIF are supported, including HEIC/HEIF files with missing or generic MIME types and valid extensions. The shared `lib/uploadConfig.ts` enforces **25 MB per image**, up to three files. The browser and upload token route apply the same limit. The policy is a single source constant; an old environment value cannot silently lower it to 3 MB. HEIC/HEIF sequence MIME types are normalized, and extension fallback handles imperfect iPhone MIME values. File picking, mobile photo/camera selection, desktop drop, preview preparation, removal, upload progress, and upload failure/retry are supported.

The original file is preserved. HEIC conversion runs lazily in the browser using heic2any; compatible previews are resized to a maximum dimension of 1600 pixels and encoded as WebP. Original quality is not destroyed. Some HEIC codecs/devices may fail preview conversion; the file remains accepted with a clear warning and original download. A failed preview upload does not discard the original. Private photo views request compatible previews where present; unsupported HEIC originals are offered as downloads instead of loaded as broken full-size images. Conversion can still require substantial memory for exceptionally large pixel dimensions on older phones.

Search never receives image paths, Blob URLs, private descriptions, brands/models/colors, markings, identities, or staff notes. The `public_found_summaries` database view and `/api/search/` return only ID, found type, broad category, general drop-off building, date, and generic status. Private image responses are streamed through a workspace- and owner-checked server route with no-store headers. Student sessions only access student uploads; authenticated staff may view authorized reports through an explicit staff workspace context. Knowing the staff email grants no access to staff photos. Session privacy is limited by the explicitly unverified demo email login.

Unsubmitted uploads can remain as unattached rows/blobs after abandoned forms or failed saves; production lifecycle cleanup and broader abuse controls are future work. Upload reservations are limited per user and tokens expire after 15 minutes. Successful uploads are reused on immediate report-save retries.

## Verification

```sh
npm run build
npm run typecheck
npm test
```

Tests run the actual Neon migration/functions and server repository against isolated PostgreSQL (PGlite), alongside API ownership/session checks, the complete building dataset, upload type/size policy, Maps loader tests, and retained legacy SQL regressions. They verify unknown/building/map-only persistence, reporter enforcement, foreign-image rejection, idempotent creation, editing, persistent image references, and six-field Search privacy. These tests do not claim that external Neon/Blob credentials or uploads are working.

Live verification requires valid `DATABASE_URL`, a private store token, and the migration. Without them, the app reports failure rather than inventing users, sessions, uploads, or successful report saves. Local preview can use `MAGPIE_NEXT_DIST_DIR=.next-qa npm run dev` to avoid sharing generated files with another running Next server.

## Main implementation files

- `lib/server/`, `app/api/`: server-only database, sessions, report CRUD, private image authorization and safe search
- `db/migrations/001_student_backend.sql`, `002_report_deletion.sql`, `scripts/migrate.mts`: Neon schema, deletion protection, and campus seed
- `services/sessionService.ts`, `workspaceService.ts`, `storageService.ts`: client API adapters and direct private Blob uploads
- `components/AuthForm.tsx`, `PhotoUploader.tsx`, `PrivatePhoto.tsx`, `components/portal/`: existing student UX integration
- `lib/uploadConfig.ts`, `imagePreview.ts`: upload limits, HEIC compatibility, optimized previews

## Report deletion and upload refinement

`db/migrations/002_report_deletion.sql` adds owner-checked transactional deletion, a shared active-recovery predicate, and a durable Blob cleanup queue. Apply it with `npm run db:migrate` before using the new workspace projection/deletion route.

From an owned lost report’s details, choose **Delete Report**, then confirm or cancel. An active verification/approved claim/unused pickup prevents deletion both in the UI and in PostgreSQL. The server obtains ownership from the existing session, never from a submitted email or reporter ID. Deletion removes private details, image metadata, notes, related matches, inactive claims/pickups, and report-specific updates. Other reports, unrelated image records and notices are retained. Dashboard counts refresh without a full reload.

Blob paths are queued in the same transaction before their database image records disappear. The server attempts private Blob deletion after the commit. A Blob failure is logged and retained as a retry job while the UI correctly removes the report and says **Report deleted.** Retry pending files with:

```sh
npm run blobs:cleanup
```

The picker, drag/drop, upload service, reservation route, token route, and completion route share `lib/uploadConfig.ts`. Files travel directly to private Blob storage (multipart for large files); the app request-body cap applies only to small JSON metadata. The 1 MB WebP preview cap is separate from the 25 MB **original per-image** limit. Preview conversion times out with a fallback rather than blocking the original upload or report.

The former 3 MB/JPEG-PNG-WebP restriction still appears only in the archived Supabase bucket SQL, which is not executed by this application. The earlier hosted static browser demo also contains its own historical 3 MB restriction. Local fixes do not update that old deployment: deploy the current Next.js server application to see these fixes live. Do not reapply the archived Supabase schema to Neon.

## Admin Portal and origin/server fixes

Staff sign in at `/admin/login/` using server-only `ADMIN_DEMO_EMAIL` and `ADMIN_DEMO_PASSWORD`. The password is compared on the server using fixed-length digest comparison, never stored in browser storage or a cookie. A separate random opaque token is kept in an HttpOnly, SameSite=Lax cookie (Secure on production); only its SHA-256 hash is stored in `admin_sessions`. Staff sessions expire after eight hours and sign-out revokes the token. A student email session always stays a student, even when its email matches the staff account. Photo reservations are explicitly scoped by workspace and the database rejects attaching staff uploads to student reports or the reverse.

Protected staff pages: `/admin/`, `/admin/found/`, `/admin/reports/`, `/admin/reports/[id]/`, `/admin/matches/`, `/admin/claims/`, `/admin/pickup/`, `/admin/dropoffs/`. The server layout redirects unauthenticated students to staff sign-in. Every staff API also checks the admin session. The staff UI has a separate sidebar, inventory filters, private comparison/details, claim review, custody actions, manual pickup code redemption, drop-off configuration and recent activity. No public messaging is added.

`003_admin_portal.sql` reuses the existing domain tables and adds `admin_sessions`, `admin_login_attempts`, and `staff_activity`; it extends drop-off coordinates, image workspace ownership, and private pickup display codes. A database trigger uses the existing fallback score (attributes, token overlap, time, optional distance) to generate matches atomically when lost reports change or staff intake is saved. This is a similarity heuristic, not image recognition. Claims validate report ownership; approval locks both reports and prevents duplicate assignment; pickup hashes are single-use and expire after seven days. Private student updates follow matches, information requests, approval and return. Plain display codes are intentionally available only to the claimant and authenticated staff; raw session tokens and code hashes never appear in workspace responses.

The origin bug was reproduced in the browser: `Origin: http://localhost:3001` differed from Next.js's internal `http://0.0.0.0:3001` request origin because the development server binds all interfaces. `lib/server/origin.ts` now centralizes CSRF validation: local aliases/ports work only in development against a local binding, current application origins work directly, Vercel deployment/production hosts and its trusted forwarded headers are supported, and custom proxy origins can be explicitly listed in comma-separated `ALLOWED_ORIGINS`. Foreign and absent origins remain rejected. No wildcard CORS headers are used. Frontend requests stay relative. For a local production-mode `npm start` test, explicitly configure its loopback origin in `ALLOWED_ORIGINS`.

The generic 503 was caused by unusable service credentials and an unapplied schema. Connection checks distinguished invalid database configuration, storage token configuration, and missing migrations. The configured Neon connection and private Blob token now pass live checks, and all three migrations have been applied to the configured database. Database failures now distinguish configuration, schema, and connection problems; Blob errors identify storage independently. Safe logs include route, method, status, operation, and a safe code/reason, never raw provider exception messages, connection URLs, tokens, passwords, or private report bodies.

Run internal diagnostics from the terminal (no public debug endpoint):

```sh
npm run services:check
npm run db:migrate
```

`services:check` executes `SELECT 1`, checks migration objects, and makes a minimal Blob read check. Upload writes were separately verified through authenticated app routes with real HEIF and 25 MB HEIC fixtures; a student photo deletion was verified against actual Blob removal. The full live synthetic flow also verified report persistence, automatic matching, private claim review, information requests, approval, pickup, student/admin access isolation, and student refresh persistence. Automated tests use isolated PGlite databases; they do not silently replace Neon at runtime.

For Vercel: set the project root to `reclaim`, choose the Next.js preset and Node.js 22, and configure `DATABASE_URL`, a **private** store `BLOB_READ_WRITE_TOKEN`, `ADMIN_DEMO_EMAIL`, `ADMIN_DEMO_PASSWORD`, and the public Maps variables for each intended environment. The Blob token encodes its store; no separate `BLOB_STORE_ID` is required. Apply migrations to the same database used by that environment. Vercel preview domains work through platform host variables/headers; add custom proxy origins to `ALLOWED_ORIGINS` if necessary. Redeploy after configuration changes. Keep the existing static Site unchanged; it does not host these server APIs.

Demo limitations: student emails are unverified, login throttling is basic (invalid credential throttling is per process), staff workspace lists are unpaginated, and matching has no AI image analysis. Extremely close concurrent cross-type inserts may require a later report update to refresh their match. Expired pickup passes currently need staff follow-up; there is no reissue screen. Abandoned uploads still need lifecycle cleanup. Photos and staff data must remain private during any future deployment.


## Optional Gemini synthetic-demo comparisons

See [Gemini setup and privacy](memory/GEMINI_MATCHING.md). Add the server-only names from `.env.example` locally without replacing existing secrets. AI stays off until `MAGPIE_AI_MATCHING_ENABLED=true`, `MAGPIE_AI_DEMO_MODE=true`, `GEMINI_API_KEY` and `GEMINI_EMBEDDING_MODEL=gemini-embedding-2` are configured and staff explicitly confirm synthetic input. Apply reviewed migration 008 after 001–007 in the authorized disposable environment; no remote migration is performed by this code task. Staff Matches can then compare a selected pair; intake/creation remain deterministic and never wait on Google. Real-user processing is unsupported pending a separate consent workflow.

After local configuration, `MAGPIE_RUN_LIVE_GEMINI_TEST=true npm run test:gemini:live` runs the opt-in authored synthetic test. This task deliberately skipped actual Gemini calls at the user's request. A passing mocked suite does not mean the video has been live-rehearsed.
