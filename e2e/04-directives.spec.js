/**
 * E2E tests for example/src/04-directives components.
 *
 * Tests:
 * - test-conditionals: if/else-if/else directive rendering
 * - test-list-rendering: each directive with arrays, keys, and index
 * - test-visibility: show directive (display toggle)
 * - test-attribute-binding: :href, :disabled, :style bindings
 * - test-template-refs: templateRef access to DOM elements
 * - test-style-binding: multi-property :style object syntax
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('04-directives'));
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
  await page.waitForSelector('test-conditionals');
  await page.waitForSelector('test-list-rendering');
  await page.waitForSelector('test-visibility');
  await page.waitForSelector('test-attribute-binding');
  await page.waitForSelector('test-template-refs');
  await page.waitForSelector('test-style-binding');

  expect(errors).toEqual([]);
});

// ── test-conditionals ─────────────────────────────────────────────────

test.describe('test-conditionals', () => {
  test('shows active state by default', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-conditionals .status-card.active')).toBeVisible();
    await expect(page.locator('test-conditionals .status-card.active h4')).toContainText('Estado Activo');
  });

  test('pending and inactive cards are not visible initially', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-conditionals .status-card.pending')).not.toBeAttached();
    await expect(page.locator('test-conditionals .status-card.inactive')).not.toBeAttached();
  });

  test('switching to pending shows pending card', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-conditionals button', { hasText: 'Set Pending' }).click();

    await expect(page.locator('test-conditionals .status-card.pending')).toBeVisible();
    await expect(page.locator('test-conditionals .status-card.pending h4')).toContainText('Estado Pendiente');
    await expect(page.locator('test-conditionals .status-card.active')).not.toBeAttached();
  });

  test('switching to inactive shows inactive card', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-conditionals button', { hasText: 'Set Inactive' }).click();

    await expect(page.locator('test-conditionals .status-card.inactive')).toBeVisible();
    await expect(page.locator('test-conditionals .status-card.inactive h4')).toContainText('Estado Inactivo');
  });

  test('can switch back to active', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-conditionals button', { hasText: 'Set Inactive' }).click();
    await page.locator('test-conditionals button', { hasText: 'Set Active' }).click();

    await expect(page.locator('test-conditionals .status-card.active')).toBeVisible();
    await expect(page.locator('test-conditionals .status-card.inactive')).not.toBeAttached();
  });

  test('status signal text updates reactively', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-conditionals .status-display p')).toContainText('Status actual: active');

    await page.locator('test-conditionals button', { hasText: 'Set Pending' }).click();
    await expect(page.locator('test-conditionals .status-display p')).toContainText('Status actual: pending');
  });
});

// ── test-list-rendering ───────────────────────────────────────────────

test.describe('test-list-rendering', () => {
  test('renders initial 3 items', async ({ page }) => {
    await page.goto(url);
    const items = page.locator('test-list-rendering .array-section .list-item');
    await expect(items).toHaveCount(3);
  });

  test('displays item names correctly', async ({ page }) => {
    await page.goto(url);
    const firstItem = page.locator('test-list-rendering .array-section .list-item').first();
    await expect(firstItem).toContainText('Item 1');
  });

  test('add button appends a new item', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-list-rendering button', { hasText: 'Agregar Item' }).click();

    const items = page.locator('test-list-rendering .array-section .list-item');
    await expect(items).toHaveCount(4);
    await expect(items.last()).toContainText('Item 4');
  });

  test('remove button removes last item', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-list-rendering button', { hasText: 'Eliminar Último' }).click();

    const items = page.locator('test-list-rendering .array-section .list-item');
    await expect(items).toHaveCount(2);
  });

  test('total items count updates reactively', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-list-rendering .array-section p')).toContainText('Total items: 3');

    await page.locator('test-list-rendering button', { hasText: 'Agregar Item' }).click();
    await expect(page.locator('test-list-rendering .array-section p')).toContainText('Total items: 4');
  });

  test('renders numeric range (1 to 5)', async ({ page }) => {
    await page.goto(url);
    const rangeItems = page.locator('test-list-rendering .range-section ol li');
    await expect(rangeItems).toHaveCount(5);
  });

  test('renders index-based list', async ({ page }) => {
    await page.goto(url);
    const indexItems = page.locator('test-list-rendering .index-section ul li');
    await expect(indexItems).toHaveCount(3);
    await expect(indexItems.first()).toContainText('[0] Item 1');
  });
});

// ── test-visibility ───────────────────────────────────────────────────

test.describe('test-visibility', () => {
  test('element is visible by default', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-visibility .visible-box')).toBeVisible();
  });

  test('hide button hides the element', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-visibility button', { hasText: 'Hide' }).click();

    await expect(page.locator('test-visibility .visible-box')).not.toBeVisible();
  });

  test('show button makes element visible again', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-visibility button', { hasText: 'Hide' }).click();
    await page.locator('test-visibility button', { hasText: 'Show' }).click();

    await expect(page.locator('test-visibility .visible-box')).toBeVisible();
  });

  test('toggle button alternates visibility', async ({ page }) => {
    await page.goto(url);
    const toggleBtn = page.locator('test-visibility button', { hasText: 'Toggle' });

    await toggleBtn.click();
    await expect(page.locator('test-visibility .visible-box')).not.toBeVisible();

    await toggleBtn.click();
    await expect(page.locator('test-visibility .visible-box')).toBeVisible();
  });

  test('hidden element stays in DOM (display:none, not removed)', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-visibility button', { hasText: 'Hide' }).click();

    // Element should still be in DOM, just hidden
    await expect(page.locator('test-visibility .visible-box')).toBeAttached();
    const display = await page.locator('test-visibility .visible-box').evaluate(el => el.style.display);
    expect(display).toBe('none');
  });

  test('isVisible signal text updates', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-visibility .status-display p')).toContainText('isVisible: true');

    await page.locator('test-visibility button', { hasText: 'Hide' }).click();
    await expect(page.locator('test-visibility .status-display p')).toContainText('isVisible: false');
  });
});

// ── test-attribute-binding ────────────────────────────────────────────

test.describe('test-attribute-binding', () => {
  test('renders initial href value', async ({ page }) => {
    await page.goto(url);
    const link = page.locator('test-attribute-binding .dynamic-link');
    await expect(link).toHaveAttribute('href', 'https://example.com');
  });

  test('change URL button updates href', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-attribute-binding button', { hasText: 'Cambiar URL' }).click();

    const link = page.locator('test-attribute-binding .dynamic-link');
    await expect(link).toHaveAttribute('href', 'https://github.com');
  });

  test('disabled binding toggles button state', async ({ page }) => {
    await page.goto(url);
    // Find the button that can be disabled (not the toggle button itself)
    const disableBtn = page.locator('test-attribute-binding .attr-section').nth(1).locator('button');
    
    // Initially enabled
    await expect(disableBtn).not.toBeDisabled();

    // Click to disable
    await disableBtn.click();
    await expect(disableBtn).toBeDisabled();
  });

  test('style binding applies dynamic color', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-attribute-binding button', { hasText: 'Cambiar Color' }).click();

    const styledDiv = page.locator('test-attribute-binding .attr-section').nth(2).locator('[style]');
    const color = await styledDiv.evaluate(el => el.style.color);
    expect(color).not.toBe('');
  });

  test('font size increases on button click', async ({ page }) => {
    await page.goto(url);
    const sizeBtn = page.locator('test-attribute-binding button', { hasText: 'Aumentar Tamaño' });
    await sizeBtn.click();

    const styledDiv = page.locator('test-attribute-binding .attr-section').nth(2).locator('[style]');
    const fontSize = await styledDiv.evaluate(el => el.style.fontSize);
    expect(fontSize).toBe('18px');
  });
});

// ── test-template-refs ────────────────────────────────────────────────

test.describe('test-template-refs', () => {
  test('input ref sets initial value on mount', async ({ page }) => {
    await page.goto(url);
    const input = page.locator('test-template-refs input[type="text"]');
    await expect(input).toHaveValue('Texto inicial desde ref');
  });

  test('canvas ref draws on mount', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-template-refs').locator('text=Canvas inicializado y dibujado')).toBeVisible();
  });

  test('div ref measures dimensions', async ({ page }) => {
    await page.goto(url);
    const dimText = page.locator('test-template-refs .ref-section').nth(2).locator('p').first();
    await expect(dimText).toContainText('Ancho:');
    await expect(dimText).toContainText('Alto:');
  });

  test('update button changes input value via ref', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-template-refs button', { hasText: 'Actualizar via Ref' }).click();

    const input = page.locator('test-template-refs input[type="text"]');
    await expect(input).toHaveValue('Actualizado via ref!');
  });

  test('clear canvas button updates status text', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-template-refs button', { hasText: 'Limpiar Canvas' }).click();

    await expect(page.locator('test-template-refs').locator('text=Canvas limpiado')).toBeVisible();
  });
});

// ── test-style-binding ────────────────────────────────────────────────

test.describe('test-style-binding', () => {
  test('single property style binding applies background', async ({ page }) => {
    await page.goto(url);
    const box = page.locator('test-style-binding .test-section').first().locator('.style-box');
    const bg = await box.evaluate(el => el.style.backgroundColor);
    expect(bg).toBe('lightblue');
  });

  test('change colors button toggles background', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-style-binding button', { hasText: 'Change Colors' }).click();

    const box = page.locator('test-style-binding .test-section').first().locator('.style-box');
    const bg = await box.evaluate(el => el.style.backgroundColor);
    expect(bg).toBe('lightcoral');
  });

  test('multi-property style binding applies all properties', async ({ page }) => {
    await page.goto(url);
    const box = page.locator('test-style-binding .test-section').nth(1).locator('.style-box');

    const bg = await box.evaluate(el => el.style.backgroundColor);
    const color = await box.evaluate(el => el.style.color);
    const fontSize = await box.evaluate(el => el.style.fontSize);
    const fontWeight = await box.evaluate(el => el.style.fontWeight);

    expect(bg).toBe('lightblue');
    expect(color).toBe('darkblue');
    expect(fontSize).toBe('16px');
    expect(fontWeight).toBe('bold');
  });

  test('increase font size button updates style', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-style-binding button', { hasText: 'Increase Font Size' }).click();

    const box = page.locator('test-style-binding .test-section').nth(1).locator('.style-box');
    const fontSize = await box.evaluate(el => el.style.fontSize);
    expect(fontSize).toBe('18px');
  });

  test('conditional style hides element when toggled', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-style-binding button', { hasText: 'Toggle Visibility' }).click();

    const box = page.locator('test-style-binding .test-section').nth(2).locator('.style-box');
    const display = await box.evaluate(el => el.style.display);
    expect(display).toBe('none');
  });
});
