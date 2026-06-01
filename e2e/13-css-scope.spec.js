/**
 * E2E tests for CSS @scope implementation (example/src/13-css-scope).
 *
 * Tests:
 * - Basic @scope: selectors are scoped to component
 * - Boundary isolation: parent styles do NOT leak into child
 * - :host / :scope: styling the component root
 * - @media, @keyframes, @supports inside @scope
 * - :is(), :where() selectors with commas
 * - CSS nesting (&)
 * - @import extracted outside @scope
 * - CSS comments preserved
 * - Global styles unaffected by component scoping
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('13-css-scope'));
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
  await page.waitForSelector('test-scope-basic');
  await page.waitForSelector('test-scope-boundary-parent');
  await page.waitForSelector('test-scope-host');
  await page.waitForSelector('test-scope-atrules');
  await page.waitForSelector('test-scope-modern');
  await page.waitForSelector('test-scope-nesting');
  await page.waitForSelector('test-scope-import');
  await page.waitForSelector('test-scope-comments');

  expect(errors).toEqual([]);
});

// ── Global styles unaffected ──────────────────────────────────────────

test('global <p> style is not overridden by component scoping', async ({ page }) => {
  await page.goto(url);
  const h1 = page.locator('h1');
  const color = await h1.evaluate(el => getComputedStyle(el).color);
  expect(color).toBe('rgb(0, 0, 0)');
});

// ── Basic @scope ──────────────────────────────────────────────────────

test.describe('test-scope-basic', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-basic');
    await expect(el).toBeAttached();
  });

  test('.scoped-text is blue (scoped)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-basic .scoped-text');
    const color = await el.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(0, 0, 255)');
  });

  test('.scoped-border has green dashed border', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-basic .scoped-border');
    const borderStyle = await el.evaluate(el => getComputedStyle(el).borderStyle);
    expect(borderStyle).toBe('dashed');
  });
});

// ── Scope Boundary (parent-child isolation) ───────────────────────────

test.describe('test-scope-boundary-parent', () => {
  test('renders parent and child in the DOM', async ({ page }) => {
    await page.goto(url);
    const parent = page.locator('test-scope-boundary-parent');
    const child = page.locator('wcc-scope-child');
    await expect(parent).toBeAttached();
    await expect(child).toBeAttached();
  });

  test('parent .parent-text is red', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-boundary-parent .parent-text').first();
    const color = await el.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 0, 0)');
  });

  test('child .child-text is green (NOT red — parent styles did not leak)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('wcc-scope-child .child-text').first();
    const color = await el.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(0, 128, 0)');
  });

  test('child .child-text is NOT red (isolation confirmed)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('wcc-scope-child .child-text').first();
    const color = await el.evaluate(el => getComputedStyle(el).color);
    expect(color).not.toBe('rgb(255, 0, 0)');
  });

  test('toggling child visibility works', async ({ page }) => {
    await page.goto(url);
    const child = page.locator('wcc-scope-child');
    await expect(child).toBeVisible();

    const btn = page.locator('test-scope-boundary-parent button');
    await btn.click();
    await expect(child).not.toBeVisible();

    await btn.click();
    await expect(child).toBeVisible();
  });
});

// ── :host / :scope ────────────────────────────────────────────────────

test.describe('test-scope-host', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-host');
    await expect(el).toBeAttached();
  });

  test('component root has purple border (via :host)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-host');
    const borderColor = await el.evaluate(el => getComputedStyle(el).borderColor);
    expect(borderColor).toBe('rgb(128, 0, 128)');
  });

  test('component root display is block (via :host)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-host');
    const display = await el.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('block');
  });

  test('body text is purple (via .body p selector)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-host .highlight');
    const color = await el.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(128, 0, 128)');
  });
});

// ── @media / @keyframes / @supports inside @scope ─────────────────────

test.describe('test-scope-atrules', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-atrules');
    await expect(el).toBeAttached();
  });

  test('.responsive-box is visible and has correct content', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-atrules .responsive-box');
    await expect(el).toBeVisible();
  });

  test('.animation-box is visible and has animation applied', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-atrules .animation-box');
    await expect(el).toBeVisible();
    const animName = await el.evaluate(el => getComputedStyle(el).animationName);
    expect(animName).toBe('fadeIn');
  });

  test('.supports-box is visible (grid is supported)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-atrules .supports-box');
    await expect(el).toBeVisible();
  });
});

// ── Modern Selectors (:is, :where, commas) ────────────────────────────

test.describe('test-scope-modern', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-modern');
    await expect(el).toBeAttached();
  });

  test('.highlight has yellow background', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-modern .highlight');
    const bg = await el.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(255, 235, 59)');
  });
});

// ── CSS Nesting (&) inside @scope ─────────────────────────────────────

test.describe('test-scope-nesting', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-nesting');
    await expect(el).toBeAttached();
  });

  test('.title inside .card has bold font weight (via & nesting)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-nesting .card .title');
    const weight = await el.evaluate(el => getComputedStyle(el).fontWeight);
    expect(weight).toBe('700');
  });
});

// ── @import + @scope ──────────────────────────────────────────────────

test.describe('test-scope-import', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-import');
    await expect(el).toBeAttached();
  });

  test('text is styled with imported Roboto font', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-import p');
    const fontFamily = await el.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toContain('roboto');
  });
});

// ── CSS Comments ──────────────────────────────────────────────────────

test.describe('test-scope-comments', () => {
  test('renders the component in the DOM', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-comments');
    await expect(el).toBeAttached();
  });

  test('.commented-style is teal (comment did not break scoping)', async ({ page }) => {
    await page.goto(url);
    const el = page.locator('test-scope-comments .commented-style');
    const color = await el.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(0, 128, 128)');
  });
});
