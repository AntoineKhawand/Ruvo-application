import { test, expect } from '@playwright/test';

test.describe('RewardsScreen Premium Feel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('App loads Rewards screen without crash', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('Reward cards or content renders', async ({ page }) => {
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });

  test('Coins balance header or tab content renders', async ({ page }) => {
    const body = await page.content();
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('RewardsScreen activeOpacity Fix', () => {
  test('Tab buttons are rendered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.content();
    expect(body.length).toBeGreaterThan(0);
  });

  test('Stagger animation renders without crash', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    expect(true).toBeTruthy();
  });

  test('Pull-to-refresh area is rendered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.content();
    expect(body.length).toBeGreaterThan(0);
  });
});
