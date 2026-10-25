# Environment and setup

## Local prerequisites and checkout

Use Node.js 22.13 or newer and npm; the migration script uses global WebSocket. The Git repository root contains `reclaim/`; run package commands from that directory. There is an npm lockfile. Use `npm ci` for a clean reproducible install, rather than changing package versions as part of setup. No Docker or local Supabase is required for the active application.

```sh
cd reclaim
npm ci
# Copy .env.example to .env.local only if .env.local does not already exist.
# Fill required credentials locally; never paste them into documentation or chat.
npm run services:check
# Apply migrations only to the intended shared/dev database with team coordination.
npm run db:migrate
npm run dev
```

The dev script binds all interfaces and starts on port 3000, choosing another free port if needed. Open the actual URL printed by Next. For concurrent local servers, choose a separate ignored build directory through MAGPIE_NEXT_DIST_DIR or use separate worktrees. Don't run multiple builds/dev servers writing the same output. Do not overwrite another developer's .env.local, stop an unowned process or automatically change the user's ports.

## Environment variable names only

| Names | Scope / purpose |
| --- | --- |
| `DATABASE_URL` | Server-only full Neon PostgreSQL connection, not a hostname/project ID/psql command. Runtime validator requires a Neon hostname |
| `BLOB_READ_WRITE_TOKEN` | Server-only read/write token for a private Vercel Blob store; also needed for cleanup |
| `ADMIN_DEMO_EMAIL`, `ADMIN_DEMO_PASSWORD` | Server-only configured staff credential pair |
| `ALLOWED_ORIGINS` | Optional server comma-separated complete application origins for custom proxies/local production-mode testing |
| `VERCEL_BLOB_CALLBACK_URL` | Optional reachable callback override for local SDK callback testing; authenticated completion also verifies metadata directly |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser Maps key; restrict in Google Cloud, never treat it as a secret that can be hidden in JS |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Optional JavaScript Map ID; component has a development fallback |
| `NEXT_PUBLIC_CAMPUS_NAME`, `NEXT_PUBLIC_CAMPUS_LAT`, `NEXT_PUBLIC_CAMPUS_LNG` | Optional displayed campus name and center overrides |
| `NEXT_PUBLIC_CAMPUS_CONFIG` | Optional single-line campus JSON parsed by campus.ts; migrate/seed matching buildings separately |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` | Campus helper allowlist; **current email demo login explicitly bypasses it**, so this is not an enforced access control |
| `NEXT_PUBLIC_PICKUP_LOCATION` | Optional campus helper display fallback; real staff approvals use database zone IDs |
| `MAGPIE_NEXT_DIST_DIR` | Optional build/dev output isolation; use an ignored folder |
| `NODE_ENV`, `VERCEL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | Framework/platform runtime settings read by secure-cookie/origin logic; not personal credentials |

There is no AI-model key or configured model variable in the current app. No separate BLOB_STORE_ID is required by the implementation. Removed Supabase public URL/anon credentials are not required. Never add a NEXT_PUBLIC prefix to database, Blob or staff secrets. Do not commit populated files or token values. Local private credentials are not distributed through GitHub; each teammate needs authorized access through an agreed secret channel.

## Neon

Create/select the intended Neon database and copy its full connection string from Connect into the local environment. Run the internal health command to test SELECT 1 and expected migration objects. The migration runner applies all three sorted SQL files and upserts the configured campus buildings. It replays SQL without a migration ledger; discuss shared schema updates first. A fresh database has no automatically approved staffed intake desk; staff must configure an active zone before found intake.

Do not execute archived Supabase SQL against Neon. Do not run migrations merely to diagnose a teammate's database without checking branch/schema compatibility. PGlite is used only by tests and is not a runtime fallback.

## Blob

Use a **private** Vercel Blob store. Give its token only to server environments. Reservation/auth routes delegate narrow short-lived tokens for direct browser upload; metadata-only Next requests avoid function body-size limits. Original max is centrally fixed at 25 MB per image, three images, with a separate 1 MB optional preview cap. Finalization rejects a public store hostname. The read check in services:check does not by itself prove writes/private access; run synthetic authenticated upload/read/authorization checks when deploying.

Retry queued report-photo cleanup with `npm run blobs:cleanup` (up to 100 pending jobs per run). This mutates remote Blob/queue data; confirm you are targeting the correct environment. No automated cleanup schedule or abandoned-upload collector exists yet.

## Maps and campus configuration

Enable the Google Maps JavaScript API and billing, authorize intended HTTP referrers and use an appropriate JavaScript Map ID or the component fallback. Rebuild after changing browser-public variables. Loader timeouts/auth failures surface an unavailable state; users can still choose a building or unknown location. Campus JSON affects browser data and seed input, but old database buildings are not automatically deactivated; full multi-campus/tenant migration is unfinished.

## Commands and what they actually verify

| Command | Meaning |
| --- | --- |
| `npm run dev` | Local Next development server |
| `npm run build` | Production compile, type validation and route generation |
| `npm start` | Serve an already built Node application |
| `npm run typecheck` | TypeScript noEmit; strict mode is currently disabled |
| `npm test` | Node/tsx tests, PGlite databases and helpers/API authorization checks |
| `npm run services:check` | Internal terminal-only Neon query/object and Blob read checks; safe diagnostics, no public health endpoint |
| `npm run db:migrate` | Remote schema/seed mutation, coordinate before running |
| `npm run blobs:cleanup` | Remote private-photo deletions for durable queued jobs |

Tests do not need live Neon/Blob credentials. There is no committed full browser automation suite or CI workflow at the baseline. See [VERIFICATION.md](VERIFICATION.md) for current evidence, not a blanket promise that each command has just been run.

## Deployment and troubleshooting

Current code requires a Node-capable Next.js host; select the Next.js preset, application root `reclaim` and compatible Node runtime on Vercel. Configure the server variables and public Maps variables in each intended preview/production environment, apply migrations to that environment's database and rebuild/redeploy when settings change. Protect actual domains/referrers. Vercel host variables/forwarded headers are supported; custom proxies may need ALLOWED_ORIGINS.

The historical `.openai/hosting.json` points at static `out`. That artifact cannot run the current Route Handlers, Neon sessions or private-photo proxy. Preserve its audience and do not deploy stale static output as the new app. A current compatible deployment remains unverified.

For Origin rejection: inspect actual browser origin, local bind, proxy/forwarded host/protocol and explicit allowlist; do not disable security or add wildcard CORS. For 503: use route/operation safe logs and services:check to distinguish configuration/schema/connection from Blob failure; don't log a full provider exception. For missing tables/functions: check migration branch/order, then apply the reviewed migration. For map failures: check Google enablement/billing/referrers; keep optional-location fallback. For HEIC preview failures: original upload/download remains supported. For old 3 MB UI: verify you are not viewing the old static deployment. For login failing immediately after code change: confirm server restart and correct database, not an invented in-memory user.
