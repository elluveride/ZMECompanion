// The MVP spec's acceptance checks, in a real browser against the production build.
import { test, expect, type Page } from '@playwright/test';

const PAGES = ['del', 'gnd', 'twr', 'app', 'ctr', 'strip', 'library', 'issues'];

async function loadFdx123(page: Page, flow: 'north' | 'south') {
  await page.goto(`./#/del?apt=MEM&flow=${flow}&night=0`);
  await page.getByRole('button', { name: 'Example' }).click();
}

const clearance = (page: Page) => page.locator('section.clearance');

test('FDX123 KMEM→KATL on GOETZ7, North flow: 5,000, JAAXX, Departure East 124.150, PDC', async ({ page }) => {
  await loadFdx123(page, 'north');
  await expect(clearance(page)).toContainText('5,000');
  await expect(clearance(page)).toContainText('JAAXX');
  await expect(clearance(page)).toContainText('124.150');
  await expect(clearance(page)).toContainText('Memphis Departure');
  await expect(page.getByTestId('pdc-verdict')).toContainText('PDC');
});

test('same flight on South flow: RIBZZ, and TWR shows heading 165 off 18C', async ({ page }) => {
  await loadFdx123(page, 'south');
  await expect(clearance(page)).toContainText('RIBZZ');
  await page.goto('./#/twr?apt=MEM&flow=south');
  const takeoff = page.locator('section', { has: page.getByRole('heading', { name: 'Takeoff' }) });
  await expect(takeoff).toContainText('18C');
  await expect(takeoff).toContainText('165');
});

test('night-only SIDs are hidden with Night off and shown with Night on', async ({ page }) => {
  await page.goto('./#/del?apt=MEM&flow=north&night=0');
  await expect(page.locator('tr[data-sid="AUTMN6"]')).toHaveCount(0);
  await expect(page.locator('tr[data-sid="GOETZ7"]')).toHaveCount(1);
  await page.goto('./#/del?apt=MEM&flow=north&night=1');
  await expect(page.locator('tr[data-sid="AUTMN6"]')).toHaveCount(1);
  // The full reference table keeps them, marked unavailable when Night is off.
  await page.goto('./#/del?apt=MEM&flow=north&night=0&tab=ref');
  await expect(page.locator('tr[data-sid="AUTMN6"]')).toContainText('unavailable');
});

test('a C172 VFR departure triggers VOICE', async ({ page }) => {
  await page.goto('./#/del?apt=MEM&flow=north');
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByLabel('Callsign').fill('N172SP');
  await page.getByLabel('Type').fill('C172');
  await page.getByRole('button', { name: 'Prop', exact: true }).click();
  await page.getByRole('button', { name: 'VFR', exact: true }).click();
  await expect(page.getByTestId('pdc-verdict')).toContainText('VOICE');
});

test('every source tag opens a ZME file download URL or a named external document', async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(`./#/${p}?apt=MEM`);
    const hrefs = await page.locator('a.src').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs.length, `${p} has source tags`).toBeGreaterThan(0);
    for (const h of hrefs) expect(h).toMatch(/^https:\/\/(memphisartcc\.com\/files\/[0-9a-f-]{36}\/download|www\.faa\.gov\/)/);
  }
});

test('all seven spec discrepancies render with a warning badge', async ({ page }) => {
  await page.goto('./#/issues');
  for (const id of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']) await expect(page.locator(`[data-flag="${id}"]`)).toContainText(`⚠ ${id}`);
  // …and inline next to the values they affect.
  await page.goto('./#/del?apt=MEM&flow=north');
  await expect(page.locator('tr[data-sid="CHLDR5"] details.flag summary').first()).toHaveText('⚠ D4');
});

test('no horizontal page scroll on any page', async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(`./#/${p}?apt=MEM`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${p} overflows`).toBeLessThanOrEqual(0);
  }
});

test('works offline after first load', async ({ page, context }) => {
  await page.goto('./#/del?apt=MEM');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Clearance Delivery/ })).toBeVisible();
  await page.goto('./#/ctr?apt=MEM');
  await expect(page.getByRole('heading', { name: /Center/ })).toBeVisible();
  await context.setOffline(false);
});
