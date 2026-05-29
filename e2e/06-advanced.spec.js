/**
 * E2E tests for example/src/06-advanced components.
 *
 * Tests:
 * - test-dynamic-component: dynamic component rendering with <component :is="expr">
 * - test-dynamic-comprehensive: extensive dynamic component testing
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('06-advanced'));
});

test.afterAll(async () => {
  await cleanup();
});

// ── No console errors ─────────────────────────────────────────────────

test('page loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(url);
  await page.waitForSelector('test-dynamic-component');
  await page.waitForSelector('test-dynamic-comprehensive');

  expect(errors).toEqual([]);
});

// ── test-dynamic-component ────────────────────────────────────────────

test.describe('test-dynamic-component', () => {
  test('renders initial component (view-a)', async ({ page }) => {
    await page.goto(url);
    const container = page.locator('test-dynamic-component .attempt-2');
    // The initial component should be comp-a
    await expect(container.locator('comp-a')).toBeAttached();
  });

  test('shows current component name', async ({ page }) => {
    await page.goto(url);
    const status = page.locator('test-dynamic-component .status p');
    await expect(status).toContainText('comp-a');
  });

  test('switches to comp-b on button click', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-dynamic-component button', { hasText: 'Render Component B' }).click();

    const status = page.locator('test-dynamic-component .status p');
    await expect(status).toContainText('comp-b');

    const container = page.locator('test-dynamic-component .attempt-2');
    await expect(container.locator('comp-b')).toBeAttached();
  });

  test('switches to comp-c on button click', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-dynamic-component button', { hasText: 'Render Component C' }).click();

    const status = page.locator('test-dynamic-component .status p');
    await expect(status).toContainText('comp-c');

    const container = page.locator('test-dynamic-component .attempt-2');
    await expect(container.locator('comp-c')).toBeAttached();
  });
});

// ── test-dynamic-comprehensive ────────────────────────────────────────

test.describe('test-dynamic-comprehensive', () => {
  test('renders component', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-dynamic-comprehensive');
    await expect(el).toBeAttached();
  });

  test('shows initial view (view-a)', async ({ page }) => {
    await page.goto(url);
    const currentView = page.locator('test-dynamic-comprehensive .test-section').first().locator('p strong');
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('view-a');
  });

  test('switches views', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-dynamic-comprehensive button', { hasText: 'View B' }).click();
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('view-b');

    await page.locator('test-dynamic-comprehensive button', { hasText: 'View C' }).click();
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('view-c');
  });

  test('prop forwarding works (increment count button updates)', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('Count: 0');
    await page.locator('test-dynamic-comprehensive button', { hasText: 'Increment Count' }).click();
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('Count: 1');
  });

  test('falsy expression removes component', async ({ page }) => {
    await page.goto(url);
    // Set falsy value
    await page.locator('test-dynamic-comprehensive button', { hasText: "Set Falsy ('')" }).click();

    // The current view text should show empty
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('(empty)');
  });

  test('Test 9: expresiones complejas — toggle admin switches component via computed', async ({ page }) => {
    await page.goto(url);

    // Initial: isAdmin=false → routeComponent()='user-panel'
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('user-panel');

    // Click Toggle Admin
    await page.locator('test-dynamic-comprehensive button', { hasText: 'Toggle Admin' }).click();
    await page.waitForTimeout(300);

    // Now isAdmin=true → routeComponent()='admin-panel'
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('admin-panel');

    // Click again → back to user-panel
    await page.locator('test-dynamic-comprehensive button', { hasText: 'Toggle Admin' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('test-dynamic-comprehensive')).toContainText('user-panel');
  });
});
