/**
 * E2E tests for example/src/08-v15-tests components.
 *
 * Tests:
 * - test-no-collision: verifies signals and functions with different names don't collide
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('08-v15-tests'));
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
  await page.waitForSelector('test-no-collision');

  expect(errors).toEqual([]);
});

// ── test-no-collision ─────────────────────────────────────────────────

test.describe('test-no-collision', () => {
  test('renders signal value "Hello"', async ({ page }) => {
    await page.goto(url);
    const result = page.locator('test-no-collision .result');
    await expect(result).toContainText('Signal value: Hello');
  });

  test('renders function return value "Hi from function"', async ({ page }) => {
    await page.goto(url);
    const result = page.locator('test-no-collision .result');
    await expect(result).toContainText('Function call: Hi from function');
  });

  test('update button changes signal value to "Updated Hello"', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-no-collision button', { hasText: 'Update Signal' }).click();

    const result = page.locator('test-no-collision .result');
    await expect(result).toContainText('Signal value: Updated Hello');
  });

  test('function return value remains unchanged after signal update', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-no-collision button', { hasText: 'Update Signal' }).click();

    const result = page.locator('test-no-collision .result');
    // Function always returns 'Hi from function' regardless of signal state
    await expect(result).toContainText('Function call: Hi from function');
  });
});
