// REAL opt-in acceptance: no route interception, mocked DB or fake Blob upload.
// Uses a disposable configured server; NEVER imports or changes production code.
import test from 'node:test';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { browserEngine, browserOptions, prepareLostReport } from './helpers/student-browser.mjs';

const enabled = process.env.MAGPIE_LIVE_ACCEPTANCE === '1';
test('REAL services: student photo → private information response → staff pickup', {
  skip: !enabled && 'Opt-in only: set MAGPIE_LIVE_ACCEPTANCE=1 and acknowledge a disposable configured environment',
  timeout: 180000,
}, async t => {
  assert.equal(process.env.MAGPIE_DISPOSABLE_ENVIRONMENT, 'yes', 'Requires a disposable Neon branch/private Blob store and server; do not point at shared/production data');
  const base = process.env.MAGPIE_LIVE_BASE_URL;
  assert.ok(base && ['http:', 'https:'].includes(new URL(base).protocol), 'Set MAGPIE_LIVE_BASE_URL');
  assert.ok(process.env.ADMIN_DEMO_EMAIL && process.env.ADMIN_DEMO_PASSWORD, 'Provide staff credentials through the private test environment');
  const origin = new URL(base).origin;
  const browser = await browserEngine().launch(browserOptions());
  const student = await browser.newContext(), staff = await browser.newContext(), stranger = await browser.newContext(), guest = await browser.newContext();
  const run = randomUUID().slice(0, 8);
  const resources = { run, lost: null, found: [], zone: null };
  async function call(context, path, method = 'GET', data, expected = 200) {
    const response = await context.request.fetch(origin + path, { method, headers: { Origin: origin }, ...(data !== undefined ? { data } : {}) });
    assert.equal(response.status(), expected, `${method} ${path} returned ${response.status()}, expected ${expected}`);
    return response;
  }
  const json = async (...args) => (await call(...args)).json();
  let lost, match, secondMatch, claimId, secondClaimId, imageId, zoneId;
  const evidence = `Synthetic private engraving ${run}`;
  const samplePng = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#284e80' } }).png().toBuffer();
  const page = await student.newPage();
  async function step(name, optionsOrRun, maybeRun) {
    const options = typeof optionsOrRun === 'function' ? {} : optionsOrRun;
    const runStep = typeof optionsOrRun === 'function' ? optionsOrRun : maybeRun;
    let passed = false;
    await t.test(name, options, async () => { await runStep(); passed = true; });
    if (!options.skip && !passed) throw new Error(`Live acceptance stopped at: ${name}`);
  }
  try {
    await step('student and unrelated student sign in with real separate cookies', async () => {
      await call(student, '/api/session/', 'POST', { email: `magpie-demo-${run}@example.com`, name: 'Synthetic student' });
      await call(stranger, '/api/session/', 'POST', { email: `magpie-other-${run}@example.com`, name: 'Unrelated synthetic student' });
      assert.equal((await json(student, '/api/session/')).user.role, 'student');
      await call(student, '/api/admin/workspace/', 'GET', undefined, 401);
    });
    await step('real student wizard creates a lost report and uploads private PNG bytes', async () => {
      await prepareLostReport(page, origin, { name: `Synthetic earbuds ${run}`, brand: 'Apple', model: 'AirPods Pro', color: 'Black', evidence });
      await page.getByLabel('Upload photographs', { exact: true }).setInputFiles({ name: `synthetic-${run}.png`, mimeType: 'image/png', buffer: samplePng });
      await page.getByRole('button', { name: 'Submit report', exact: true }).click();
      await page.getByRole('heading', { name: 'Your lost report has been saved', exact: true }).waitFor({ timeout: 60000 });
      const snapshot = await json(student, '/api/workspace/');
      lost = snapshot.state.items.find(item => item.name === `Synthetic earbuds ${run}`);
      assert.ok(lost, 'Report must persist via the real server');
      resources.lost = lost.id;
      imageId = lost.imagePaths[0];
      assert.ok(imageId, 'An uploaded/bound image ID must persist');
      assert.ok(!JSON.stringify(snapshot).includes('blob.vercel-storage.com'));
      const photo = await call(student, `/api/images/${imageId}/`);
      assert.ok((await photo.body()).length > 0);
      await call(stranger, `/api/images/${imageId}/`, 'GET', undefined, 404);
      await call(guest, `/api/images/${imageId}/`, 'GET', undefined, 401);
      await call(student, `/api/images/${imageId}/?workspace=admin`, 'GET', undefined, 401);
    });
    await step('separate admin sign-in and configured-campus active intake fixture', async () => {
      await call(staff, '/api/admin/session/', 'POST', { email: process.env.ADMIN_DEMO_EMAIL, password: process.env.ADMIN_DEMO_PASSWORD });
      assert.equal((await json(staff, '/api/admin/session/')).user.role, 'admin');
      const workspace = await json(staff, '/api/admin/workspace/');
      assert.ok(workspace.buildings.length, 'Reviewed migrations and configured building seed are required');
      const building = workspace.buildings[0];
      zoneId = randomUUID(); resources.zone = zoneId;
      await call(staff, '/api/admin/dropoffs/', 'POST', { id: zoneId, name: `Synthetic desk ${run}`, buildingId: building.id, instructions: 'Synthetic staff-only handling note', studentVisible: true, publicInstructions: 'Synthetic public handover instructions', lat: Number(building.latitude), lng: Number(building.longitude), active: true });
    });
    const makeFound = async (changes = {}) => {
      const item = { ...lost, id: randomUUID(), type: 'found', dropoffZoneId: zoneId, receivedAt: new Date().toISOString(), custodyStatus: 'Received', staffNotes: 'Synthetic private storage note', ...changes };
      await call(staff, '/api/admin/reports/', 'POST', { item, privateDetail: `Private found marking ${run}`, imageIds: [] }, 201);
      resources.found.push(item.id);
      return item;
    };
    await step('staff intake and matching create eligible persisted pairs; student cannot submit FOUND', async () => {
      const first = await makeFound(), second = await makeFound();
      await call(student, '/api/reports/', 'POST', { item: { ...first, id: randomUUID() }, privateDetail: '', imageIds: [] }, 400);
      const state = (await json(student, '/api/workspace/')).state;
      match = state.matches.find(m => m.lostId === lost.id && m.foundId === first.id);
      secondMatch = state.matches.find(m => m.lostId === lost.id && m.foundId === second.id);
      assert.ok(match && secondMatch, 'Matching must persist compatible candidates');
      const staffState = await json(staff, '/api/admin/workspace/');
      assert.ok(staffState.matches.some(m => m.id === match.id));
    });
    for (const [attribute, changes] of [['brand', { brand: 'Samsung', model: 'Galaxy Buds' }], ['model', { model: 'AirPods Max' }], ['color', { color: 'White' }]]) {
      await step(`hard ${attribute} contradiction rejected`, { skip: process.env.MAGPIE_MATCHING_ACCEPTANCE_READY !== '1' && 'Pending Developer 3 accepted normalization/contradiction contract and deployed matching migration' }, async () => {
        const contradictory = await makeFound(changes);
        const state = (await json(student, '/api/workspace/')).state;
        assert.ok(!state.matches.some(m => m.lostId === lost.id && m.foundId === contradictory.id && !m.dismissed));
      });
    }
    await step('published desks are student-safe and Gemini uses real private-photo cross-modal evidence before claims', async () => {
      const zones = await json(student, '/api/dropoffs/');
      const desk = zones.find(z => z.id === zoneId);
      assert.ok(desk && desk.description === 'Synthetic public handover instructions');
      assert.ok(!JSON.stringify(zones).includes('Synthetic staff-only handling note'));
      await call(student, '/api/admin/ai-matching/', 'POST', { lostId: lost.id, foundId: match.foundId, confirmSynthetic: true }, 401);
      const result = await json(staff, '/api/admin/ai-matching/', 'POST', { lostId: lost.id, foundId: match.foundId, confirmSynthetic: true });
      assert.equal(result.mode, 'gemini', 'Actual configured Gemini must contribute, not deterministic fallback');
      assert.ok(result.channels.includes('semantic'));
      assert.ok(result.channels.includes('image-to-text'), 'Real bound private Blob image must reach prepared-image provider path');
      assert.equal(result.applied, true);
      const workspace = await json(staff, '/api/admin/workspace/');
      const reasoning = workspace.matches.find(m => m.id === match.id).staff_reasoning;
      assert.equal(reasoning.ai.used, true);
      assert.equal(reasoning.ai.model, 'gemini-embedding-2');
      const owner = await json(student, '/api/workspace/');
      assert.ok(!JSON.stringify(owner).includes('staff_reasoning'));
      assert.ok(!JSON.stringify(owner).includes('gemini-embedding-2'));
    });
    await step('student submits claim; foreign claims/deletion denied and active recovery blocks deletion', async () => {
      await call(stranger, `/api/reports/${lost.id}/`, 'DELETE', undefined, 404);
      await call(stranger, '/api/claims/', 'POST', { matchId: match.id, answer: evidence }, 400);
      await call(student, '/api/claims/', 'POST', { matchId: match.id, answer: evidence }, 201);
      await call(student, '/api/claims/', 'POST', { matchId: secondMatch.id, answer: evidence }, 201);
      const state = (await json(student, '/api/workspace/')).state;
      claimId = state.claims.find(c => c.matchId === match.id).id;
      secondClaimId = state.claims.find(c => c.matchId === secondMatch.id).id;
      await call(student, `/api/reports/${lost.id}/`, 'DELETE', undefined, 409);
    });
    if (process.env.MAGPIE_PREPARE_VIDEO === '1') { console.log('Prepared synthetic video scenario at Pending; Gemini already measured.'); return; }
    await step('staff requests information; student responds privately through real UI; staff sees updated evidence', async () => {
      await call(staff, '/api/admin/actions/', 'POST', { action: 'reviewClaim', id: claimId, status: 'More information', message: `Describe the private hinge engraving ${run}` });
      await page.goto(`${origin}/student/updates/`);
      const card = page.locator(`#claim-${claimId}`);
      await card.getByRole('textbox', { name: 'Additional ownership evidence' }).fill(`${evidence}; hidden blue stitching under the hinge`);
      await card.getByRole('button', { name: 'Submit private response', exact: true }).click();
      await card.getByText('Your ownership information has been received and is awaiting staff review.', { exact: true }).waitFor();
      const workspace = await json(staff, '/api/admin/workspace/');
      assert.equal(workspace.claims.find(c => c.id === claimId).status, 'Pending');
      assert.ok(workspace.claims.find(c => c.id === claimId).answers.includes('hidden blue stitching'));
      const foreign = await json(stranger, '/api/workspace/');
      assert.ok(!JSON.stringify(foreign).includes(run));
    });
    await step('public search never reveals claim correspondence, identifying evidence or private image URLs', async () => {
      const rows = await json(guest, '/api/search/');
      for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ['id', 'type', 'category', 'location', 'date', 'status'].sort());
      const text = JSON.stringify(rows);
      for (const secret of [evidence, 'hidden blue stitching', 'blob.vercel-storage.com', '/api/images/', 'Synthetic private storage']) assert.ok(!text.includes(secret));
    });
    await step('approval delivers private pickup instructions; single redemption returns both reports', async () => {
      await call(staff, '/api/admin/actions/', 'POST', { action: 'reviewClaim', id: claimId, status: 'Approved', zoneId, message: 'Collect with university identity at the synthetic desk' });
      const approved = (await json(student, '/api/workspace/')).state.claims.find(c => c.id === claimId);
      assert.ok(approved.code && approved.pickupLocation);
      // Scoped test-clock setup in the explicitly authorized disposable database.
      // All renewal/redemption and access decisions still run through real APIs.
      if (process.env.MAGPIE_TEST_PICKUP_EXPIRY === '1') {
        const { createHash } = await import('node:crypto');
        const target = new URL(process.env.DATABASE_URL);
        assert.equal(createHash('sha256').update(target.hostname + target.pathname).digest('hex').slice(0, 12), process.env.MAGPIE_LIVE_TARGET_FINGERPRINT);
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        const expired = await sql.query("update pickups set expires_at=now()-interval '1 second' where claim_id=$1 and used_at is null returning id", [claimId]);
        assert.equal(expired.length, 1);
        await call(staff, '/api/admin/actions/', 'POST', { action: 'pickup', code: approved.code }, 400);
        await call(staff, '/api/admin/actions/', 'POST', { action: 'reissuePickup', id: expired[0].id, zoneId });
        const renewed = (await json(student, '/api/workspace/')).state.claims.find(c => c.id === claimId);
        assert.ok(renewed.code && renewed.code !== approved.code);
        await call(staff, '/api/admin/actions/', 'POST', { action: 'pickup', code: approved.code }, 400);
        approved.code = renewed.code;
      }
      await call(staff, '/api/admin/actions/', 'POST', { action: 'pickup', code: approved.code });
      await call(staff, '/api/admin/actions/', 'POST', { action: 'pickup', code: approved.code }, 400);
      const workspace = await json(staff, '/api/admin/workspace/');
      for (const reportId of [lost.id, match.foundId]) assert.equal(workspace.reports.find(r => r.id === reportId).status, 'Returned');
      assert.equal((await json(student, '/api/workspace/')).state.claims.find(c => c.id === claimId).code, null);
    });
    await step('competing pending claim cannot reopen Returned', { skip: process.env.MAGPIE_RECOVERY_ACCEPTANCE_READY !== '1' && 'Pending reviewed/deployed migration 004; never assert baseline 003 is safe' }, async () => {
      await call(staff, '/api/admin/actions/', 'POST', { action: 'reviewClaim', id: secondClaimId, status: 'Approved', zoneId, message: 'Stale synthetic decision' }, 400);
      assert.equal((await json(student, '/api/workspace/')).state.items.find(r => r.id === lost.id).status, 'Returned');
    });
  } finally {
    // Returned/active data must not bypass production deletion guards. Dispose the
    // entire dedicated test DB/store after review; resource IDs aid scoped review.
    console.log('Disposable synthetic resource IDs (no credentials/pass codes):', JSON.stringify(resources));
    await browser.close();
  }
});
