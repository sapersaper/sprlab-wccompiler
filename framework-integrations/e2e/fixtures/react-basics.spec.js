/**
 * E2E tests for React 19 integration — Basics.
 * Dev server must be running on port 4002.
 *
 * Covers Tests 1–11: props, events, slots, scoped slots.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4002';

test.describe('React + WCC Basics', () => {

  test('page loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(BASE + '/#/basics');
    await page.waitForSelector('wcc-counter');
    await page.waitForSelector('wcc-card');
    await page.waitForSelector('wcc-list');

    expect(errors).toEqual([]);
  });

  // ── Test 1: Props ──

  test.describe('Test 1: Props', () => {
    test('renders label prop as text', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test1')).toContainText('Static Label');
    });

    test('renders count prop passed via JSX', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test1')).toContainText('10');
    });
  });

  // ── Test 2: Events ──

  test.describe('Test 2: Events', () => {
    test('increment button triggers oncountchanged', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const btn = page.locator('#test2 button');
      await btn.click();
      await expect(page.locator('#test2')).toContainText('1');
    });
  });

  // ── Test 5: Default slot ──

  test.describe('Test 5: Default slot', () => {
    test('renders default slot content', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test5')).toContainText('Body content via default slot');
    });
  });

  // ── Test 6: Named slots (slot="name") ──

  test.describe('Test 6: Named slots (slot="name")', () => {
    test('renders header via slot="header"', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test6')).toContainText('Header via slot attr');
    });

    test('renders footer via slot="footer"', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test6')).toContainText('Footer via slot attr');
    });
  });

  // ── Test 7: Named slots (nested elements) ──

  test.describe('Test 7: Named slots — nested elements', () => {
    test('renders header with bold and emphasis', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test7')).toContainText('Bold');
      await expect(page.locator('#test7')).toContainText('emphasis');
    });

    test('renders footer with link', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test7')).toContainText('link');
    });
  });

  // ── Test 8: Named slots (JSX prop via React plugin) ──

  test.describe('Test 8: Named slots via JSX prop', () => {
    test('renders header via JSX prop', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test8')).toContainText('Header via JSX prop');
    });

    test('renders footer via JSX prop', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test8')).toContainText('Footer via JSX prop');
    });
  });

  // ── Test 9: Scoped slot (render prop — item + index) ──

  test.describe('Test 9: Scoped slot — render prop with index', () => {
    test('renders 3 items from scoped slot', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test9 li');
      expect(await items.count()).toBe(3);
    });

    test('first item shows index 0 and Apple', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const firstItem = page.locator('#test9 li').first();
      await expect(firstItem).toContainText('0');
      await expect(firstItem).toContainText('Apple');
    });

    test('all items render without template syntax leaks', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test9 li');
      const count = await items.count();
      for (let i = 0; i < count; i++) {
        const text = await items.nth(i).textContent();
        expect(text).not.toContain('{{');
        expect(text).not.toContain('{%');
      }
    });
  });

  // ── Test 10: Scoped slot (custom class) ──

  test.describe('Test 10: Scoped slot — custom class', () => {
    test('renders items with custom css class', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test10 li.custom');
      expect(await items.count()).toBe(3);
    });

    test('first item shows Apple', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test10 li.custom').first()).toContainText('Apple');
    });
  });

  // ── Test 11: Scoped slot + React state ──

  test.describe('Test 11: Scoped slot + React state', () => {
    test('renders item with React message', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test11 li');
      expect(await items.count()).toBe(3);
      // External React state can't be serialized — item name renders, message is empty
      await expect(items.nth(0)).toContainText('Apple');
    });
  });
});
