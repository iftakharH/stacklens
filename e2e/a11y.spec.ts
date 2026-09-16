import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { stubAvatars } from './helpers';

const seriousOrCritical = (violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) =>
  violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test.describe('accessibility (axe)', () => {
  // Reduced motion disables the .fade-in opacity animation, so axe measures
  // final colors instead of mid-animation alpha blends (deterministic scan).
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('landing page has no serious/critical violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Read the work' })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const bad = seriousOrCritical(results.violations);
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });

  test('analyzer page initial state has no serious/critical violations', async ({
    page,
  }) => {
    await page.goto('/analyze');
    await expect(page.getByRole('button', { name: 'Analyze Profile' })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const bad = seriousOrCritical(results.violations);
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });

  test('rendered octocat report has no serious/critical violations', async ({
    page,
  }) => {
    await stubAvatars(page);
    await page.goto('/analyze?q=octocat');
    // This is the suite's FIRST analysis against a possibly cold API pg pool
    // (fresh docker container on Windows can take >10s for the first
    // connect) — allow a one-time longer wait here.
    await expect(page.getByText('Smart Summary')).toBeVisible({
      timeout: 30_000,
    });

    const results = await new AxeBuilder({ page }).analyze();
    const bad = seriousOrCritical(results.violations);
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });
});
