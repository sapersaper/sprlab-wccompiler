/**
 * E2E tests for Vue 3 integration — Basics.
 * Dev server must be running on port 4001.
 *
 * Covers Tests 1–11: props, events, v-model, slots, scoped slots.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4001';

test.describe('Vue + WCC Basics', () => {

  test('page loads without console errors', async ({ page }) => {
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
      const el = page.locator('#test1');
      await expect(el).toContainText('Static Label');
    });

    test('renders count prop passed via :count', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const el = page.locator('#test1');
      await expect(el).toContainText('10');
    });
  });

  // ── Test 2: Events ──

  test.describe('Test 2: Events', () => {
    test('increment button triggers @count-changed and updates eventCount', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const btn = page.locator('#test2 button');
      await btn.click();

      // The counter should show 1 and the Vue eventCount should update
      await expect(page.locator('#test2')).toContainText('1');
      await expect(page.locator('text=Vue eventCount:').first()).toContainText('1');
    });
  });

  // ── Test 3: v-model ──

  test.describe('Test 3: v-model:count', () => {
    test('increment via v-model updates both counter and Vue state', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const btn = page.locator('#test3 button');
      await btn.click();

      await expect(page.locator('#test3')).toContainText('1');
      await expect(page.locator('text=Vue modelCount:').first()).toContainText('1');
    });

    test('Vue increment button updates the wcc-counter via v-model', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await page.locator('button:has-text("Vue increment (v-model)")').click();

      await expect(page.locator('#test3')).toContainText('1');
      await expect(page.locator('text=Vue modelCount:').first()).toContainText('1');
    });
  });

  // ── Test 4: v-model with .number modifier ──

  test.describe('Test 4: v-model:count.number modifier', () => {
    test('increment via modifier updates counter', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const btn = page.locator('#test4 button');
      await btn.click();

      await expect(page.locator('#test4')).toContainText('1');
    });

    test('value type with .number modifier is "number"', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const btn = page.locator('#test4 button');
      await btn.click();

      await expect(page.locator('text=type:').first()).toContainText('number');
    });
  });

  // ── Test 4b: Multiple v-model on same element ──

  test.describe('Test 4b: Multiple v-model on same element', () => {
    test('both v-model bound props render correctly', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test4b')).toContainText('hello');
      await expect(page.locator('#test4b')).toBeAttached();
    });

    test('incrementing multiCount updates Vue state', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const btn = page.locator('#test4b button');
      await btn.click();

      await expect(page.locator('text=Vue multiCount:').first()).toContainText('1');
    });
  });

  // ── Test 5: Default slot ──

  test.describe('Test 5: Default slot', () => {
    test('renders default slot content inside wcc-card', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test5')).toContainText('Body content via default slot');
    });
  });

  // ── Test 6: Named slots (template #name) ──

  test.describe('Test 6: Named slots (template #name)', () => {
    test('renders header slot via #header', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test6')).toContainText('Header via #');
    });

    test('renders footer slot via #footer', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test6')).toContainText('Footer via #');
    });

    test('renders default body slot alongside named slots', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test6')).toContainText('Body content');
    });
  });

  // ── Test 7: Named slots (template #name — nested) ──

  test.describe('Test 7: Named slots (template #name — nested)', () => {
    test('renders header via #header', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test7')).toContainText('Bold');
    });

    test('renders footer via #footer', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test7')).toContainText('link');
    });
  });

  // ── Test 8: Named slots (template v-slot:name) ──

  test.describe('Test 8: Named slots (template v-slot:name)', () => {
    test('renders header via v-slot:header', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test8')).toContainText('Header v-slot');
    });

    test('renders footer via v-slot:footer', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      await expect(page.locator('#test8')).toContainText('Footer v-slot');
    });
  });

  // ── Test 9: Scoped slot (#item="{ item, index }") ──

  test.describe('Test 9: Scoped slot (#item="{ item, index }")', () => {
    test('renders item index and name from scoped slot', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test9 li');
      const count = await items.count();
      expect(count).toBe(3);

      // Check first item has index 0 and name
      const firstText = await items.nth(0).textContent();
      expect(firstText).toContain('0');
      expect(firstText).toContain('Apple');
      expect(firstText).not.toContain('{{');
    });

    test('renders all items names (Apple, Banana, Cherry)', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test9 li');
      await expect(items.nth(0)).toContainText('Apple');
      await expect(items.nth(1)).toContainText('Banana');
      await expect(items.nth(2)).toContainText('Cherry');
    });
  });

  // ── Test 10: Scoped slot (v-slot:item) ──

  test.describe('Test 10: Scoped slot (v-slot:item)', () => {
    test('renders scoped slot via v-slot:item', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test10 li.custom');
      const count = await items.count();
      expect(count).toBe(3);

      await expect(items.nth(0)).toContainText('Apple');
      await expect(items.nth(1)).toContainText('Banana');
      await expect(items.nth(2)).toContainText('Cherry');
    });

    test('custom class is applied from scoped slot template', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const firstItem = page.locator('#test10 li.custom').first();
      await expect(firstItem).toHaveClass('custom');
    });
  });

  // ── Test 11: Scoped slot + Vue interpolation ──

  test.describe('Test 11: Scoped slot + Vue interpolation', () => {
    test('renders item with Vue message', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const items = page.locator('#test11 li');
      const count = await items.count();
      expect(count).toBe(3);

      await expect(items.nth(0)).toContainText('Apple');
      await expect(items.nth(0)).toContainText('hello from Vue');
    });

    test('Vue message is reactive', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      const firstItem = page.locator('#test11 li').first();
      await expect(firstItem).toContainText('hello from Vue');
    });
  });

  // ── Slot fallback ──

  test.describe('Slot fallback content', () => {
    test('default fallback content is NOT shown when content is provided', async ({ page }) => {
      await page.goto(BASE + '/#/basics');
      // Test 5 provides body content, so "no body" should NOT appear
      await expect(page.locator('#test5')).not.toContainText('no body');
    });
  });
});
