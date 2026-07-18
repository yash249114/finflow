import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://finflow-3js0lbb1a-yash249114s-projects.vercel.app';

test.describe('Landing Page', () => {
  test('loads successfully and has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FinFlow/i);
  });

  test('hero section is visible', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('text=financial intelligence').first();
    await expect(hero).toBeVisible({ timeout: 15000 });
  });

  test('navigation links exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Login').first()).toBeVisible();
    await expect(page.locator('text=Get Started').first()).toBeVisible();
  });

  test('features section renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Instant CSV Import').first()).toBeVisible({ timeout: 15000 });
  });

  test('pricing section renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Free').first()).toBeVisible({ timeout: 15000 });
  });

  test('footer has legal links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/terms"]')).toBeVisible();
    await expect(page.locator('a[href="/privacy"]')).toBeVisible();
  });
});

test.describe('Public Pages', () => {
  test('terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('text=Terms of Service')).toBeVisible({ timeout: 15000 });
  });

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('text=Privacy Policy')).toBeVisible({ timeout: 15000 });
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('text=About').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Auth Pages', () => {
  test('login page renders form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 15000 });
  });

  test('register page renders form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 15000 });
  });

  test('login page has sign-up link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Sign up').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Protected Routes', () => {
  const protectedPaths = ['/dashboard', '/transactions', '/forecast', '/copilot'];

  for (const path of protectedPaths) {
    test(`${path} redirects to login when unauthenticated`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });
  }
});

test.describe('Responsive Design', () => {
  test('mobile viewport: landing page renders', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('text=FinFlow').first()).toBeVisible({ timeout: 15000 });
  });

  test('tablet viewport: landing page renders', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('text=FinFlow').first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Performance', () => {
  test('landing page loads under 5s', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });

  test('no console errors on landing page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});
