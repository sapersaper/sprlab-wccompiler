/**
 * E2E tests for example/src/10-class-tests components.
 *
 * Tests:
 * - test-class-binding: dynamic class binding with :class directive
 * - test-class-directive: class directive string literal transformation
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('10-class-tests'));
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
  await page.waitForSelector('test-class-binding');
  await page.waitForSelector('test-class-directive');
  await page.waitForSelector('test-static-class-preservation');

  expect(errors).toEqual([]);
});

// ── test-class-binding ────────────────────────────────────────────────

test.describe('test-class-binding', () => {
  test('boolean class toggles on click (active class appears/disappears)', async ({ page }) => {
    await page.goto(url);
    const btn = page.locator('test-class-binding .test-section').nth(0).locator('button.btn');

    // Initially isActive is false, so no 'active' class
    await expect(btn).not.toHaveClass(/\bactive\b/);

    // Click to toggle active
    await btn.click();
    await expect(btn).toHaveClass(/\bactive\b/);

    // Click again to toggle off
    await btn.click();
    await expect(btn).not.toHaveClass(/\bactive\b/);
  });

  test('dynamic string class applies theme', async ({ page }) => {
    await page.goto(url);
    // Test 2: theme-box has static class, dynamic :class adds 'light' or 'dark'
    const section = page.locator('test-class-binding .test-section').nth(1);
    const themeBox = section.locator('div').first();

    // Initially theme is 'light' — check text content instead of class
    await expect(section).toContainText('Theme: light');

    // Click to toggle to 'dark'
    await themeBox.click();
    await expect(section).toContainText('Theme: dark');
  });

  test('object syntax applies multiple conditional classes', async ({ page }) => {
    await page.goto(url);
    const statusBox = page.locator('test-class-binding .status-box');

    // Initially: hasError=false, size='medium' → should have 'success' class
    await expect(statusBox).toHaveClass(/\bsuccess\b/);

    // Toggle error
    await page.locator('test-class-binding .test-section').nth(2).locator('button', { hasText: 'Toggle Error' }).click();
    await expect(statusBox).toHaveClass(/\berror\b/);
    await expect(statusBox).not.toHaveClass(/\bsuccess\b/);
  });

  test('array syntax applies multiple classes', async ({ page }) => {
    await page.goto(url);
    // Test 4: Array syntax — verify text content shows the class names
    const section = page.locator('test-class-binding .test-section').nth(3);
    await expect(section).toContainText('my-custom-class');
    await expect(section).toContainText('medium');
  });
});

// ── test-class-directive ──────────────────────────────────────────────

test.describe('test-class-directive', () => {
  test('boolean class binding works', async ({ page }) => {
    await page.goto(url);
    // Test 1: Boolean class binding - isActive starts as true
    const demoBox = page.locator('test-class-directive .test-section').nth(0).locator('.demo-box');
    await expect(demoBox).toHaveClass(/\bactive\b/);

    // Toggle active off
    await page.locator('test-class-directive .test-section').nth(0).locator('button', { hasText: 'Toggle Active' }).click();
    await expect(demoBox).not.toHaveClass(/\bactive\b/);
  });

  test('dynamic string class works', async ({ page }) => {
    await page.goto(url);
    // Test 2: Dynamic string class - theme starts as 'light'
    const section = page.locator('test-class-directive .test-section').nth(1);
    await expect(section).toContainText('Theme: light');

    // Toggle theme to 'dark'
    await section.locator('button', { hasText: 'Toggle Theme' }).click();
    await expect(section).toContainText('Theme: dark');
  });

  test('ternary expression in :class works', async ({ page }) => {
    await page.goto(url);
    // Test 6: Ternary expression - isActive starts as true → shows ACTIVE
    const section = page.locator('test-class-directive .test-section').nth(5);
    await expect(section).toContainText('State: ACTIVE');

    // Toggle to inactive
    await section.locator('button', { hasText: 'Toggle State' }).click();
    await expect(section).toContainText('State: INACTIVE');
  });

  test('toggle buttons change classes reactively', async ({ page }) => {
    await page.goto(url);
    // Test 1: Toggle error class
    const demoBox = page.locator('test-class-directive .test-section').nth(0).locator('.demo-box');

    // Initially no error class
    await expect(demoBox).not.toHaveClass(/\berror\b/);

    // Toggle error on
    await page.locator('test-class-directive .test-section').nth(0).locator('button', { hasText: 'Toggle Error' }).click();
    await expect(demoBox).toHaveClass(/\berror\b/);

    // Toggle error off
    await page.locator('test-class-directive .test-section').nth(0).locator('button', { hasText: 'Toggle Error' }).click();
    await expect(demoBox).not.toHaveClass(/\berror\b/);
  });
});

// ── test-static-class-preservation ────────────────────────────────────

test.describe('test-static-class-preservation', () => {
  test('ternary :class preserves static classes (box + base-style)', async ({ page }) => {
    await page.goto(url);
    const box = page.locator('test-static-class-preservation #test-ternary .box');

    // Should have static classes AND dynamic class
    await expect(box).toHaveClass(/\bbox\b/);
    await expect(box).toHaveClass(/\bbase-style\b/);
    await expect(box).toHaveClass(/\bactive-state\b/);

    // Toggle to inactive
    await page.locator('test-static-class-preservation #test-ternary button').click();
    await expect(box).toHaveClass(/\bbox\b/);
    await expect(box).toHaveClass(/\bbase-style\b/);
    await expect(box).toHaveClass(/\binactive-state\b/);
    await expect(box).not.toHaveClass(/\bactive-state\b/);
  });

  test('string :class preserves static classes (box + base-style)', async ({ page }) => {
    await page.goto(url);
    const box = page.locator('test-static-class-preservation #test-string .box');

    // Should have static classes AND dynamic class
    await expect(box).toHaveClass(/\bbox\b/);
    await expect(box).toHaveClass(/\bbase-style\b/);
    await expect(box).toHaveClass(/\blight\b/);

    // Toggle to dark
    await page.locator('test-static-class-preservation #test-string button').click();
    await expect(box).toHaveClass(/\bbox\b/);
    await expect(box).toHaveClass(/\bbase-style\b/);
    await expect(box).toHaveClass(/\bdark\b/);
    await expect(box).not.toHaveClass(/\blight\b/);
  });

  test('array :class preserves static classes (box + base-style)', async ({ page }) => {
    await page.goto(url);
    const box = page.locator('test-static-class-preservation #test-array .box');

    // Should have static classes AND dynamic classes from array
    await expect(box).toHaveClass(/\bbox\b/);
    await expect(box).toHaveClass(/\bbase-style\b/);
    await expect(box).toHaveClass(/\blight\b/);
    await expect(box).toHaveClass(/\bmedium\b/);

    // Cycle size
    await page.locator('test-static-class-preservation #test-array button').click();
    await expect(box).toHaveClass(/\bbox\b/);
    await expect(box).toHaveClass(/\bbase-style\b/);
    await expect(box).toHaveClass(/\blarge\b/);
    await expect(box).not.toHaveClass(/\bmedium\b/);
  });

  test('object :class preserves static classes (reference, already worked)', async ({ page }) => {
    await page.goto(url);
    const box = page.locator('test-static-class-preservation #test-object .box');

    // Object syntax always preserved static classes via classList
    await expect(box).toHaveClass(/\bbox\b/);
    await expect(box).toHaveClass(/\bbase-style\b/);
    await expect(box).toHaveClass(/\bactive\b/);
  });
});
