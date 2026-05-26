/**
 * E2E tests for example/src/09-v16-tests components.
 *
 * Tests:
 * - test-batch-auto-detect: batch() auto-detection and effect execution count
 * - test-no-batch: simple component without batch usage (tree-shaking)
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('09-v16-tests'));
});

test.afterAll(async () => {
  await cleanup();
});

// ── No console errors ─────────────────────────────────────────────────

test('page loads without console errors', async ({ page }) => {
  test.fail(true, 'BUG: test-batch-auto-detect has infinite effect loop (effectRunCount.set inside effect)');
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(url);
  await page.waitForSelector('test-batch-auto-detect');
  await page.waitForSelector('test-no-batch');

  expect(errors).toEqual([]);
});

// ── test-batch-auto-detect ────────────────────────────────────────────

test.describe('test-batch-auto-detect', () => {
  test('renders initial empty state', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-batch-auto-detect');
    await expect(el).toBeAttached();
    // Initial signal values should be empty
    await expect(el).toContainText('firstName:');
    await expect(el).toContainText('lastName:');
    await expect(el).toContainText('age: 0');
  });

  test('"Sin Batch" button causes effect count > 1', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-batch-auto-detect button', { hasText: 'Sin Batch' }).click();

    const counter = page.locator('test-batch-auto-detect .counter');
    const countText = await counter.textContent();
    const count = parseInt(countText.trim());
    expect(count).toBeGreaterThan(1);
  });

  test('"Con Batch" button causes effect count = 1', async ({ page }) => {
    test.fail(true, 'BUG: effect with effectRunCount.set inside causes infinite loop');
    await page.goto(url);
    await page.locator('test-batch-auto-detect button', { hasText: 'Con Batch' }).click();

    const counter = page.locator('test-batch-auto-detect .counter');
    await expect(counter).toHaveText('1');
  });

  test('signal values update correctly with batch', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-batch-auto-detect button', { hasText: 'Con Batch' }).click();

    const el = page.locator('test-batch-auto-detect');
    await expect(el).toContainText('firstName: Jane');
    await expect(el).toContainText('lastName: Smith');
    await expect(el).toContainText('age: 25');
  });
});

// ── test-no-batch ─────────────────────────────────────────────────────

test.describe('test-no-batch', () => {
  test('renders component', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-no-batch');
    await expect(el).toBeAttached();
  });

  test('button shows count 0', async ({ page }) => {
    await page.goto(url);
    const button = page.locator('test-no-batch button');
    await expect(button).toHaveText('0');
  });

  test('clicking increments count', async ({ page }) => {
    await page.goto(url);
    const button = page.locator('test-no-batch button');
    await button.click();
    await expect(button).toHaveText('1');

    await button.click();
    await expect(button).toHaveText('2');
  });
});
