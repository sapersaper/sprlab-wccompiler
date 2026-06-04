/**
 * E2E tests for React 19 integration — Composition.
 * Dev server must be running on port 4002.
 *
 * Covers Tests 16–19: wrapper, nesting, parent, each + wcc-counter.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4002';

test.describe('React + WCC Composition', () => {

  test('page loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(BASE + '/#/composition');
    await page.waitForSelector('wcc-wrapper');
    await page.waitForSelector('wcc-parent');

    expect(errors).toEqual([]);
  });

  // ── Test 16: Wrapper > Counter ──

  test.describe('Test 16: WCC→WCC simple (wrapper > counter)', () => {
    test('renders wrapper with title', async ({ page }) => {
      await page.goto(BASE + '/#/composition');
      await expect(page.locator('#test16')).toContainText('Wrapper Title');
    });

    test('inner wcc-counter renders with initial count', async ({ page }) => {
      await page.goto(BASE + '/#/composition');
      await expect(page.locator('#test16 wcc-counter')).toContainText('5');
    });
  });

  // ── Test 17: Wrapper > Card ──

  test.describe('Test 17: 2 niveles (wrapper > card)', () => {
    test('renders wrapper with card inside', async ({ page }) => {
      await page.goto(BASE + '/#/composition');
      await expect(page.locator('#test17')).toContainText('Card Wrapper');
      await expect(page.locator('#test17')).toContainText('Nested Card');
      await expect(page.locator('#test17')).toContainText('Body inside wrapper');
    });
  });

  // ── Test 18: wcc-parent ──

  test.describe('Test 18: wcc-parent with internal wcc-counter', () => {
    test('renders with initial count', async ({ page }) => {
      await page.goto(BASE + '/#/composition');
      await expect(page.locator('#test18')).toContainText('3');
    });

    test('increment button updates parent count', async ({ page }) => {
      await page.goto(BASE + '/#/composition');
      await page.locator('#test18 .parent-btn').click();
      await expect(page.locator('#test18')).toContainText('4');
    });
  });

  // ── Test 19: each + wcc-counter ──

  test.describe('Test 19: each con wcc-counter por item', () => {
    test('renders 3 items', async ({ page }) => {
      await page.goto(BASE + '/#/composition');
      const wrappers = page.locator('#test19-area wcc-wrapper');
      const count = await wrappers.count();
      expect(count).toBe(3);
    });
  });
});
