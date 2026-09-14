import { test, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:4317';
test('web page fills its viewport, scrolls all content, and reflows across screen sizes', async ({ page, context }, info) => {
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `192.0.3.${{ chromium: 10, firefox: 20, webkit: 30 }[info.project.name]}` });
  await page.goto('/');
  await page.getByLabel('Owner password').fill('browser-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  const prefix = `Layout ${info.project.name} ${Date.now()}`;
  for (let i = 0; i < 24; i++) {
    const response = await page.request.post('/api/tasks', { headers: { origin }, data: { title: `${prefix} task ${i}` } });
    expect(response.status()).toBe(201);
  }
  async function navigate(label: string) {
    if (!await page.locator('.sidebar').isVisible()) await page.getByLabel('Toggle navigation').click();
    await page.locator('.nav-item').filter({ hasText: label }).click();
  }
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await navigate('Tasks');
    await expect(page.getByText(`${prefix} task 23`, { exact: true })).toBeVisible();
    await page.getByText(`${prefix} task 23`, { exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    expect(await page.locator('.topbar').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(0);
    expect(await page.locator('.content').evaluate(el => getComputedStyle(el).overflowY)).toBe('visible');
    await navigate('Performance');
    await expect(page.locator('.performance-page')).toBeVisible();
    const dimensions = await page.evaluate(() => {
      const content = document.querySelector('.content')!;
      const style = getComputedStyle(content);
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        performance: document.querySelector('.performance-page')!.getBoundingClientRect().width,
        available: content.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      };
    });
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(Math.abs(dimensions.performance - dimensions.available)).toBeLessThan(2);
    await navigate('Calendar');
    expect(await page.locator('.cal-day').first().evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(viewport.width <= 480 ? 87 : 127);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 1));
    expect(await page.locator('.cal-day').last().evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: info.outputPath(`calendar-${viewport.width}.png`), animations: 'disabled' });
    if (viewport.width < 900) {
      await page.getByLabel('Toggle navigation').click();
      await expect(page.getByLabel('Close navigation', { exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('.sidebar')).not.toBeVisible();
      await expect(page.getByLabel('Toggle navigation')).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await navigate('Performance');
  const before = await page.locator('.performance-page').evaluate(el => el.getBoundingClientRect().width);
  await page.getByLabel('Toggle navigation').click();
  await expect(page.locator('.sidebar')).not.toBeVisible();
  expect(await page.locator('.performance-page').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(before + 200);
  await page.screenshot({ path: info.outputPath('full-width-performance.png'), animations: 'disabled' });
});
