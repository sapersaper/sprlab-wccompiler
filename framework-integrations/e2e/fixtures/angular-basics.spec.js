/**
 * E2E tests for Angular 19 integration — Basics.
 * Dev server must be running on port 4003.
 *
 * Covers Tests 1–10: props, events, two-way, slots, scoped slots.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4003';

test.describe('Angular + WCC Basics', () => {

  test('page loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(BASE + '/#/basics');
    await page.waitForSelector('wcc-counter');
    await page.waitForSelector('wcc-card');

    expect(errors).toEqual([]);
  });

  // ── Test 1: Props ──

  test.describe('Test 1: Props', () => {
    test('renders label prop as text', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test1')).toContainText('Static Label');
    });

    test('renders count prop passed via [count]', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test1')).toContainText('10');
    });
  });

  // ── Test 2: Events ──

  test.describe('Test 2: Events', () => {
    test('increment button triggers (countChange)', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const btn = page.locator('#test2 button');
      await btn.click();
      await expect(page.locator('#test2')).toContainText('1');
    });
  });

  // ── Test 3: Two-way binding ──

  test.describe('Test 3: Two-way binding [(count)]', () => {
    test('increment via two-way binding updates counter', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const btn = page.locator('#test3 button');
      await btn.click();
      await expect(page.locator('#test3')).toContainText('1');
    });
  });

  // ── Test 4: Multiple two-way bindings ──

  test.describe('Test 4: Multiple two-way bindings', () => {
    test('both banana-box bindings render initial values', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test4 .first')).toContainText('foo');
      await expect(page.locator('#test4 .second')).toContainText('bar');
    });

    test('toggling first model updates display and Angular state', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await page.locator('button:has-text("Toggle first")').click();
      await expect(page.locator('#test4 .first')).toContainText('bar');
      await expect(page.locator('p:has-text("multiFirst:")')).toContainText('bar');
    });

    test('toggling second model updates display and Angular state', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await page.locator('button:has-text("Toggle second")').click();
      await expect(page.locator('#test4 .second')).toContainText('baz');
      await expect(page.locator('p:has-text("multiSecond:")')).toContainText('baz');
    });
  });

  // ── Test 5: Default slot ──

  test.describe('Test 5: Default slot', () => {
    test('renders default slot content', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test5')).toContainText('Body content via default slot');
    });
  });

  // ── Test 6: Named slots (atributo selector) ──

  test.describe('Test 6: Named slots (atributo selector)', () => {
    test('renders header via attribute selector', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test6')).toContainText('Header via attribute');
    });

    test('renders footer via attribute selector', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test6')).toContainText('Footer via attribute');
    });

    test('renders default body slot', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test6')).toContainText('Body content');
    });
  });

  // ── Test 7: Named slots — nested elements (atributo selector) ──

  test.describe('Test 7: Named slots — nested elements (atributo selector)', () => {
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

  // ── Test 8: Scoped slot (TemplateRef + input) ──

  test.describe('Test 8: Scoped slot (TemplateRef + input)', () => {
    test('renders 3 items from scoped slot', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test8 li');
      expect(await items.count()).toBe(3);
    });

    test('first item shows index 0 and Apple', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const firstItem = page.locator('#test8 li').first();
      await expect(firstItem).toContainText('0');
      await expect(firstItem).toContainText('Apple');
    });

    test('no template syntax leaks', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test8 li');
      for (let i = 0; i < await items.count(); i++) {
        expect(await items.nth(i).textContent()).not.toContain('{{');
      }
    });
  });

  // ── Test 9: Scoped slot — custom class (TemplateRef + input) ──

  test.describe('Test 9: Scoped slot — custom class', () => {
    test('renders items with custom css class', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test9 li.custom');
      expect(await items.count()).toBe(3);
      await expect(items.first()).toContainText('Apple');
      await expect(items.first()).toContainText('hello from Angular');
    });
  });

  // ── Test 10: Scoped slot + Angular interpolation (TemplateRef + input) ──

  test.describe('Test 10: Scoped slot + Angular interpolation', () => {
    test('renders item with Angular message', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test10 li');
      expect(await items.count()).toBe(3);
      await expect(items.first()).toContainText('hello from Angular');
    });
  });
});
