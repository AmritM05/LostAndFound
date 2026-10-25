# Product overview

## Purpose, audience and hackathon goal

Magpie helps campus students recover belongings without publishing the details someone would need to impersonate the owner. HackOHI/O 2026's intended demonstration is a complete private recovery journey, with a campus-configurable interface rather than an OSU-only product. The bundled example campus is Ohio State Columbus.

Students need a quick mobile reporting workflow and private updates. Front-desk staff need laptop-friendly intake, custody records and controlled verification. The project lead coordinates deployment, privacy and integration across three developers.

## Confirmed decisions to preserve

- Student Portal and Admin Portal have separate navigation and sign-in experiences. No role selector on student login.
- Students submit **lost** reports only. A finder physically turns an item in to authorized staff; staff create the **found** inventory report after receiving it.
- Photos, exact descriptions, distinctive attributes, verification answers, identities and staff notes are withheld from generic Search.
- Search returns only a broad category, general intake building, date and generic custody status, plus technical ID/type fields.
- Matching and ownership review are private. Similarity is not proof of ownership. Staff decide claims and confirm return.
- Optional location must remain optional; unknown location must not become coordinates at zero or a fabricated nearby match.
- Use the established soft black/white/blue visual language, actual user-supplied photos, and Magpie branding. No AI-generated placeholder item photos or ChatGPT branding/watermarks.
- Keep Next.js/React/TypeScript, Neon, private Vercel Blob and Google Maps. Supabase files are historical reference, not a desired runtime provider.
- Student demo sign-in accepts ordinary valid email without email confirmation or password. Staff credentials are server-only. These are hackathon authentication choices, not production identity assurance.

## Journeys and current state

1. **Lost item:** email sign-in → category and private attributes → optional building/map/unknown location and time → optional private images → Neon report → My Reports, edit/delete if eligible → private matches and updates. Implemented and verified within the evidence limits in VERIFICATION.
2. **Found item:** finder hands item to staff → staff login → select an active intake desk → private found report/photos, date/received time and notes → custody record and automatic matching. Implemented and verified.
3. **Ownership and pickup:** student privately submits evidence for an owned lost report's match → staff requests information, rejects or approves → private pickup pass → staff enters code after physical identity check → both reports Returned. Main flow is implemented; student resubmission UX and expired-pass recovery remain incomplete.
4. **Campus guidance:** students browse buildings/map and should find active staffed drop-off zones. Building search/map integration exists, but student drop-off listing is disconnected from the implemented staff-managed zones.

## Intent versus implementation

Current matching is an algorithmic weighted text/attribute/time/distance fallback. No AI provider, embedding model, image similarity, OCR or automated contradiction filtering is integrated. The proposed two-stage model and new weights in AI_MATCHING are requirements, not current behavior.

Campus configuration is partial: UI name, center and building dataset can be configured, but the staff client hardcodes a campus ID when adapting zones, the database is not tenant-isolated, and the migration seed updates do not migrate an entire installation between campuses. Do not advertise full multi-campus tenancy.

## Future goals

Prioritize a reliable hosted demonstration, connected student intake guidance, contradiction-safe matching and a coherent ownership review loop. Later goals include measured image/semantic similarity, verified student identity, multi-staff accounts, stronger operations, pagination, retention and audit policies. Product decisions and priorities must be agreed by the team before provider or identity changes.

Sources: `components/portal/Portal.tsx`, `components/admin/AdminPortal.tsx`, `lib/campus.ts`, `lib/server/repository.ts`, `db/migrations/003_admin_portal.sql`. See [feature inventory](FEATURE_INVENTORY.md), [security](AUTH_AND_SECURITY.md) and [backlog](TASK_BACKLOG.md).
