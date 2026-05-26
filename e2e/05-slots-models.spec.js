/**
 * E2E tests for example/src/05-slots-models components.
 *
 * Tests:
 * - test-slot-child: default slot content, named slots (header, footer)
 * - test-slots-parent: slot projection (default content, custom content, partial override)
 * - test-all-slot-syntaxes: Vue shorthand (#name), Vue standard (slot="name"),
 *   regular elements (div[slot="name"]), mixed syntax, multiple elements per slot
 * - test-template-slot-syntax: <template slot="name"> syntax, mixed, multiple elements
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('05-slots-models'));
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
  await page.waitForSelector('test-slots-parent');
  await page.waitForSelector('test-all-slot-syntaxes');
  await page.waitForSelector('test-template-slot-syntax');

  expect(errors).toEqual([]);
});

// ── test-slots-parent: basic slot projection ──────────────────────────

test.describe('test-slots-parent — default and named slots', () => {
  // Example 1: No custom content — all slots show defaults
  test('example 1: shows default header when no slot content provided', async ({ page }) => {
    await page.goto(url);
    const card1 = page.locator('test-slots-parent .card-example').nth(0).locator('test-slot-child');
    await expect(card1.locator('.card-header h4')).toHaveText('Header por defecto');
  });

  test('example 1: shows default body when no slot content provided', async ({ page }) => {
    await page.goto(url);
    const card1 = page.locator('test-slots-parent .card-example').nth(0).locator('test-slot-child');
    await expect(card1.locator('.card-body p')).toHaveText('Contenido body por defecto');
  });

  test('example 1: shows default footer when no slot content provided', async ({ page }) => {
    await page.goto(url);
    const card1 = page.locator('test-slots-parent .card-example').nth(0).locator('test-slot-child');
    await expect(card1.locator('.card-footer p')).toHaveText('Footer por defecto');
  });

  // Example 2: All slots customized
  test('example 2: custom header replaces default', async ({ page }) => {
    await page.goto(url);
    const card2 = page.locator('test-slots-parent .card-example').nth(1).locator('test-slot-child');
    await expect(card2.locator('.card-header h4')).toContainText('Mi Header Personalizado');
  });

  test('example 2: custom body replaces default', async ({ page }) => {
    await page.goto(url);
    const card2 = page.locator('test-slots-parent .card-example').nth(1).locator('test-slot-child');
    await expect(card2.locator('.card-body')).toContainText('contenido body personalizado');
  });

  test('example 2: multiple elements in default slot', async ({ page }) => {
    await page.goto(url);
    const card2 = page.locator('test-slots-parent .card-example').nth(1).locator('test-slot-child');
    const bodyParagraphs = card2.locator('.card-body p');
    await expect(bodyParagraphs).toHaveCount(2);
  });

  test('example 2: custom footer replaces default', async ({ page }) => {
    await page.goto(url);
    const card2 = page.locator('test-slots-parent .card-example').nth(1).locator('test-slot-child');
    await expect(card2.locator('.card-footer')).toContainText('Footer personalizado');
  });

  // Example 3: Only default slot customized, named slots keep defaults
  test('example 3: custom body content provided', async ({ page }) => {
    await page.goto(url);
    const card3 = page.locator('test-slots-parent .card-example').nth(2).locator('test-slot-child');
    await expect(card3.locator('.card-body p')).toContainText('Solo personalicé el contenido del body');
  });

  test('example 3: header keeps default when not overridden', async ({ page }) => {
    await page.goto(url);
    const card3 = page.locator('test-slots-parent .card-example').nth(2).locator('test-slot-child');
    await expect(card3.locator('.card-header h4')).toHaveText('Header por defecto');
  });

  test('example 3: footer keeps default when not overridden', async ({ page }) => {
    await page.goto(url);
    const card3 = page.locator('test-slots-parent .card-example').nth(2).locator('test-slot-child');
    await expect(card3.locator('.card-footer p')).toHaveText('Footer por defecto');
  });
});

// ── test-all-slot-syntaxes: different slot projection syntaxes ─────────

test.describe('test-all-slot-syntaxes — syntax variants', () => {
  // Test 1: Vue Shorthand (#name)
  test('test 1: Vue shorthand #header projects content', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(0).locator('test-slot-child');
    await expect(section.locator('.card-header h4')).toContainText('Header con Vue Shorthand (#header)');
  });

  test('test 1: Vue shorthand #footer projects content', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(0).locator('test-slot-child');
    await expect(section.locator('.card-footer button')).toContainText('Footer Button con #footer');
  });

  test('test 1: default slot content between templates', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(0).locator('test-slot-child');
    await expect(section.locator('.card-body')).toContainText('Contenido default slot');
  });

  // Test 2: Vue Standard (slot="name")
  test('test 2: slot="header" attribute projects content', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(1).locator('test-slot-child');
    await expect(section.locator('.card-header h4')).toContainText('Header con Vue Standard');
  });

  test('test 2: slot="footer" attribute projects content', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(1).locator('test-slot-child');
    await expect(section.locator('.card-footer button')).toContainText('Footer Button con slot="footer"');
  });

  // Test 3: Regular Elements (div slot="name")
  test('test 3: div[slot="header"] projects content', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(2).locator('test-slot-child');
    await expect(section.locator('.card-header h4')).toContainText('Header con Div Element');
  });

  test('test 3: div[slot="footer"] projects content', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(2).locator('test-slot-child');
    await expect(section.locator('.card-footer button')).toContainText('Footer Button con div[slot="footer"]');
  });

  // Test 4: Mixed Syntax
  test('test 4: mixed syntax — #header works alongside slot="footer"', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(3).locator('test-slot-child');
    await expect(section.locator('.card-header h4')).toContainText('Header con Vue Shorthand (#header)');
    await expect(section.locator('.card-footer button')).toContainText('Footer con Vue Standard');
  });

  // Test 5: Multiple Elements per Slot
  test('test 5: multiple elements in #header slot', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(4).locator('test-slot-child');
    const header = section.locator('.card-header');
    await expect(header).toContainText('Header Title');
    await expect(header).toContainText('Header Subtitle');
    await expect(header).toContainText('Header Badge');
  });

  test('test 5: multiple elements in default slot', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(4).locator('test-slot-child');
    const body = section.locator('.card-body');
    const paragraphs = body.locator('p');
    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.nth(0)).toContainText('Default content paragraph 1');
    await expect(paragraphs.nth(1)).toContainText('Default content paragraph 2');
  });

  test('test 5: multiple elements in #footer slot', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-all-slot-syntaxes .test-section').nth(4).locator('test-slot-child');
    const footer = section.locator('.card-footer');
    const buttons = footer.locator('button');
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toContainText('Button 1');
    await expect(buttons.nth(1)).toContainText('Button 2');
    await expect(buttons.nth(2)).toContainText('Button 3');
  });
});

// ── test-template-slot-syntax: <template slot="name"> syntax ──────────

test.describe('test-template-slot-syntax — template element syntax', () => {
  // Test 1: Named slots with <template slot="name">
  test('test 1: template slot="header" projects content', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-template-slot-syntax .test-section').nth(0).locator('test-slot-child');
    await expect(section.locator('.card-header h4')).toContainText('Header con Template Syntax');
  });

  test('test 1: default slot content between templates', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-template-slot-syntax .test-section').nth(0).locator('test-slot-child');
    await expect(section.locator('.card-body')).toContainText('Contenido default slot');
  });

  test('test 1: template slot="footer" projects button', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-template-slot-syntax .test-section').nth(0).locator('test-slot-child');
    await expect(section.locator('.card-footer button')).toContainText('Footer Button');
  });

  // Test 2: Mixed syntax (template + div)
  test('test 2: template slot="header" works alongside div[slot="body"]', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-template-slot-syntax .test-section').nth(1).locator('test-slot-child');
    await expect(section.locator('.card-header h4')).toContainText('Header con Template');
    await expect(section.locator('.card-footer')).toContainText('Footer con Template');
  });

  // Test 3: Multiple elements in template
  test('test 3: multiple elements in template slot="header"', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-template-slot-syntax .test-section').nth(2).locator('test-slot-child');
    const header = section.locator('.card-header');
    await expect(header).toContainText('Header 1');
    await expect(header).toContainText('Header 2');
    await expect(header).toContainText('Header 3');
  });

  test('test 3: multiple buttons in template slot="footer"', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-template-slot-syntax .test-section').nth(2).locator('test-slot-child');
    const buttons = section.locator('.card-footer button');
    await expect(buttons).toHaveCount(2);
    await expect(buttons.nth(0)).toContainText('Button 1');
    await expect(buttons.nth(1)).toContainText('Button 2');
  });

  test('test 3: default slot content preserved', async ({ page }) => {
    await page.goto(url);
    const section = page.locator('test-template-slot-syntax .test-section').nth(2).locator('test-slot-child');
    await expect(section.locator('.card-body')).toContainText('Default content');
  });
});
