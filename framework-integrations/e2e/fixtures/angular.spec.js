/**
 * E2E tests for Angular 19 integration with WCC components.
 * Dev server must be running on port 4003.
 *
 * Covers all test cases from app.component.html (Tests 1–10).
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4003';

test.describe('Angular + WCC integration', () => {

  test('page loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(BASE);
    await page.waitForSelector('wcc-counter');
    await page.waitForSelector('wcc-card');
    await page.waitForSelector('wcc-list');

    expect(errors).toEqual([]);
  });

  // ── Test 1: Props ──

  test.describe('Test 1: Props', () => {
    test('renders label prop as text', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test1')).toContainText('Static Label');
    });

    test('renders count prop passed via [count]', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test1')).toContainText('10');
    });
  });

  // ── Test 2: Events ──

  test.describe('Test 2: Events', () => {
    test('increment button triggers (count-changed)', async ({ page }) => {
      await page.goto(BASE);
      const btn = page.locator('#test2 button');
      await btn.click();
      await expect(page.locator('#test2')).toContainText('1');
    });
  });

  // ── Test 3: Two-way binding ──

  test.describe('Test 3: Two-way binding [(count)]', () => {
    test('increment via two-way binding updates counter', async ({ page }) => {
      await page.goto(BASE);
      const btn = page.locator('#test3 button');
      await btn.click();
      await expect(page.locator('#test3')).toContainText('1');
    });
  });

  // ── Test 4: Multiple bindings ──

  test.describe('Test 4: Multiple bindings', () => {
    test('renders with multiple bindings on same element', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test4')).toContainText('Multi-test');
    });
  });

  // ── Test 5: Default slot ──

  test.describe('Test 5: Default slot', () => {
    test('renders default slot content', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test5')).toContainText('Body content via default slot');
    });
  });

  // ── Test 6: Named slots (ng-template[slot]) ──

  test.describe('Test 6: Named slots (ng-template[slot])', () => {
    test('renders header via ng-template slot="header"', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test6')).toContainText('Header via ng-template');
    });

    test('renders footer via ng-template slot="footer"', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test6')).toContainText('Footer via ng-template');
    });

    test('renders default body slot', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test6')).toContainText('Body content');
    });
  });

  // ── Test 7: Named slots (div slot="name") ──

  test.describe('Test 7: Named slots (div slot="name")', () => {
    test('renders header with bold and emphasis', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test7')).toContainText('Bold');
      await expect(page.locator('#test7')).toContainText('emphasis');
    });

    test('renders footer with link', async ({ page }) => {
      await page.goto(BASE);
      await expect(page.locator('#test7')).toContainText('link');
    });
  });

  // ── Test 8: Scoped slot (let-item let-index) ──

  test.describe('Test 8: Scoped slot (let-item let-index)', () => {
    test('renders 3 items from scoped slot', async ({ page }) => {
      await page.goto(BASE);
      const items = page.locator('#test8 li');
      expect(await items.count()).toBe(3);
    });

    test('first item shows index 0 and Apple', async ({ page }) => {
      await page.goto(BASE);
      const firstItem = page.locator('#test8 li').first();
      await expect(firstItem).toContainText('0');
      await expect(firstItem).toContainText('Apple');
    });

    test('no template syntax leaks', async ({ page }) => {
      await page.goto(BASE);
      const items = page.locator('#test8 li');
      for (let i = 0; i < await items.count(); i++) {
        expect(await items.nth(i).textContent()).not.toContain('{{');
      }
    });
  });

  // ── Test 9: Scoped slot — custom class ──

  test.describe('Test 9: Scoped slot — custom class', () => {
    test('renders items with custom css class', async ({ page }) => {
      await page.goto(BASE);
      const items = page.locator('#test9 li.custom');
      expect(await items.count()).toBe(3);
      await expect(items.first()).toContainText('Apple');
    });
  });

  // ── Test 10: Scoped slot + Angular interpolation ──

  test.describe('Test 10: Scoped slot + Angular interpolation', () => {
    test('renders item with Angular message', async ({ page }) => {
      await page.goto(BASE);
      const items = page.locator('#test10 li');
      expect(await items.count()).toBe(3);
      await expect(items.first()).toContainText('hello from Angular');
    });
  });
});
