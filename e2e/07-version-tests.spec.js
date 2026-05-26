/**
 * E2E tests for example/src/07-version-tests components.
 *
 * Tests:
 * - test-bug-fix-v14: verifies that parameterless functions work in templates (BUG-0001 fix)
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('07-version-tests'));
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
  await page.waitForSelector('test-bug-fix-v14');

  expect(errors).toEqual([]);
});

// ── test-bug-fix-v14 ──────────────────────────────────────────────────

test.describe('test-bug-fix-v14', () => {
  test('renders initial count as 0 via signal', async ({ page }) => {
    await page.goto(url);
    // First result-item shows signal value
    const signalValue = page.locator('test-bug-fix-v14 .result-item').nth(0).locator('.value');
    await expect(signalValue).toHaveText('0');
  });

  test('renders initial count as 0 via function call getCount()', async ({ page }) => {
    await page.goto(url);
    // Second result-item shows function return value
    const funcValue = page.locator('test-bug-fix-v14 .result-item').nth(1).locator('.value');
    await expect(funcValue).toHaveText('0');
  });

  test('increment updates both signal and function display', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-bug-fix-v14 button', { hasText: '+1' }).click();

    const signalValue = page.locator('test-bug-fix-v14 .result-item').nth(0).locator('.value');
    const funcValue = page.locator('test-bug-fix-v14 .result-item').nth(1).locator('.value');

    await expect(signalValue).toHaveText('1');
    await expect(funcValue).toHaveText('1');
  });

  test('decrement updates both signal and function display', async ({ page }) => {
    await page.goto(url);
    // Start at 0, decrement to -1
    await page.locator('test-bug-fix-v14 button', { hasText: '-1' }).click();

    const signalValue = page.locator('test-bug-fix-v14 .result-item').nth(0).locator('.value');
    const funcValue = page.locator('test-bug-fix-v14 .result-item').nth(1).locator('.value');

    await expect(signalValue).toHaveText('-1');
    await expect(funcValue).toHaveText('-1');
  });

  test('signal and function values always match', async ({ page }) => {
    await page.goto(url);
    // Perform multiple operations
    await page.locator('test-bug-fix-v14 button', { hasText: '+1' }).click();
    await page.locator('test-bug-fix-v14 button', { hasText: '+1' }).click();
    await page.locator('test-bug-fix-v14 button', { hasText: '+1' }).click();
    await page.locator('test-bug-fix-v14 button', { hasText: '-1' }).click();

    const signalValue = await page.locator('test-bug-fix-v14 .result-item').nth(0).locator('.value').textContent();
    const funcValue = await page.locator('test-bug-fix-v14 .result-item').nth(1).locator('.value').textContent();

    expect(signalValue).toBe(funcValue);
    expect(signalValue).toBe('2');
  });
});
