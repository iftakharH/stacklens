import { expect, test } from '@playwright/test';
import { drainRateLimitWindow } from './helpers';

// Named zz-* so it runs LAST (workers: 1): the whole suite shares one API
// process and one client IP, and this spec exhausts the default 10/min anon
// limit on purpose.
test('11th rapid analysis is rate limited with a visible countdown', async ({
  page,
}) => {
  test.setTimeout(240_000);

  // Wait out the shared window so exactly 10 navigations pass and the 11th
  // is blocked, regardless of what earlier specs consumed.
  await drainRateLimitWindow();

  // 10 rapid navigations: each auto-runs an analysis against the mock and
  // renders the report.
  for (let i = 1; i <= 10; i += 1) {
    await page.goto('/analyze?q=octocat');
    await expect(page.getByText('Smart Summary')).toBeVisible();
  }

  // 11th: RATE_LIMITED ErrorCard with a visible countdown.
  await page.goto('/analyze?q=octocat');
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Too many requests');
  await expect(alert).toContainText(/Rate limit reached — try again in \d+s/);
  await expect(
    page.getByRole('button', { name: /^Try again in \d+s$/ })
  ).toBeVisible();
});
