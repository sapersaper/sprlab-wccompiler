/**
 * E2E tests for example/src/11-ternary-tests components.
 *
 * Tests:
 * - test-ternary-operator: ternary operator handling in templates
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('11-ternary-tests'));
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
  await page.waitForSelector('test-ternary-operator');

  expect(errors).toEqual([]);
});

// ── test-ternary-operator ─────────────────────────────────────────────

test.describe('test-ternary-operator', () => {
  test('simple ternary shows INACTIVE initially, toggles to ACTIVE', async ({ page }) => {
    await page.goto(url);
    // Test 1: isActive starts as false → shows INACTIVE
    const section = page.locator('test-ternary-operator .test-section').nth(0);
    await expect(section).toContainText('INACTIVE');

    // Toggle to active
    await section.locator('button', { hasText: 'Toggle Status' }).click();
    await expect(section).toContainText('ACTIVE');
  });

  test('ternary with numbers shows Positive for count > 0', async ({ page }) => {
    await page.goto(url);
    // Test 2: count starts at 5 → shows "Positive"
    const section = page.locator('test-ternary-operator .test-section').nth(1);
    await expect(section).toContainText('Positive');
  });

  test('ternary in :class applies light-theme class initially, toggles to dark-theme', async ({ page }) => {
    await page.goto(url);
    // Test 3: theme starts as 'light' → light-theme class
    const section = page.locator('test-ternary-operator .test-section').nth(2);
    const themeDiv = section.locator('[class*="theme"]');
    await expect(themeDiv).toHaveClass(/light-theme/);

    // Toggle theme
    await section.locator('button', { hasText: 'Toggle Theme' }).click();
    await expect(themeDiv).toHaveClass(/dark-theme/);
    await expect(themeDiv).not.toHaveClass(/light-theme/);
  });

  test('ternary in :disabled enables button when hasPermission is true', async ({ page }) => {
    await page.goto(url);
    // Test 4: hasPermission starts as true → button should be enabled
    const section = page.locator('test-ternary-operator .test-section').nth(3);
    const actionBtn = section.locator('button', { hasText: 'Action Button' });
    await expect(actionBtn).toBeEnabled();

    // Toggle permission off → button should be disabled
    await section.locator('button', { hasText: 'Toggle Permission' }).click();
    await expect(actionBtn).toBeDisabled();
  });

  test('nested ternary shows Administrator for admin role, Regular User after toggle', async ({ page }) => {
    await page.goto(url);
    // Test 5: role starts as 'admin' → shows "Administrator"
    const section = page.locator('test-ternary-operator .test-section').nth(4);
    await expect(section).toContainText('Administrator');

    // Toggle role to 'user'
    await section.locator('button', { hasText: 'Toggle Role' }).click();
    await expect(section).toContainText('Regular User');
  });
});
