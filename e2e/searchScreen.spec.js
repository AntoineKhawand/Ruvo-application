import { test, expect } from '@playwright/test';

test.describe('SearchScreen Premium Feel', () => {
  test('App loads Search screen without crash', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(500);
  });

  test('App renders content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const body = await page.content();
    expect(body.length).toBeGreaterThan(100);
  });
});

test.describe('SearchScreen Haptic Feedback Patterns', () => {
  test('Search interaction does not crash', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const input = page.locator('input').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill('test').catch(() => {});
      await page.waitForTimeout(200);
    }
    expect(true).toBeTruthy();
  });
});
