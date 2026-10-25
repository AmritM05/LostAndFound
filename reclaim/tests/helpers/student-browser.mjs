import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function browserEngine() {
  return require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright').chromium;
}
export const browserOptions = () => ({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
export const samplePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=', 'base64');
export async function prepareLostReport(page, base, { name = 'Synthetic earbuds', brand = 'Sample', model = 'Sample One', color = 'Black', unknown = true, description = 'Synthetic case with a hidden blue stitch', evidence = 'Synthetic engraving under the hinge' } = {}) {
  await page.goto(`${base}/student/report/`);
  await page.getByRole('heading', { name: 'Start a report', exact: true }).waitFor();
  await page.getByLabel(/Item category/).selectOption('Electronics');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel(/Device type/).fill(name);
  await page.getByLabel(/Brand/).fill(brand);
  await page.getByLabel(/Model/).fill(model);
  await page.getByLabel(/General color/).fill(color);
  await page.getByLabel(/Private description/).fill(description);
  await page.getByLabel(/Ownership details/).fill(evidence);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  if (unknown) await page.getByRole('checkbox', { name: "I don't know where I lost this item" }).check();
  // Leaving building/map blank is independently supported when unknown=false.
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Add private photos & review', exact: true }).waitFor();
}
