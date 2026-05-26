/**
 * E2E tests for example/src/03-props-events components.
 *
 * Tests:
 * - test-props: prop reception and computed derivation from props
 * - test-events: DOM event handling (click, dblclick, input, keydown)
 * - test-custom-event-parent/child: custom event emission and parent handling
 * - test-model-parent/child: two-way binding with defineModel
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('03-props-events'));
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
  await page.waitForSelector('test-props');
  await page.waitForSelector('test-events');
  await page.waitForSelector('test-custom-event-parent');

  expect(errors).toEqual([]);
});

// ── test-props ────────────────────────────────────────────────────────

test.describe('test-props', () => {
  test('renders with attribute-provided props', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-props').first().locator('.prop-display p').nth(0)).toContainText('Title: Custom Title');
    await expect(page.locator('test-props').first().locator('.prop-display p').nth(1)).toContainText('Count: 42');
  });

  test('renders computed status from active prop', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-props').first().locator('.prop-display p').nth(3)).toContainText('Status: Activo');
  });

  test('renders default values when no attributes provided', async ({ page }) => {
    await page.goto(url);
    const defaults = page.locator('#props-defaults');
    await expect(defaults.locator('.prop-display p').nth(0)).toContainText('Title: Título por defecto');
    await expect(defaults.locator('.prop-display p').nth(1)).toContainText('Count: 0');
    await expect(defaults.locator('.prop-display p').nth(2)).toContainText('Active: false');
  });

  test('computed status shows Inactivo for default active=false', async ({ page }) => {
    await page.goto(url);
    const defaults = page.locator('#props-defaults');
    await expect(defaults.locator('.prop-display p').nth(3)).toContainText('Status: Inactivo');
  });

  test('visual indicator shows green background when active=true', async ({ page }) => {
    await page.goto(url);
    const indicator = page.locator('test-props').first().locator('.visual-indicator');
    const bg = await indicator.evaluate(el => getComputedStyle(el).backgroundColor);
    // #42b983 = rgb(66, 185, 131)
    expect(bg).toBe('rgb(66, 185, 131)');
  });

  test('visual indicator shows red background when active=false', async ({ page }) => {
    await page.goto(url);
    const indicator = page.locator('#props-defaults .visual-indicator');
    const bg = await indicator.evaluate(el => getComputedStyle(el).backgroundColor);
    // #f66 = rgb(255, 102, 102)
    expect(bg).toBe('rgb(255, 102, 102)');
  });

  test('visual indicator text shows ACTIVO when active=true', async ({ page }) => {
    await page.goto(url);
    const text = page.locator('test-props').first().locator('.visual-indicator p');
    await expect(text).toContainText('Componente ACTIVO');
  });

  test('visual indicator text shows INACTIVO when active=false', async ({ page }) => {
    await page.goto(url);
    const text = page.locator('#props-defaults .visual-indicator p');
    await expect(text).toContainText('Componente INACTIVO');
  });
});

// ── test-events ───────────────────────────────────────────────────────

test.describe('test-events', () => {
  test('click handler increments count', async ({ page }) => {
    await page.goto(url);
    const clickBtn = page.locator('test-events button', { hasText: 'Click Me!' });
    await clickBtn.click();
    await clickBtn.click();

    await expect(page.locator('test-events .stats p').first()).toContainText('Click Count: 2');
  });

  test('click handler updates last event', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-events button', { hasText: 'Click Me!' }).click();
    await expect(page.locator('test-events .stats p').nth(1)).toContainText('Last Event: Click detectado');
  });

  test('double click handler updates last event', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-events button', { hasText: 'Double Click' }).dblclick();
    await expect(page.locator('test-events .stats p').nth(1)).toContainText('Last Event: Double Click detectado');
  });

  test('mouseenter handler updates last event', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-events .hover-box').hover();
    await expect(page.locator('test-events .stats p').nth(1)).toContainText('Last Event: Mouse Enter');
  });

  test('input handler captures typed text', async ({ page }) => {
    await page.goto(url);
    const input = page.locator('test-events input[type="text"]');
    await input.fill('hello');

    await expect(page.locator('test-events .input-section p')).toContainText('Valor actual: hello');
  });

  test('keydown handler captures key press', async ({ page }) => {
    await page.goto(url);
    const input = page.locator('test-events input[type="text"]');
    await input.press('Enter');

    await expect(page.locator('test-events .stats p').nth(1)).toContainText('Last Event: Keydown: Enter');
  });
});

// ── test-custom-event-parent/child ────────────────────────────────────

test.describe('test-custom-events', () => {
  test('child renders with initial count 0', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-custom-event-child p')).toContainText('Count: 0');
  });

  test('child increment emits event to parent', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-custom-event-child button', { hasText: '+1' }).click();

    // Child count updates
    await expect(page.locator('test-custom-event-child p')).toContainText('Count: 1');
    // Parent receives the event
    await expect(page.locator('test-custom-event-parent .parent-info p').first()).toContainText('Parent Count: 1');
  });

  test('child decrement emits event to parent', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-custom-event-child button', { hasText: '+1' }).click();
    await page.locator('test-custom-event-child button', { hasText: '-1' }).click();

    await expect(page.locator('test-custom-event-parent .parent-info p').first()).toContainText('Parent Count: 0');
  });

  test('child message event reaches parent', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-custom-event-child button', { hasText: 'Send Message' }).click();

    await expect(page.locator('test-custom-event-parent .parent-info p').nth(1)).toContainText('Last Message: Hola desde el hijo!');
  });

  test('event log shows recent events', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-custom-event-child button', { hasText: '+1' }).click();
    await page.locator('test-custom-event-child button', { hasText: 'Send Message' }).click();

    const log = page.locator('test-custom-event-parent .event-log');
    await expect(log).toContainText('Increment: 1');
    await expect(log).toContainText('Message:');
  });
});

// ── test-model-parent/child (two-way binding) ─────────────────────────

test.describe('test-model (two-way binding)', () => {
  test('child input updates parent state', async ({ page }) => {
    await page.goto(url);
    const input = page.locator('test-model-child input[type="text"]');
    await input.fill('John');

    // Parent should reflect the change
    await expect(page.locator('test-model-parent .parent-state p').nth(0)).toContainText('Username: "John"');
  });

  test('child number input updates parent state', async ({ page }) => {
    await page.goto(url);
    const input = page.locator('test-model-child input[type="number"]');
    await input.fill('25');

    await expect(page.locator('test-model-parent .parent-state p').nth(1)).toContainText('Age: 25');
  });

  test('child checkbox updates parent state', async ({ page }) => {
    await page.goto(url);
    const checkbox = page.locator('test-model-child input[type="checkbox"]');
    await checkbox.check();

    await expect(page.locator('test-model-parent .parent-state p').nth(2)).toContainText('Agreed: true');
  });

  test('parent reset clears child inputs', async ({ page }) => {
    await page.goto(url);
    // Fill some values
    await page.locator('test-model-child input[type="text"]').fill('Test');
    await page.locator('test-model-child input[type="checkbox"]').check();

    // Reset from parent
    await page.locator('test-model-parent button', { hasText: 'Reset All' }).click();

    await expect(page.locator('test-model-parent .parent-state p').nth(0)).toContainText('Username: ""');
    await expect(page.locator('test-model-parent .parent-state p').nth(2)).toContainText('Agreed: false');
  });
});
