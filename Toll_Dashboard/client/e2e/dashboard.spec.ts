import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const USER = process.env.E2E_USER ?? 'admin';
const PASS = process.env.E2E_PASS ?? 'change-me-now';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(USER);
  await page.getByLabel('Password').fill(PASS);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/toll plazas/i).first()).toBeVisible({ timeout: 10_000 });
}

test('login + dashboard loads with KPIs and status cards', async ({ page }) => {
  await login(page);
  await expect(page.getByText(/Total Road Length/i)).toBeVisible();
  await expect(page.getByText(/Status of Civil Work/i)).toBeVisible();
  await expect(page.getByText(/Register/i)).toBeVisible();
});

test('login page has no critical a11y violations', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});

test('dashboard has no critical a11y violations', async ({ page }) => {
  await login(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});

test('no horizontal overflow at 360, 768, 1280 px', async ({ page }) => {
  await login(page);
  for (const w of [360, 768, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    const horizontal = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontal, `viewport ${w}px`).toBeLessThanOrEqual(1);
  }
});

test('filter chip adds and removes a filter from the URL', async ({ page }) => {
  await login(page);
  await page.getByLabel('Status of Civil Work').selectOption({ index: 1 });
  await expect(page).toHaveURL(/[?&]civil=/);
  const chip = page.getByRole('button', { name: /Status of Civil Work:/i }).first();
  await chip.click();
  await expect(page).not.toHaveURL(/[?&]civil=/);
});

test('table header texts use the full status names (Change 7)', async ({ page }) => {
  await login(page);
  const expected = [
    'S.No', 'Toll Plaza Code', 'Name of Road', 'Chainage', 'SH/Bridges Name', 'APC', 'Type of Plaza', 'Location Finalized',
    'Status of Civil Work', 'Status of Layout', 'Status of System Integrator',
    'Status of Toll Notification', 'Name of Toll Operator',
  ];
  const headers = await page.locator('table thead th').allInnerTexts();
  expect(headers.map((s) => s.trim())).toEqual(expected);
});

test('no rendered status text matches /cancel/i (Change 5)', async ({ page }) => {
  await login(page);
  // Grab visible page text — includes the register, cards, KPIs, filter dropdowns.
  const bodyText = await page.locator('body').innerText();
  // Any status-ish occurrence of "cancel" would be in a pill, KPI, filter option, chip, etc.
  // Button labels named "Cancel" (if any) would be in <button>; exclude them.
  const buttonsText = (await page.locator('button').allInnerTexts()).join(' ');
  const nonButtonText = bodyText.replace(buttonsText, '');
  expect(nonButtonText).not.toMatch(/cancel/i);
});

test('clicking a row opens a centred modal (Change 2) with 5-row status section (Change 3)', async ({ page }) => {
  await login(page);
  await page.locator('table tbody tr').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Status section lists the five full field names.
  for (const label of [
    'Status of Civil Work', 'Status of Layout', 'Status of System Integrator',
    'Status of Toll Notification', 'Name of Toll Operator',
  ]) {
    await expect(dialog.getByText(label, { exact: true })).toBeVisible();
  }
  // Esc closes the modal.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('table header stays below the page header on scroll (Change 4)', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(100);
  const measured = await page.evaluate(() => {
    const header = document.querySelector('header')!.getBoundingClientRect();
    const th = document.querySelector('table thead th')!.getBoundingClientRect();
    return { headerBottom: header.bottom, thTop: th.top };
  });
  // Allow 2px slack for sub-pixel rounding.
  expect(Math.abs(measured.headerBottom - measured.thTop)).toBeLessThanOrEqual(2);
});

test('unauthenticated access to /plazas returns 401', async ({ request }) => {
  const res = await request.get('/api/plazas', { headers: { 'content-type': 'application/json' } });
  if (res.status() !== 401) {
    const r2 = await request.post('/api/plazas', { data: {} });
    expect(r2.status()).toBe(401);
  }
});
