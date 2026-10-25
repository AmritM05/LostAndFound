# UI and design contract

## Preserve the existing direction

The user requested refinement and collaboration, not a new design. Preserve separate student and staff experiences, Magpie's code-native SVG mark (`components/Brand.tsx`), soft black/white/blue palette, understated panels, privacy copy and form accessibility. No stock/AI placeholder item photos, ChatGPT marks, unrelated illustrations or new theme framework are required.

`app/globals.css` owns global tokens and both portal styles. Current main tokens: ink `#17191d`, muted `#707988`, blue `#3973c6`, hover `#2d60a9`, light blue `#eaf3ff`, background `#f7f9fc`, border `#e4e8ef`, white `#fff`. Typography uses Arial/Helvetica/system sans-serif. Existing h1 is 27px with compact tracking; staff title is 30px desktop, 26px small-screen. Use established `.button`, `.panel`, `.form-stack`, alert and badge styles rather than a parallel component system.

## Components and ownership

- Brand, BuildingSelector, CampusMap, PhotoUploader, PrivatePhoto and ReportForm are **shared**. Coordinate prop changes with both portal owners.
- Student-only primary surface: `components/portal/Portal.tsx`, `useWorkspace.ts`, `EditLostReport.tsx`, `DeleteReportAction.tsx` and `ui.tsx`.
- Staff surface: `components/admin/AdminPortal.tsx`, `AdminLogin.tsx`; `.staff-*` styles. The active staff app is separate from unused Portal admin branches.
- ReportForm uses four steps: category, private item details, location/time, photos/review. Found mode adds active intake zone, received time and staff notes. Authorization cannot depend on this mode prop.

## Screens and navigation

Student sections: Overview, Search, Report a lost item, Campus map, My reports, Magpie Updates. Root page also renders overview. Login/signup use email plus optional name and Continue, without a role switch. Search has vague summaries and an owned-lost-report match selection; private report/claim evidence lives in dialogs. Report forms show private-data notes and no confirmation-email requirements.

Staff navigation: Overview, Found Item Intake, Reports, Matches, Claims, Pickup, Drop-Off Zones, Sign Out. Staff overview has custody/lost/match/claims/pickup/returned counts and recent activity. Reports use a desktop table with filters and private side-panel detail. Match comparison and claims show evidence only after staff authentication. Pickup uses manual code entry; camera scanning is not implemented.

Building markers show campus buildings; they must not imply every building accepts found items. Staff zones are a separate entity. The student zone list is currently disconnected, with stale “staff tools unavailable” copy; do not preserve that incorrect claim when implementing MAG-003.

## Responsive and accessibility behavior

Student styles support mobile navigation/form layouts. Staff uses a fixed 242px sidebar on desktop, content panel/table, intermediate layout around 1100px and horizontal navigation/single-column adaptations around 760px. Shared report form adapts within the staff shell. Verify both narrow and desktop layouts before changing shared CSS.

BuildingSelector exposes combobox/listbox suggestions with Arrow keys, Enter, Home/End, Escape and clear selection. Report and match dialogs have labels and focus handling; the newer staff detail traps Tab/Escape with an autofocus close button. DeleteReportAction is an inline confirmation group, focuses Cancel, supports Escape and restores trigger focus. Error alerts and upload progress are visible; don't remove them to make failures appear successful. A complete accessibility audit is not yet recorded.

Photos have filenames, removal controls, prepared-preview/fallback states and original downloads. HEIC conversion failure must not display a broken mandatory thumbnail or prevent original upload. No hidden compression of the original. Preserve the 25 MB per-image wording and separate three-photo limit.

## Privacy and copy requirements

Generic Search must not render item names, brands/models/colors, identifying details, owner/finder contact or private photos. Private student matches must not reveal the found report's description/photo. Staff-only comparison may show them after server authorization. UI role hiding is not access control.

Existing numeric similarity percentages and “Very likely match” remain uncalibrated; target Strong Match/Possible Match labels should be implemented together with the matching contract. Never label current manual “Visual attributes” as AI image recognition. Do not silently claim staff activity or real item custody for synthetic fixtures.

## Multi-campus and design gaps

Name/center/building config exists but full tenancy does not. Staff zone adaptation still uses an OSU campus ID; demo email login does not enforce configured domains. Text must be reviewed when changing campus, rather than merely changing a title. Expired pickup passes, more-information resubmission, stale views after staff changes, zone guidance and all-filter empty states need UX work. See [known bugs](KNOWN_BUGS.md) and [coordination](TEAM_COORDINATION.md).
