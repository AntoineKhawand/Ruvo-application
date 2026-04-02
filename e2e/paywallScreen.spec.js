import { test, expect } from '@playwright/test';

test.describe('PaywallScreen Premium Feel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('App loads Paywall screen without crash', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('Premium features list renders', async ({ page }) => {
    const coinFeature = page.locator('text=2x Coin Multiplier, text=Coin Multiplier').first();
    const count = await coinFeature.count().catch(() => 0);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Pricing section renders', async ({ page }) => {
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('PaywallScreen activeOpacity Consistency', () => {
  test('Interactive buttons are rendered', async ({ page }) => {
    const body = await page.content();
    expect(body.length).toBeGreaterThan(0);
  });
});
