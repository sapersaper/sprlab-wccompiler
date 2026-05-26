/**
 * E2E tests for example/src/01-basics components.
 *
 * Tests:
 * - test-hello: basic component renders static content
 * - test-css-scoping: CSS is scoped to the component
 * - test-script-logic: const variables interpolate correctly (BUG-0001 fix)
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('01-basics'));
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
  // Wait for components to render
  await page.waitForSelector('test-hello');
  await page.waitForSelector('test-css-scoping');
  await page.waitForSelector('test-script-logic');

  expect(errors).toEqual([]);
});

// ── test-hello ────────────────────────────────────────────────────────

test.describe('test-hello', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-hello');
    await expect(el).toBeAttached();
  });

  test('displays the heading text', async ({ page }) => {
    await page.goto(url);
    const h1 = page.locator('test-hello h1');
    await expect(h1).toHaveText('¡Hola, WCC!');
  });

  test('displays the paragraph text', async ({ page }) => {
    await page.goto(url);
    const p = page.locator('test-hello p');
    await expect(p).toHaveText('Este es el primer test básico.');
  });

  test('applies scoped styles (green border)', async ({ page }) => {
    await page.goto(url);
    const box = page.locator('test-hello .hello-box');
    const border = await box.evaluate(el => getComputedStyle(el).borderColor);
    // #42b983 = rgb(66, 185, 131)
    expect(border).toBe('rgb(66, 185, 131)');
  });
});

// ── test-css-scoping ──────────────────────────────────────────────────

test.describe('test-css-scoping', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-css-scoping');
    await expect(el).toBeAttached();
  });

  test('paragraph inside component is blue', async ({ page }) => {
    await page.goto(url);
    const p = page.locator('test-css-scoping p');
    const color = await p.evaluate(el => getComputedStyle(el).color);
    // blue = rgb(0, 0, 255)
    expect(color).toBe('rgb(0, 0, 255)');
  });

  test('paragraph inside component is bold', async ({ page }) => {
    await page.goto(url);
    const p = page.locator('test-css-scoping p');
    const weight = await p.evaluate(el => getComputedStyle(el).fontWeight);
    expect(weight).toBe('700');
  });

  test('CSS does NOT leak to paragraphs outside the component', async ({ page }) => {
    await page.goto(url);
    // test-hello has a <p> that should NOT be blue
    const p = page.locator('test-hello p');
    const color = await p.evaluate(el => getComputedStyle(el).color);
    expect(color).not.toBe('rgb(0, 0, 255)');
  });
});

// ── test-script-logic (BUG-0001 regression test) ──────────────────────

test.describe('test-script-logic', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-script-logic');
    await expect(el).toBeAttached();
  });

  test('interpolates const APP_NAME correctly', async ({ page }) => {
    await page.goto(url);
    const paragraphs = page.locator('test-script-logic p');
    await expect(paragraphs.nth(0)).toContainText('App: WCC Tester');
  });

  test('interpolates const VERSION correctly', async ({ page }) => {
    await page.goto(url);
    const paragraphs = page.locator('test-script-logic p');
    await expect(paragraphs.nth(1)).toContainText('Version: 1.0.0');
  });

  test('interpolates computed fullVersion() correctly', async ({ page }) => {
    await page.goto(url);
    const paragraphs = page.locator('test-script-logic p');
    await expect(paragraphs.nth(2)).toContainText('Full: WCC Tester v1.0.0');
  });

  test('const variables are not empty (BUG-0001 regression)', async ({ page }) => {
    await page.goto(url);
    // The bug caused {{APP_NAME}} to render as empty string
    const appText = await page.locator('test-script-logic p').nth(0).textContent();
    expect(appText.trim()).not.toBe('App:');
    expect(appText).toContain('WCC Tester');
  });
});
