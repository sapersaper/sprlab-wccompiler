/**
 * E2E tests for compiler fixes (14-compiler-fixes).
 *
 * Tests:
 * - test-boolean-prop: boolean prop with "false" string value
 * - test-attr-before-connect: attribute set before connectedCallback with renderIf
 * - test-prop-signal-init: signal initialized from props reference
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('14-compiler-fixes'));
});

test.afterAll(async () => {
  await cleanup();
});

test('page loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(url);
  await page.waitForSelector('test-boolean-prop');
  await page.waitForSelector('test-attr-before-connect');
  await page.waitForSelector('test-prop-signal-init');

  expect(errors).toEqual([]);
});

// ── BUG-0017: Boolean prop "false" string ──

test.describe('test-boolean-prop', () => {
  test('shows HIDDEN when visible="false" (boolean coercion fix)', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-boolean-prop')).toContainText('HIDDEN');
    await expect(page.locator('test-boolean-prop')).not.toContainText('VISIBLE');
  });

  test('visible prop is false in state', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-boolean-prop')).toContainText('visible prop: false');
  });
});

// ── BUG-0018: renderIf before connectedCallback ──

test.describe('test-attr-before-connect', () => {
  test('renders title set via attribute (renderIf guard fix)', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-attr-before-connect')).toContainText('Set via attribute');
    await expect(page.locator('test-attr-before-connect')).not.toContainText('No title');
  });
});

// ── BUG-0019: props.* reference in signal init ──

test.describe('test-prop-signal-init', () => {
  test('count starts at 5 (default from props reference)', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-prop-signal-init')).toContainText('Count: 5');
  });
});
