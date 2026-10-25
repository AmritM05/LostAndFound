// Student UI contract tests against a local production server. All /api calls are
// intercepted: this suite never uses a live account, database, Blob store or admin API.
// Run: MAGPIE_STUDENT_TEST_URL=http://127.0.0.1:3011 node tests/student-portal.browser.mjs
// Set PLAYWRIGHT_MODULE_PATH to an installed playwright module if not locally available.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.MAGPIE_STUDENT_TEST_URL;
if (!base || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('MAGPIE_STUDENT_TEST_URL must identify an isolated loopback server.');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
let checks = 0;
async function eventually(check) {
  for (let i = 0; i < 100; i++) {
    try { await check(); return; } catch (error) {
      if (i === 99) throw error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const item = { id: 'lost-1', reporterId: 'student-1', type: 'lost', name: 'My sample wallet', category: 'Wallets & Cards', brand: '', model: '', color: 'Black', description: 'My own report', location: 'Unknown', locationKnown: false, lat: null, lng: null, date: '2026-10-23', status: 'Awaiting Verification', image: '', features: '', imagePaths: [] };
  const match = { id: 'match-1', lostId: item.id, foundId: 'private-found-id', score: 72, factors: { Category: 100 }, distance: null, minutes: 30 };
  const claim = { id: 'claim-1', matchId: match.id, claimantId: 'student-1', answers: 'The old sample evidence', score: 0, status: 'More information' };
  const state = { items: [item], matches: [match], claims: [claim], notices: [], privateDetails: {} };
  const messages = [{ id: 'note-1', reportId: item.id, body: 'Please describe the hidden stitching.', fromStaff: true, createdAt: '2026-10-24T15:00:00Z' }];
  let session = { id: 'student-1', name: 'Sample Student', email: 'synthetic@example.com', role: 'student', verified: false };
  let workspaceFails = false, claimFails = false, sessionFails = false;
  let workspaceReads = 0;
  const submissions = [], unexpected = [];
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path === '/api/session/') return sessionFails ? respond({ error: 'Temporary session service outage' }, 503) : respond({ user: session });
    if (path === '/api/workspace/') {
      workspaceReads++;
      return workspaceFails ? respond({ error: 'Temporary workspace outage' }, 503) : respond({ state, messages });
    }
    if (path === '/api/claims/' && request.method() === 'POST') {
      submissions.push(request.postDataJSON());
      if (claimFails) return respond({ error: 'Please retry your private response' }, 503);
      claim.answers = request.postDataJSON().answer;
      claim.status = 'Pending';
      return respond({ ok: true }, 201);
    }
    if (path === '/api/search/') return respond([]);
    unexpected.push(`${request.method()} ${path}`);
    return respond({ error: 'Unexpected test API call' }, 500);
  });
  await page.clock.install();
  await page.goto(`${base}/student/updates/`);
  await page.getByRole('button', { name: 'Respond privately' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Please describe the hidden stitching.', { exact: true }).waitFor();
  const answer = dialog.getByRole('textbox', { name: 'Updated ownership evidence' });
  assert.equal(await answer.inputValue(), claim.answers);
  assert.equal(await dialog.locator('img[src*="/api/images/"]').count(), 0);
  if (process.env.STUDENT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.STUDENT_SCREENSHOT_DIR}/student-response-mobile.png`, fullPage: true });
  checks++;
  await answer.fill('          ');
  await dialog.getByRole('button', { name: 'Send private response', exact: true }).click();
  await dialog.getByText('Enter at least 10 characters of ownership evidence.', { exact: true }).waitFor();
  assert.equal(submissions.length, 0);
  checks++;
  const updated = 'The hidden pocket has synthetic blue stitching.';
  await answer.fill(updated);
  claimFails = true;
  await dialog.getByRole('button', { name: 'Send private response', exact: true }).click();
  await dialog.getByText('Please retry your private response', { exact: true }).waitFor();
  assert.equal(await answer.inputValue(), updated);
  checks++;
  claimFails = false;
  await dialog.getByRole('button', { name: 'Send private response', exact: true }).click();
  await dialog.getByRole('heading', { name: 'Awaiting staff review' }).waitFor();
  assert.deepEqual(submissions.at(-1), { matchId: match.id, answer: updated });
  assert.equal(await dialog.getByRole('textbox').count(), 0);
  checks++;
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  // Transient refresh errors retain identity and the successful private snapshot.
  workspaceFails = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('Temporary workspace outage', { exact: false }).waitFor();
  assert.ok(await page.getByRole('heading', { name: item.name, exact: true }).count() > 0);
  assert.equal(await page.getByRole('button', { name: 'Sign out', exact: true, includeHidden: true }).count(), 1);
  checks++;
  workspaceFails = false;
  sessionFails = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('Temporary session service outage', { exact: false }).waitFor();
  assert.ok(await page.getByRole('heading', { name: item.name, exact: true }).count() > 0);
  sessionFails = false;
  checks++;
  claim.status = 'Approved';
  delete claim.code;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'View recovery', exact: true }).click();
  await dialog.getByRole('heading', { name: 'Pickup pass unavailable' }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'View pickup pass' }).count(), 0);
  checks++;
  await page.keyboard.press('Escape');
  claim.code = 'SAMPLECODE123';
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'View recovery', exact: true }).click();
  await dialog.getByRole('button', { name: 'View pickup pass' }).click();
  await dialog.getByText('SAMPLECODE123', { exact: true }).waitFor();
  // A remote return is picked up by bounded polling; an already-open pass closes.
  item.status = 'Returned';
  claim.status = 'Returned';
  delete claim.code;
  const readsBefore = workspaceReads;
  await page.clock.runFor(30000);
  await eventually(async () => assert.equal(await page.getByRole('dialog').count(), 0));
  assert.ok(workspaceReads - readsBefore <= 1);
  await page.getByText('Item returned', { exact: true }).waitFor();
  checks++;
  // Account changes must not retain another student's private data on load failure.
  session = { ...session, id: 'student-2', name: 'Other Sample' };
  workspaceFails = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByText('Temporary workspace outage', { exact: false }).waitFor();
  assert.equal(await page.getByRole('heading', { name: item.name, exact: true }).count(), 0);
  await page.getByRole('heading', { name: 'Your workspace is unavailable', exact: true }).waitFor();
  checks++;
  // An explicitly signed-out session clears private data and controls.
  session = null;
  workspaceFails = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByText('Sign in to see your private updates and recovery status.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'View recovery', exact: true }).count(), 0);
  checks++;
  session = { id: 'student-1', name: 'Sample Student', email: 'synthetic@example.com', role: 'student', verified: false };
  await page.goto(`${base}/student/map/`);
  await page.getByRole('heading', { name: 'Hand it to authorized campus staff' }).waitFor();
  await page.getByText(/approved drop-off directory is not connected/).waitFor();
  assert.equal(await page.getByRole('button', { name: /submit.*found/i }).count(), 0);
  assert.equal(await page.getByText('Staff tools are not available yet.', { exact: true }).count(), 0);
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  }
  checks++;
  if (process.env.STUDENT_SCREENSHOT_DIR) await page.getByRole('heading', { name: 'Hand it to authorized campus staff' }).locator('..').screenshot({ path: `${process.env.STUDENT_SCREENSHOT_DIR}/student-guidance-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Student navigation' }).getByRole('link', { name: 'My reports' }).click();
  await page.getByRole('heading', { name: 'My reports', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Open navigation', exact: true }).getAttribute('aria-expanded'), 'false');
  checks++;
  await page.goto(`${base}/student/report/`);
  await page.getByRole('heading', { name: 'Report a Lost Item', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /found|receive item/i }).count(), 0);
  checks++;
  assert.deepEqual(unexpected, []);
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ passed: checks, browserErrors: pageErrors, unexpectedApiRequests: unexpected, verification: 'Synthetic browser-intercepted API fixtures; not a live end-to-end service test.' }));
} finally { await browser.close(); }
