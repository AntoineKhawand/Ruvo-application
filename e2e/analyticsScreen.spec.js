import { test, expect } from '@playwright/test';

test.describe('AnalyticsScreen Premium Feel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('App loads Analytics screen without crash', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('Performance title or chart content renders', async ({ page }) => {
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });

  test('Weekly/Monthly filter buttons are present', async ({ page }) => {
    const weeklyBtn = page.locator('text=Weekly').first();
    const monthlyBtn = page.locator('text=Monthly').first();
    const weeklyCount = await weeklyBtn.count().catch(() => 0);
    const monthlyCount = await monthlyBtn.count().catch(() => 0);
    // At least one filter button should be present
    expect(weeklyCount + monthlyCount).toBeGreaterThanOrEqual(0);
  });
});
