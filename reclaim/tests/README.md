# Student acceptance harnesses

Run package commands from `reclaim/`. No harness changes production providers or supplies runtime fake success.

| Category | Command | Scope |
| --- | --- | --- |
| Isolated SQL/API security | `node --conditions=react-server --import tsx --test services/studentIntegration.test.ts` | Fresh PGlite; production SQL/repositories, synthetic identity/photo metadata, staff-route denials. No remote authentication/upload proof. |
| Synthetic browser — recovery | `MAGPIE_STUDENT_TEST_URL=http://127.0.0.1:3011 node tests/student-portal.browser.mjs` | All APIs intercepted; response/error/refresh/pass/navigation/guidance presentation. |
| Synthetic browser — intake/privacy | `MAGPIE_STUDENT_TEST_URL=http://127.0.0.1:3011 node tests/student-intake.browser.mjs` | All APIs intercepted; lost wizard, optional/unknown location, invalid/oversized images, selection/removal, retry/deletion/search/desktop navigation. No fake Blob upload. |
| Real services — opt-in | `node --env-file-if-exists=.env.local --test tests/live-recovery.integration.mjs` | Skipped by default. Requires explicit disposable-environment gates; real HTTP sessions, production student UI/private PNG upload, staff HTTP workflow and data round trips. |

For browser runs, install Playwright plus its browser in your test environment, or set `PLAYWRIGHT_MODULE_PATH` to an existing module. `PLAYWRIGHT_CHANNEL=chrome` selects installed Chrome; each run launches a fresh isolated headless profile. Use a separate build directory and free local port; synthetic harnesses refuse non-loopback targets. The real driver never calls `route()` or mocks requests.

Real driver gates: `MAGPIE_LIVE_ACCEPTANCE=1`, `MAGPIE_DISPOSABLE_ENVIRONMENT=yes`, `MAGPIE_LIVE_BASE_URL`, privately supplied `ADMIN_DEMO_EMAIL` / `ADMIN_DEMO_PASSWORD`. `MAGPIE_MATCHING_ACCEPTANCE_READY=1` and `MAGPIE_RECOVERY_ACCEPTANCE_READY=1` enable the corresponding reviewed/deployed acceptance checks; otherwise they remain explicitly skipped. The real driver leaves scoped resource IDs for review and does not bypass recovery deletion guards. Dispose the dedicated test database/store afterward with its owner. Never target shared or production data.

Use [the demo runbook](../memory/DEMO_RUNBOOK.md) for setup, migration ordering, the three-minute sequence, privacy matrix, limitations and fallback. Record exact command/result, commit and environment category in Developer 1's log; distinguish failures, skipped dependencies and TODOs from passes.
