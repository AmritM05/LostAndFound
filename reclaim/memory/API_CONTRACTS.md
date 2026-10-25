# API contracts and integration boundaries

## Gemini staff action — 2026-10-25

POST `/api/admin/ai-matching/` requires admin session, allowed Origin and exactly `{lostId:uuid,foundId:uuid,confirmSynthetic:true}`. No arbitrary URLs, vectors or client evidence accepted. Returns a private/no-store result with mode (`gemini` or `deterministic`), applied flag, safe reason/channels and optional private assessment. Students cannot call it. Both server AI/demo gates and a key are required for egress; otherwise deterministic fallback. Report creation is unaffected. 008 and [GEMINI_MATCHING](GEMINI_MATCHING.md) define optimistic persistence and private provenance; owner/public response shapes remain unchanged.

## Integrated contract changes — 2026-10-25

- **GET `/api/dropoffs/`** requires the student session (admin-only cookie does not suffice), returns an array of exactly `{id,campusId,name,buildingId,building,description,lat,lng,active}`. `active:true`; only `student_visible=true`/active desks, with valid active campus buildings if linked. `description` is reviewed `public_instructions`, never staff instructions; coordinates are public building coordinates or null/null. No building yields null ID, empty building, no coordinates. Private/no-store, Vary Cookie; 401 unauthenticated, safe 503 unavailable/schema failure; [] means no published desks. Student adapter maps description to instructions and whitelists fields. No fallback to static desks.
- Staff zone writes accept `studentVisible`/`publicInstructions`; hidden/blank defaults fail closed. SQL007 does not auto-publish or copy private fields. All admin writers must deploy with007.
- Staff workspace includes private `staff_reasoning` assessment: eligible, classification, contradictions, matchingFactors, policyVersion plus numeric evaluation. Classes: very_strong_match/strong_match, possible_match, weak_match, no_match. New rejected pairs are not persisted. Student/direct-match/public DTOs omit reasoning. UI renders it in staff workspace only; rankings are not probabilities.
- Existing student POST claims `{matchId,answer}` remains unchanged;004 preserves previous evidence privately and moves More information to Pending. Correspondence is report-scoped, not claim/request-linked.
- Staff action `{action:"reissuePickup",id,zoneId}` renews eligible expired/missing-deadline passes atomically through006, invalidates old code, retains pickup ID/history and requires active zone/current eligible recovery. Returned/closed state cannot renew.

These contracts are merged and locally verified; current remote schema is incompatible until authorized001–007 deployment. Historical baseline follows.


## Conventions

This inventory describes **implemented** interfaces at baseline `6bf17fd`, not proposed REST resources. Source files are under `app/api/<path>/route.ts`. Use relative browser URLs and the trailing-slash form. No Server Actions or middleware were found. All application APIs use Node runtime.

JSON responses use `Cache-Control: private, no-store`, including safe public search. Errors are `{error:string}`. `services/apiClient.ts` sends same-origin credentials and JSON bodies, parses errors and logs route/method/status in development. No long-lived credential belongs in browser headers or payloads. Dates are ISO-compatible strings; callers should not infer UTC components are local display time. UUID validation currently accepts canonical UUID versions 1–5.

**Student** below means server `requireUser`; **Admin** means `requireAdmin`. **Photo actor** means student by default, or admin only with `workspace=admin` and a valid admin cookie. Auth query parameters choose the required session, not the permission itself. Unless noted, mutation requests require an allowed Origin before business operations. Safe GETs do not require an Origin header.

## Shared report request

```typescript
{
  item: {
    id: string;                   // caller-generated UUID
    type: 'lost' | 'found';        // constrained by the endpoint
    name: string; category: string; color: string;
    date: string; locationKnown: boolean;
    buildingId?: string | null; lat?: number | null; lng?: number | null;
    brand?: string; model?: string; secondaryColor?: string; size?: string;
    description?: string; features?: string; location?: string;
    // found intake additionally uses:
    dropoffZoneId?: string; receivedAt?: string;
    custodyStatus?: 'Received' | 'Stored'; staffNotes?: string;
  };
  privateDetail: string;
  imageIds: string[];
}
```

`lib/server/validation.ts` requires nonempty name <=150, a listed category, nonempty color, boolean locationKnown and a valid past date (five-minute skew allowed). Attributes are bounded at 200 characters; description/features/privateDetail at 4,000. Up to three image UUIDs; SQL checks uniqueness, owner, completion and binding. Caller reporterId, status, location label and Blob URLs do not grant authority. Building coordinates/label come from active database buildings; unknown location clears coordinates/building; map-only coordinates are accepted. Lost edit ignores submitted imageIds and preserves existing image associations.

## Session, student and public endpoints

| Method / route | Request → successful response | Authentication / authorization | Consumers, errors and status |
| --- | --- | --- | --- |
| GET `/api/session/` | no body → `{user:Profile\|null}` | Optional student cookie; no admin escalation | AuthForm, sessionService, useWorkspace; missing token returns null, database failure 503 |
| POST `/api/session/` | `{email:string,name?:string}` → `{ok:true}` and student Set-Cookie | Allowed Origin; ordinary valid email, <=254; optional name truncated to 100 | AuthForm via signIn; 400 bad email, 403 Origin, 503 database. Returns 200, not a Profile |
| DELETE `/api/session/` | no body → `{ok:true}` and expired student cookie | Allowed Origin; matching token revoked if present | signOut; no staff logout side effect; 503 if required database revoke fails |
| GET `/api/workspace/` | no body → `{state:AppState,messages:Correspondence[]}` | Student; owned lost reports, owner notices/notes/matches/claims only | useWorkspace/loadWorkspace; 401 missing session, 503 service/schema |
| POST `/api/reports/` | shared request, type lost → `{id}` (201) | Student owns completed images; server identity overrides client reporter | ReportForm/createReport; 400 validation/business rules; 401/403/503 common errors; same owned ID creation is idempotent |
| PATCH `/api/reports/[id]/` | shared request with matching item.id/type lost → `{ok:true}` | Student must own lost report; active claims block edits | EditLostReport/editLostReport; 404 invalid/foreign report; active-claim error currently 400, not 409; cannot replace photos |
| DELETE `/api/reports/[id]/` | no body → `{deleted:true,cleanupPending:boolean}` | Student owned lost report; database active-recovery guard | DeleteReportAction/deleteReport; 404 foreign/missing/found; 409 active recovery. Blob failure after DB commit keeps deletion successful and queues cleanup |
| GET `/api/search/` | no body → `PublicReport[]` | No session required; database view exposes six fields only | Portal Search/searchPublicReports; no query filters/pagination API; max 200 newest rows; service failure 503 |
| POST `/api/matches/` | `{foundId,lostId}` → `{id,lostId,foundId,score,factors,distance,minutes}` | Student owns lost report; persisted non-dismissed pair and non-returned/non-archived reports | Search “this might be mine” via connectSearchReport; does not force/create a new pair; 404 no compatible persisted pair, 400 bad IDs |
| PATCH `/api/matches/` | `{id:matchUUID}` → `{ok:true}` | Student owns paired lost report; no related active claim | Student dismiss control/dismissMatch; 400 unavailable/foreign/active claim |
| POST `/api/claims/` | `{matchId,answer}` → `{ok:true}` (201) | Student owns lost report; available match/found item; answer trimmed >=10 and <=1,500 | Match review/submitClaim; inserts or resubmits More information claim. 400 unavailable/duplicate/invalid evidence; no claim ID returned |
| POST `/api/notes/` | `{reportId,body}` → `{ok:true}` | Student owns lost report; nonempty note <=2,000 | Report notes/sendMessage; 404 foreign report. This is not a general staff messaging endpoint |
| PATCH `/api/updates/` | no body → `{ok:true}` | Student; updates every notice for that user to read | Mark all read/markUpdatesRead; no per-notice write interface |

### Student response shapes

`Profile`: id, email, name, role, verified. Student role is forced to student. `AppState`: items, privateDetails, notices, matches, claims (see `lib/types.ts`). Item.imagePaths contains application image UUIDs, not Blob URLs. Item.deletionBlocked reflects the database predicate. Match objects contain technical foundId but do not expose the matched item's private evidence.

Claim: id, matchId, claimantId, answers, status, score (currently projected as zero), code, token, pickupLocation. `token` currently duplicates the private display code; it is not a distinct signed QR token. Code appears only for an approved, unused, unexpired owner's pass. Correspondence: id, reportId, body, fromStaff, createdAt. Notice: id, title, message, read, reportId, matchId, createdAt.

## Shared image endpoints

| Method / route | Contract | Auth, consumers, failures |
| --- | --- | --- |
| POST `/api/images/reserve/` | `{name,type,size}` → `{id,pathname,previewPathname,mimeType}` (201) | Photo actor + Origin. storageService checks same 25 MB/type policy. At most 30 reservations per owner/hour; 429 if exceeded. Token config errors are storage 503. Returned path is not a public photo URL |
| POST `/api/images/upload/` | Vercel Blob SDK HandleUploadBody → SDK result (token-generation includes a narrow clientToken) | storageService SDK callback URL. Token generation checks Origin, photo actor, matching owner/upload_role/path, unbound report and reservation <15 min old. Token expires after 15 min and restricts original type/size or preview WebP <=1 MB. Completion callbacks are SDK-signed/verified; they are not ordinary user-authenticated POSTs |
| POST `/api/images/[id]/complete/` | `{preview:boolean}` → `{id}` | Photo actor + Origin; owned, matching-role unbound image. Server HEAD verifies private original path/type/exact reserved byte size; optional preview must be private WebP <=1 MB. Marks uploaded; 404 unavailable/foreign, 400 failed verification, 503 database/Blob |
| GET `/api/images/[id]/` | default → private preview if available, otherwise original binary; `metadata=1` → `{filename,mimeType,hasPreview}`; `original=1` → original attachment | Photo actor; student owner/student-role only, or authenticated staff. PrivatePhoto uses `workspace=admin` for staff including metadata/download. 404 missing/foreign/unuploaded, 401 required session absent, 503 provider failure. Binary responses have private/no-store, Cookie Vary and nosniff |

Apply `workspace=admin` consistently to reserve, SDK upload URL, complete and read requests in staff workflows. Mixed sessions must not change upload ownership implicitly. `uploadReportImages(files,onProgress?,workspace?)` defaults to student, caches completed IDs per File **and workspace**, and returns UUIDs after finalization. It uploads multipart above 4 MB and preserves originals if optional preview upload fails.

## Admin endpoints

| Method / route | Request → response | Auth, consumers and limitations |
| --- | --- | --- |
| GET `/api/admin/session/` | no body → `{user:Profile\|null}` | Optional separate admin cookie; admin role required in database; used by AdminPortal |
| POST `/api/admin/session/` | `{email,password}` → `{ok:true}` and admin Set-Cookie | Allowed Origin, configured server credentials; AdminLogin. 401 “Invalid admin credentials.”, 429 throttled, 503 not configured/service failure; length guards 254/1,000 |
| DELETE `/api/admin/session/` | no body → `{ok:true}` and expired admin cookie | Origin; revoke this staff token if present; does not clear student session |
| GET `/api/admin/workspace/` | no body → `{reports,matches,claims,pickups,zones,activity,buildings,notes}` | Admin. AdminPortal consumes full private data. Unpaginated lists, last 30 activity rows. Report image IDs are nested in reports; there is no top-level images array |
| POST `/api/admin/reports/` | shared request, type found, active dropoffZoneId, receivedAt, staffNotes → `{id}` (201) | Admin; ReportForm in AdminPortal. Received time must be >=found time and not future beyond skew; custody Received/Stored. Staff owns image reservations. Duplicate ID is an error, not an idempotent retry |
| POST `/api/admin/dropoffs/` | `{id?,name,buildingId,instructions,lat,lng,active}` → `{ok:true}` | Admin + Origin; active building; id generated if absent; name <=150, instructions <=2,000, finite bounded coordinates, boolean active. Upsert by ID. Zone editor; no separate public/list/delete endpoint |
| POST `/api/admin/actions/` | discriminated action requests below → `{ok:true}` | Admin + Origin; AdminPortal action forms. Invalid action/fields 400; guarded unavailable custody/dismiss actions 409; business exceptions generally 400 |

Admin workspace reports use camelCase `reportView` with full identifyingDetails, reporterEmail/reporterName, staffNotes and imagePaths. Matches, claims, pickups, zones, activity, buildings and notes mostly retain **database snake_case**. Example: match lost_report_id; claim match_id/claimant_id/answers; pickup display_code/expires_at/used_at/location; zone building_id/instructions/latitude/longitude. Code hashes/session tokens are excluded from pickup projections. See `lib/server/adminRepository.ts`; do not assume a shared AppState payload.

### Admin action request variants

```typescript
{action:'reviewClaim', id:string,
 status:'Approved'|'Rejected'|'More information', zoneId?:string, message:string}
{action:'pickup', code:string}
{action:'dismissMatch', id:string}
{action:'custody', id:string,
 status:'Received'|'Stored'|'Potential Match'|'Claim Pending'}
```

Approval requires active pickup zone; message <=2,000. A 12-character uppercase hexadecimal code is generated server-side, stored as hash plus private display value and expires in seven days. Wrong/expired/reused pickup codes fail. Direct custody changes cannot mark Ready for Pickup or Returned; those require claim approval/redemption and cannot override active recovery. Dismiss requires no active claims. Database functions enforce atomic state transitions and activity/notice writes.

## Client functions and legacy traps

Active student adapters in `services/workspaceService.ts`: loadWorkspace, searchPublicReports, createReport, editLostReport, markUpdatesRead, sendMessage, dismissMatch, submitClaim, connectSearchReport, deleteReport. Student sessions live in sessionService; image upload/download paths in storageService. Actual staff UI calls `/api/admin/*` through apiClient rather than these old staff adapters.

`listDropoffZones()` currently always returns an empty array. `updateReportStatus`, `saveDropoffZone`, `reviewClaim`, `confirmPickup`, `updateCustody` in workspaceService throw unavailable; their old consumers reside in unreachable legacy admin branches of Portal/DropoffZones. They do not describe the active admin HTTP contract. Do not enable those branches or call these stubs in a new feature.

## Error semantics and proposed interfaces

Validation/SQL allowlisted business errors generally return 400; 401 session, 403 Origin/upload scope, 404 absent/unowned resources, 409 protected deletion/custody/dismiss, 413 JSON-size bound, 429 throttle/reservation limit, 503 service/config/schema/unexpected failures. API statuses are not universally normalized; DB non-allowlisted errors can be mapped as service failure. Treat response.error as display text, not a stable machine enum.

**Proposed, not implemented:** safe GET `/api/dropoffs/` returning active zone identity/name/building/instructions/coordinates only; precise field names and auth policy require team agreement before consumers change. Also proposed: matching compatibility/version/explanation contracts, structured API error codes, pickup reissue and typed paginated staff projections. Record accepted versions and migration/consumer rollout here; do not infer an endpoint exists from a backlog entry.
