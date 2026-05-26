/**
 * E2E tests for example/src/12-edge-cases components.
 *
 * Tests:
 * - test-error-recovery: error handling and graceful recovery
 * - test-nested-loops: nested loop rendering with categories and items
 * - test-kitchen-sink: complex feature integration test
 * - test-large-dataset: performance with large datasets
 * - test-rapid-updates: reactivity under high-frequency state changes
 * - test-deep-nesting: deeply nested component structures
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('12-edge-cases'));
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
  await page.waitForSelector('test-error-recovery');
  await page.waitForSelector('test-nested-loops');
  await page.waitForSelector('test-kitchen-sink');
  await page.waitForSelector('test-large-dataset');
  await page.waitForSelector('test-rapid-updates');
  await page.waitForSelector('test-deep-nesting');

  expect(errors).toEqual([]);
});

// ── test-error-recovery ───────────────────────────────────────────────

test.describe('test-error-recovery', () => {
  test('renders component', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-error-recovery');
    await expect(el).toBeAttached();
  });

  test('error count starts at 0', async ({ page }) => {
    await page.goto(url);
    const errorStat = page.locator('test-error-recovery .stat-box').nth(0).locator('.stat-value');
    await expect(errorStat).toHaveText('0');
  });

  test('throwing event handler increments error count', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-error-recovery button.danger', { hasText: 'Trigger Exception' }).click();

    const errorStat = page.locator('test-error-recovery .stat-box').nth(0).locator('.stat-value');
    await expect(errorStat).toHaveText('1');
  });

  test('items list renders 3 items initially', async ({ page }) => {
    await page.goto(url);
    const items = page.locator('test-error-recovery .item-card');
    await expect(items).toHaveCount(3);
  });

  test('add item works', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-error-recovery button.success', { hasText: 'Add Item' }).click();

    const items = page.locator('test-error-recovery .item-card');
    await expect(items).toHaveCount(4);
  });

  test('clear all items works', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-error-recovery button.danger', { hasText: 'Clear All Items' }).click();

    const items = page.locator('test-error-recovery .item-card');
    await expect(items).toHaveCount(0);
  });
});

// ── test-nested-loops ─────────────────────────────────────────────────

test.describe('test-nested-loops', () => {
  test('renders 3 categories', async ({ page }) => {
    await page.goto(url);
    const categories = page.locator('test-nested-loops .category');
    await expect(categories).toHaveCount(3);
  });

  test('clicking category header expands it showing items', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-nested-loops .category-header').first().click();
    const itemsContainer = page.locator('test-nested-loops .items-container').first();
    await expect(itemsContainer).toBeVisible();
    const items = itemsContainer.locator('.item-row');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('items display name and price', async ({ page }) => {
    test.fail(true, 'BUG-0011: text binding path collision in nested loops - item.name not rendered');
    await page.goto(url);
    await page.locator('test-nested-loops .category-header').first().click();
    const firstItem = page.locator('test-nested-loops .items-container').first().locator('.item-row').first();
    await expect(firstItem).toContainText('Laptop');
    await expect(firstItem).toContainText('$');
  });

  test('add category button works', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-nested-loops button.primary', { hasText: 'Add New Category' }).click();
    const categories = page.locator('test-nested-loops .category');
    await expect(categories).toHaveCount(4);
  });
});

// ── test-kitchen-sink ─────────────────────────────────────────────────

test.describe('test-kitchen-sink', () => {
  test('renders with initial 3 items', async ({ page }) => {
    await page.goto(url);
    const totalStat = page.locator('test-kitchen-sink .stat-box').nth(0).locator('p');
    await expect(totalStat).toContainText('3');
  });

  test('add item button works', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-kitchen-sink button.btn-success', { hasText: 'Add Item' }).click();
    const totalStat = page.locator('test-kitchen-sink .stat-box').nth(0).locator('p');
    await expect(totalStat).toContainText('4');
  });

  test('toggle button changes item active state', async ({ page }) => {
    await page.goto(url);
    const toggleBtn = page.locator('test-kitchen-sink .item-actions button.btn-primary').first();
    await toggleBtn.click();
    const toggleStat = page.locator('test-kitchen-sink .stat-box').nth(2).locator('p');
    await expect(toggleStat).toContainText('1');
  });

  test('stats update reactively', async ({ page }) => {
    await page.goto(url);
    const activeStat = page.locator('test-kitchen-sink .stat-box').nth(1).locator('p');
    await expect(activeStat).toContainText('2');
    const toggleBtn = page.locator('test-kitchen-sink .item-actions button.btn-primary').first();
    await toggleBtn.click();
    await expect(activeStat).toContainText('1');
  });
});

// ── test-large-dataset ────────────────────────────────────────────────

test.describe('test-large-dataset', () => {
  test('renders component', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-large-dataset');
    await expect(el).toBeAttached();
  });

  test('generate 100 items button populates list', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-large-dataset button.primary', { hasText: 'Generate 100 Items' }).click();

    // Total items stat should show 100
    const totalStat = page.locator('test-large-dataset .perf-stat').nth(0).locator('.perf-value');
    await expect(totalStat).toHaveText('100');
  });

  test('search filters items', async ({ page }) => {
    await page.goto(url);
    // Generate items first
    await page.locator('test-large-dataset button.primary', { hasText: 'Generate 100 Items' }).click();

    // Type in search box
    const searchBox = page.locator('test-large-dataset .search-box');
    await searchBox.fill('Item 1');

    // Filtered count should be less than 100
    const filteredStat = page.locator('test-large-dataset .perf-stat').nth(1).locator('.perf-value');
    const filteredText = await filteredStat.textContent();
    const filteredCount = parseInt(filteredText.trim());
    expect(filteredCount).toBeLessThan(100);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test('select all selects visible items', async ({ page }) => {
    await page.goto(url);
    // Generate items first
    await page.locator('test-large-dataset button.primary', { hasText: 'Generate 100 Items' }).click();

    // Click select all
    await page.locator('test-large-dataset button.success', { hasText: 'Select All Visible' }).click();

    // Selected count should equal total items
    const selectedStat = page.locator('test-large-dataset .perf-stat').nth(2).locator('.perf-value');
    await expect(selectedStat).toHaveText('100');
  });
});

// ── test-rapid-updates ────────────────────────────────────────────────

test.describe('test-rapid-updates', () => {
  test('renders component', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-rapid-updates');
    await expect(el).toBeAttached();
  });

  test('counter starts at 0', async ({ page }) => {
    await page.goto(url);
    const counterStat = page.locator('test-rapid-updates .stat-card').nth(2).locator('.stat-value');
    await expect(counterStat).toHaveText('0');
  });

  test('rapid counter button triggers updates (counter > 0 after completion)', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-rapid-updates button.btn-counter', { hasText: 'Counter' }).click();

    // Wait for rapid updates to complete (50 updates × 40ms = ~2s)
    await page.waitForTimeout(2500);

    const counterStat = page.locator('test-rapid-updates .stat-card').nth(2).locator('.stat-value');
    const counterText = await counterStat.textContent();
    const counterValue = parseInt(counterText.trim());
    expect(counterValue).toBeGreaterThan(0);
  });

  test('reset button resets state', async ({ page }) => {
    await page.goto(url);
    // Trigger some updates first
    await page.locator('test-rapid-updates button.btn-counter', { hasText: 'Counter' }).click();
    await page.waitForTimeout(2500);

    // Reset
    await page.locator('test-rapid-updates button.btn-reset', { hasText: 'Reset All State' }).click();

    const counterStat = page.locator('test-rapid-updates .stat-card').nth(2).locator('.stat-value');
    await expect(counterStat).toHaveText('0');
  });
});

// ── test-deep-nesting ─────────────────────────────────────────────────

test.describe('test-deep-nesting', () => {
  test('renders component', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-deep-nesting');
    await expect(el).toBeAttached();
  });

  test('level 1 items visible', async ({ page }) => {
    await page.goto(url);
    const items = page.locator('test-deep-nesting .item-card');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('expand button shows level 2 content', async ({ page }) => {
    await page.goto(url);
    const expandBtn = page.locator('test-deep-nesting button.btn-toggle', { hasText: 'Expand' }).first();
    await expandBtn.click();
    // Wait a moment for the conditional to render
    await page.waitForTimeout(500);
    const level2 = page.locator('test-deep-nesting .level-2-container');
    const count = await level2.count();
    expect(count).toBeGreaterThan(0);
  });
});
