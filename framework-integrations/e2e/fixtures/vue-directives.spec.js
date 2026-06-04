/**
 * E2E tests for Vue 3 integration — Directives.
 * Dev server must be running on port 4001.
 *
 * Covers Tests 12–15: conditional, show, input v-model, styled.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4001';

test.describe('Vue + WCC Directives', () => {

  test('page loads without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(BASE + '/#/directives');
    await page.waitForSelector('wcc-conditional');
    await page.waitForSelector('wcc-toggle');
    await page.waitForSelector('wcc-input');
    await page.waitForSelector('wcc-styled');

    expect(errors).toEqual([]);
  });

  // ── Test 12: Conditional ──

  test.describe('Test 12: Conditional (if/else-if/else)', () => {
    test('shows "Visible" when condVisible is true', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      await expect(page.locator('#test12')).toContainText('Visible');
      await expect(page.locator('#test12')).not.toContainText('Hidden');
    });

    test('shows "Hidden" after toggling condVisible to false', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      await page.locator('button:has-text("Toggle conditional")').click();
      await expect(page.locator('#test12')).toContainText('Hidden');
      await expect(page.locator('#test12')).not.toContainText('Visible');
    });

    test('toggles back and forth correctly', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      const btn = page.locator('button:has-text("Toggle conditional")');
      await btn.click();
      await expect(page.locator('#test12')).toContainText('Hidden');
      await btn.click();
      await expect(page.locator('#test12')).toContainText('Visible');
    });
  });

  // ── Test 13: Show ──

  test.describe('Test 13: Show directive', () => {
    test('content is visible when show is true', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      await expect(page.locator('#test13')).toContainText('This content is toggled via show directive');
    });

    test('content is hidden after toggling show to false', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      await page.locator('button:has-text("Toggle show")').click();
      await expect(page.locator('#test13 p')).not.toBeVisible();
    });
  });

  // ── Test 14: Input v-model ──

  test.describe('Test 14: Input v-model', () => {
    test('typing in input updates Vue state and display', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      const input = page.locator('#test14 input');
      await input.fill('hello wcc');
      await expect(page.locator('#test14 span')).toContainText('hello wcc');
      await expect(page.locator('text=Vue inputValue:').first()).toContainText('hello wcc');
    });

    test('placeholder prop is rendered', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      const input = page.locator('#test14 input');
      await expect(input).toHaveAttribute('placeholder', 'Type something...');
    });
  });

  // ── Test 15: Styled ──

  test.describe('Test 15: Styled (:class / :style)', () => {
    test('renders with primary variant by default', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      await expect(page.locator('#test15')).toContainText('primary');
      await expect(page.locator('#test15')).toContainText('#333');
    });

    test('toggle variant changes class', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      await page.locator('button:has-text("Toggle variant")').click();
      await expect(page.locator('#test15')).toContainText('secondary');
    });

    test('toggle color changes style', async ({ page }) => {
      await page.goto(BASE + '/#/directives');
      await page.locator('button:has-text("Toggle color")').click();
      await expect(page.locator('#test15')).toContainText('#e63946');
    });
  });
});
