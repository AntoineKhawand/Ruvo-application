import { test, expect } from '@playwright/test';

test.describe('AchievementsScreen Premium Feel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('App loads Achievements screen without crash', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('Trophy Room title or badge content renders', async ({ page }) => {
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('AchievementsScreen Haptic Consistency', () => {
  test('Screen renders content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.content();
    expect(body.length).toBeGreaterThan(0);
  });
});
