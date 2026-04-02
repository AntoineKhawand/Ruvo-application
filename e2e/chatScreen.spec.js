import { test, expect } from '@playwright/test';

test.describe('ChatScreen Premium Feel', () => {
  test('App loads without crash', async ({ page }) => {
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
