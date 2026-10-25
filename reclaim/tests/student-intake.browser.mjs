// SYNTHETIC browser acceptance. API responses are intercepted; no real services.
import assert from 'node:assert/strict';
import { browserEngine, browserOptions, prepareLostReport, samplePng } from './helpers/student-browser.mjs';
const base = process.env.MAGPIE_STUDENT_TEST_URL;
if (!base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use an isolated loopback production server.');
const browser = await browserEngine().launch(browserOptions());
let checks = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [], unexpected = [], reports = [];
  let failures = 0, deletionConflict = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    // External Maps SDK is outside synthetic application API fixtures.
    if (new URL(request.url()).origin !== new URL(base).origin) return route.abort();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/session/') return json({ user: { id: 'student-1', email: 'synthetic@example.com', name: 'Sample Student', role: 'student', verified: false } });
    if (path === '/api/workspace/') return json({ state: { items: reports.map(x => ({ ...x.item, reporterId: 'student-1', image: '', imagePaths: [], status: 'Matching' })), privateDetails: {}, matches: [], claims: [], notices: [] }, messages: [] });
    if (path === '/api/reports/' && request.method() === 'POST') {
      if (failures++ === 0) return json({ error: 'Synthetic report service outage' }, 503);
      const data = request.postDataJSON();
      assert.equal(data.item.type, 'lost');
      reports.push(data);
      return json({ id: data.item.id }, 201);
    }
    if (path.startsWith('/api/reports/') && request.method() === 'DELETE') {
      if (deletionConflict) return json({ error: 'This report has an active recovery.' }, 409);
      reports.splice(reports.findIndex(x => path.includes(x.item.id)), 1);
      return json({ deleted: true, cleanupPending: false });
    }
    if (path === '/api/dropoffs/') return json([]);
    if (path === '/api/search/') return json([{ id: 'public-found', type: 'found', category: 'Electronics', location: 'Sample Library', date: '2026-10-23', status: 'Secured' }]);
    unexpected.push(`${request.method()} ${path}`);
    return json({ error: 'Unexpected synthetic test request' }, 500);
  });
  await prepareLostReport(page, base);
  const file = page.getByLabel('Upload photographs', { exact: true });
  await file.setInputFiles({ name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic') });
  await page.getByRole('alert').filter({ hasText: /JPG|supported|image/i }).waitFor();
  checks++;
  await file.setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(25 * 1024 * 1024 + 1) });
  await page.getByRole('alert').filter({ hasText: /25 MB/ }).waitFor();
  checks++;
  await file.setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: samplePng });
  await page.getByRole('button', { name: 'Remove photograph 1' }).waitFor();
  // Selection/preview validation only. This fixture never fakes a Blob upload.
  await page.getByRole('button', { name: 'Remove photograph 1' }).click();
  assert.equal(await page.getByRole('button', { name: 'Remove photograph 1' }).count(), 0);
  checks++;
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await page.getByText('Synthetic report service outage', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await page.getByRole('heading', { name: 'Your lost report has been saved', exact: true }).waitFor();
  assert.equal(reports[0].item.locationKnown, false);
  assert.equal(reports[0].item.buildingId, null);
  assert.equal(reports[0].item.lat, null);
  assert.equal(reports[0].item.type, 'lost');
  assert.deepEqual(reports[0].imageIds, []);
  checks++;
  await prepareLostReport(page, base, { name: 'Optional location sample', unknown: false });
  await page.getByRole('button', { name: 'Submit report', exact: true }).click();
  await page.getByRole('heading', { name: 'Your lost report has been saved', exact: true }).waitFor();
  assert.equal(reports[1].item.locationKnown, false);
  checks++;
  await page.goto(`${base}/student/reports/`);
  await page.getByRole('button', { name: /^Synthetic earbuds/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete Report', exact: true }).click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await dialog.count(), 1, 'Escape cancels deletion without closing the report');
  assert.equal(await dialog.getByRole('group', { name: 'Delete this report?' }).count(), 0);
  checks++;
  await dialog.getByRole('button', { name: 'Delete Report', exact: true }).click();
  deletionConflict = true;
  await dialog.getByRole('group', { name: 'Delete this report?' }).getByRole('button', { name: 'Delete Report', exact: true }).click();
  await dialog.getByText('This report has an active recovery.', { exact: true }).waitFor();
  assert.equal(reports.length, 2);
  checks++;
  deletionConflict = false;
  await dialog.getByRole('group', { name: 'Delete this report?' }).getByRole('button', { name: 'Delete Report', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(reports.length, 1);
  checks++;
  await page.goto(`${base}/student/search/`);
  await page.locator('.public-card').getByText('Sample Library', { exact: true }).waitFor();
  assert.equal(await page.locator('img[src*="/api/images/"]').count(), 0);
  assert.ok(!(await page.locator('main').innerText()).includes('hidden blue stitch'));
  checks++;
  const nav = page.getByRole('navigation', { name: 'Student navigation' });
  for (const [route, label] of [['overview', 'Overview'], ['search', 'Search'], ['map', 'Campus map'], ['reports', 'My reports'], ['updates', 'Magpie Updates']]) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await page.waitForURL(`${base}/student/${route}/`);
    await page.getByRole('heading', { level: 1 }).waitFor();
  }
  checks++;
  assert.deepEqual(unexpected, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: checks, failed: 0, pageErrors: errors, evidence: 'Synthetic intercepted APIs; image selection/validation only, no live Blob upload.' }));
} finally { await browser.close(); }
