/**
 * E2E tests for example/src/02-reactivity components.
 *
 * Tests:
 * - test-signals: signal read/write, computed derivation, UI reactivity
 * - test-effects: side effects triggered by signal changes
 * - test-batch: batch() groups multiple signal updates into one effect run
 */

import { test, expect } from '@playwright/test';
import { compileAndServe } from './helpers/compile-fixture.js';

let url;
let cleanup;

test.beforeAll(async () => {
  ({ url, cleanup } = await compileAndServe('02-reactivity'));
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
  await page.waitForSelector('test-signals');
  await page.waitForSelector('test-effects');
  await page.waitForSelector('test-batch');

  expect(errors).toEqual([]);
});

// ── test-signals ──────────────────────────────────────────────────────

test.describe('test-signals', () => {
  test('renders initial count as 0', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-signals .counter-section p').first()).toContainText('Count: 0');
  });

  test('renders computed doubled as 0 initially', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-signals .counter-section p').nth(1)).toContainText('Doubled (computed): 0');
  });

  test('increment button increases count', async ({ page }) => {
    await page.goto(url);
    const incBtn = page.locator('test-signals button', { hasText: '+1' });
    await incBtn.click();
    await incBtn.click();

    await expect(page.locator('test-signals .counter-section p').first()).toContainText('Count: 2');
    await expect(page.locator('test-signals .counter-section p').nth(1)).toContainText('Doubled (computed): 4');
  });

  test('decrement button decreases count', async ({ page }) => {
    await page.goto(url);
    const incBtn = page.locator('test-signals button', { hasText: '+1' });
    const decBtn = page.locator('test-signals button', { hasText: '-1' });
    await incBtn.click();
    await incBtn.click();
    await decBtn.click();

    await expect(page.locator('test-signals .counter-section p').first()).toContainText('Count: 1');
  });

  test('reset button sets count back to 0', async ({ page }) => {
    await page.goto(url);
    const incBtn = page.locator('test-signals button', { hasText: '+1' });
    const resetBtn = page.locator('test-signals button', { hasText: 'Reset' });
    await incBtn.click();
    await incBtn.click();
    await resetBtn.click();

    await expect(page.locator('test-signals .counter-section p').first()).toContainText('Count: 0');
  });

  test('message signal updates on button click', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-signals .message-section p')).toContainText('Message: Hola WCC');

    await page.locator('test-signals button', { hasText: 'Actualizar Mensaje' }).click();
    await expect(page.locator('test-signals .message-section p')).toContainText('Message: Mensaje actualizado!');
  });
});

// ── test-effects ──────────────────────────────────────────────────────

test.describe('test-effects', () => {
  test('renders initial count as 0', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-effects .control-section p')).toContainText('Count: 0');
  });

  test('effect logs initial value on mount', async ({ page }) => {
    await page.goto(url);
    const logContent = page.locator('test-effects .log-content');
    await expect(logContent).toContainText('Count cambió a: 0');
  });

  test('effect logs each increment', async ({ page }) => {
    await page.goto(url);
    const incBtn = page.locator('test-effects button', { hasText: 'Incrementar' });
    await incBtn.click();
    await incBtn.click();

    const logContent = page.locator('test-effects .log-content');
    await expect(logContent).toContainText('Count cambió a: 1');
    await expect(logContent).toContainText('Count cambió a: 2');
  });

  test('clear button resets count and logs', async ({ page }) => {
    await page.goto(url);
    const incBtn = page.locator('test-effects button', { hasText: 'Incrementar' });
    await incBtn.click();
    await incBtn.click();

    await page.locator('test-effects button', { hasText: 'Clear All' }).click();

    await expect(page.locator('test-effects .control-section p')).toContainText('Count: 0');
    const logContent = page.locator('test-effects .log-content');
    await expect(logContent).toHaveText('');
  });
});

// ── test-batch ────────────────────────────────────────────────────────

test.describe('test-batch', () => {
  test('renders initial empty state', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('test-batch .data-display p').nth(0)).toContainText('Nombre:');
    await expect(page.locator('test-batch .data-display p').nth(1)).toContainText('Apellido:');
    await expect(page.locator('test-batch .data-display p').nth(2)).toContainText('Edad: 0');
  });

  test('batch update sets all values at once', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-batch button', { hasText: 'Con Batch' }).click();

    await expect(page.locator('test-batch .data-display p').nth(0)).toContainText('Nombre: Jane');
    await expect(page.locator('test-batch .data-display p').nth(1)).toContainText('Apellido: Smith');
    await expect(page.locator('test-batch .data-display p').nth(2)).toContainText('Edad: 25');
  });

  test('batch runs effect only once for multiple signal updates', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-batch button', { hasText: 'Con Batch' }).click();

    // With batch, the effect should run only 1 time
    await expect(page.locator('test-batch .highlight')).toContainText('Effect ejecutado: 1 vez(es)');
  });

  test('without batch, effect runs multiple times', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-batch button', { hasText: 'Sin Batch' }).click();

    // Without batch, effect count should be > 1
    const text = await page.locator('test-batch .highlight').textContent();
    const match = text.match(/(\d+)/);
    expect(Number(match[1])).toBeGreaterThan(1);
  });

  test('reset clears all values', async ({ page }) => {
    await page.goto(url);
    await page.locator('test-batch button', { hasText: 'Sin Batch' }).click();
    await page.locator('test-batch button', { hasText: 'Reset' }).click();

    await expect(page.locator('test-batch .data-display p').nth(2)).toContainText('Edad: 0');
  });
});
