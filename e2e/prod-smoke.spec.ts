import { expect, test } from '@playwright/test';
import { attachErrorCollector, stubAvatars } from './helpers';

// Production-build smoke test. Reuses the mock-GitHub pattern from the dev
// suite, but runs against `vite preview` serving the built bundle on :4173
// with the same same-origin /api proxy production gets from vercel.json.
//
// This is the gap that let the "Invalid base URL: /api/auth" crash ship: the
// dev server uses an absolute auth URL, the built bundle used a relative one,
// and only a production build reproduces it. Asserting pageErrors is empty on
// a real (non-dev) bundle is the whole point of this file.

const MIN_BODY_TEXT = 100;

async function expectNotBlank(page: import('@playwright/test').Page) {
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(MIN_BODY_TEXT);
  expect(await page.locator('#root > *').count()).toBeGreaterThan(0);
}

test.describe('production build smoke', () => {
  test('/ renders the landing hero with zero page errors', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await stubAvatars(page);

    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Read the work' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'github.com/torvalds' })
    ).toBeVisible();
    await expect(page.getByText('97.5%')).toBeVisible();

    await expectNotBlank(page);

    // The crash surfaced here — assert nothing threw during module eval/render.
    expect(errors.pageErrors).toEqual([]);
    // Zero-env API: the auth client's get-session intentionally 503s.
    expect(
      errors.unexpectedConsoleErrors([{ urlFragment: 'api/auth/', status: 503 }])
    ).toEqual([]);
  });

  test('/analyze?q=octocat renders the full report with zero page errors', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await stubAvatars(page);

    await page.goto('/analyze?q=octocat');

    await expect(page.getByText('Smart Summary')).toBeVisible();
    await expect(page.getByText('Junior Ready')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Stack Analysis' })).toBeVisible();
    await expect(page.getByText('Primary: Ruby')).toBeVisible();

    await expectNotBlank(page);

    expect(errors.pageErrors).toEqual([]);
    expect(
      errors.unexpectedConsoleErrors([{ urlFragment: 'api/auth/', status: 503 }])
    ).toEqual([]);
  });

  test('unknown route renders the SPA 404 instead of a blank page', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);

    await page.goto('/definitely-not-a-route');

    await expect(page.getByText("That page doesn't exist.")).toBeVisible();
    await expectNotBlank(page);

    expect(errors.pageErrors).toEqual([]);
    expect(
      errors.unexpectedConsoleErrors([{ urlFragment: 'api/auth/', status: 503 }])
    ).toEqual([]);
  });
});
