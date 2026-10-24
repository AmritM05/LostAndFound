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
NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB=25
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=
```

Never prefix `DATABASE_URL` or `BLOB_READ_WRITE_TOKEN` with `NEXT_PUBLIC`. Neither is imported by client code. The Google API key is a public browser key and must have API/referrer restrictions. Blank Map ID uses `DEMO_MAP_ID`; blank email domains accept any normal valid email. Restart after changing local environment values and rebuild after changing public values.

### Neon dashboard

Create/select a Neon PostgreSQL project and database, open **Connect**, and copy the full PostgreSQL connection string (beginning `postgresql://`, including user, password, hostname, database, and SSL parameters). Put only that connection string in `DATABASE_URL`, not a project ID, key, hostname, `psql` command, or SQL statement. Run `npm run db:migrate` from this directory. The idempotent migration creates the relational schema and upserts all 251 bundled OSU buildings. Use a dedicated application database/role; keep access server-side.

The migration script reports configuration failures without printing credentials. It uses Neon's WebSocket driver for the migration batch; application queries use Neon's HTTP driver with parameterized SQL. No ORM is required.

### Vercel dashboard and deployment

Create a **private** Blob store under Vercel Storage, connect it to the app project, and add its `BLOB_READ_WRITE_TOKEN` to local/deployment server environment variables. Public stores are unsupported: finalization verifies the private Blob hostname. For deployment, import this directory as a **Next.js** project, configure the same environment variables for the intended environments, and deploy. Alternatively run `npm run build` then `npm start` on a Node-capable host. No Vercel deployment credentials are included in the repository.

This is now a server application with Next.js Route Handlers. It cannot run on the previous static Sites host or by serving `out/`; `output: export` has been removed. The previously published Sites URL remains the older browser-only demo until a compatible server deployment is configured. Its existing audience is unchanged. Do not publish the old `out/` directory as this backend release.

Direct-to-Blob multipart client uploads avoid the Vercel Function request-body limit. The app server issues a short-lived token scoped to an authenticated user's reserved image path, type, and size. Only image IDs/metadata are sent when creating a report. Completion verifies Blob metadata and does not depend on delivery of a local webhook. If callback testing is wanted locally, configure `VERCEL_BLOB_CALLBACK_URL` with a reachable HTTPS tunnel. The Blob write token remains server-only.

### Google Cloud

Enable Maps JavaScript API and billing. Restrict the browser key to this API and the actual localhost/deployed HTTP referrers. Leave Map ID blank for the development fallback or use a real JavaScript Map ID. A map error never prevents building-only or unknown-location reporting.

## Student flow and demo sessions

Enter an email and press **Continue**. The server creates/retrieves a `users` record with a default student role, stores only a hash of a random session token in Neon, and sets a seven-day HTTP-only SameSite cookie (Secure in production). Refresh preserves the session; Logout deletes it. No password, confirmation email, SSO, or Supabase setup is used. The auth adapter is isolated in `lib/server/session.ts`.

This is intentionally **not production identity verification**: anyone who knows an email can enter as that user. Use sample information. Email-only sessions always receive student privileges even if the underlying user record is manually marked admin. There is no role selector, student Found Item form, or exposed admin interface. Existing `/admin/*` routes return 404 in this release. Real verified identity must replace demo login before private real-world use or staff access.

Reports, private descriptions, notes, updates, image associations, and users persist in Neon. Existing reports stored by the earlier browser-only version are left untouched in browser storage and are not silently uploaded. There is no local-storage fallback that claims a failed remote save succeeded.

## Relational model and future staff work

`db/migrations/001_student_backend.sql` defines:

- `users`, `demo_sessions`
- `buildings`, `dropoff_zones`
- one `reports` table supporting both lost and found reports, with normalized category/name/brand/model/two colors/description/time/location/custody fields
- `private_report_details`, `report_images`
- `potential_matches`, `claims`, `pickups`, `updates`, `report_notes`

The reporter email is obtained through the user foreign key rather than copied into every report. Original and preview Blob metadata live in `report_images`; binary data never enters PostgreSQL. Private ownership fields are separate from reports. Future staff intake, drop-off/custody management, matches, claims, verification, and single-use pickup information can use these same tables. No staff interface or automatic matching engine is added in this task. Search interest/claim/pickup actions remain unavailable until those workflows are implemented.

`save_student_report` atomically saves the report, ownership details, image links, and initial update. It enforces student lost-only submission, owner-scoped editing, valid active buildings, valid coordinates, and completed owned images. Building coordinates come from the database. Unknown locations clear building and coordinates; a map-only point is valid. The original instant remains in `occurred_at`; `lost_date` and `lost_time` are its UTC components.

Queries enforce ownership server-side. The app does not rely on old Supabase RLS or any client-supplied reporter ID. The legacy `supabase/` SQL and its tests remain only as reference; do not apply that schema to Neon.

## Private images and HEIC

JPEG/JPG, PNG, WebP, HEIC, and HEIF are supported, including HEIC/HEIF files with missing or generic MIME types and valid extensions. The shared `lib/uploadConfig.ts` controls the default **25 MB per image**, up to three files. The browser and upload token route apply the same limit. Over-limit errors name the configured limit. File picking, mobile photo/camera selection, desktop drop, preview preparation, removal, upload progress, and upload failure/retry are supported.

The original file is preserved. HEIC conversion runs lazily in the browser using heic2any; compatible previews are resized to a maximum dimension of 1600 pixels and encoded as WebP. Original quality is not destroyed. Some HEIC codecs/devices may fail preview conversion; the file remains accepted with a clear warning and original download. A failed preview upload does not discard the original. Private photo views request compatible previews where present; unsupported HEIC originals are offered as downloads instead of loaded as broken full-size images. Conversion can still require substantial memory for exceptionally large pixel dimensions on older phones.

Search never receives image paths, Blob URLs, private descriptions, brands/models/colors, markings, identities, or staff notes. The `public_found_summaries` database view and `/api/search/` return only ID, found type, broad category, general drop-off building, date, and generic status. Private image responses are streamed through an owner-checked server route with no-store headers. Session privacy is limited by the explicitly unverified demo email login.

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
- `db/migrations/001_student_backend.sql`, `scripts/migrate.mts`: Neon schema and campus seed
- `services/sessionService.ts`, `workspaceService.ts`, `storageService.ts`: client API adapters and direct private Blob uploads
- `components/AuthForm.tsx`, `PhotoUploader.tsx`, `PrivatePhoto.tsx`, `components/portal/`: existing student UX integration
- `lib/uploadConfig.ts`, `imagePreview.ts`: upload limits, HEIC compatibility, optimized previews
