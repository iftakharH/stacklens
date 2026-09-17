import { expect, test } from '@playwright/test';
import { attachErrorCollector, dbMode, stubAvatars } from './helpers';

test.describe('analyze + share error states', () => {
  test('sign-in is reachable from the analyze page itself and closes on Escape', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await page.goto('/analyze');

    // The sign-in methods must be usable in place — not a detour to the
    // marketing page. Scoped to the header: a rendered report also offers an
    // inline sign-in hint.
    await page
      .getByRole('banner')
      .getByRole('button', { name: 'Sign in', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Sign in with GitHub' })
    ).toBeVisible();
    await expect(dialog.getByLabel('Email address')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    expect(
      errors.unexpectedConsoleErrors([{ urlFragment: 'api/auth/', status: 503 }])
    ).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test('landing page hero sends a visitor straight into a report', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await stubAvatars(page);

    await page.goto('/');
    // The landing page is its own document: hero claim + specimen fingerprint.
    await expect(page.getByRole('heading', { name: 'Read the work' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'github.com/torvalds' })
    ).toBeVisible();
    await expect(page.getByText('C', { exact: true })).toBeVisible();
    await expect(page.getByText('97.5%')).toBeVisible();

    await page.getByLabel('GitHub profile URL or username').fill('octocat');
    await page.getByRole('button', { name: 'Analyze profile', exact: true }).click();

    // The offer is the product: the hero hands off to the analyzer.
    await expect(page).toHaveURL(/\/analyze\?q=octocat$/);
    await expect(page.getByText('Smart Summary')).toBeVisible();

    expect(
      errors.unexpectedConsoleErrors([{ urlFragment: 'api/auth/', status: 503 }])
    ).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test('manual analyze renders the full octocat report with zero console/page errors', async ({
    page,
  }) => {
    const errors = attachErrorCollector(page);
    await stubAvatars(page);

    await page.goto('/analyze');
    await page.getByLabel('GitHub profile URL or username').fill('octocat');
    await page.getByRole('button', { name: 'Analyze profile' }).click();

    // Hero profile card: avatar + username + display name.
    await expect(page.getByRole('img', { name: 'octocat' })).toBeVisible();
    await expect(page.getByText('The Octocat')).toBeVisible();
    await expect(page.getByText('@octocat')).toBeVisible();

    // Summary + hireability badge.
    await expect(page.getByText('Smart Summary')).toBeVisible();
    await expect(page.getByText('Ruby-focused public portfolio')).toBeVisible();
    await expect(page.getByText('Junior Ready')).toBeVisible();

    // Score meters: three sub-scores with values in the 0–10 range, plus the
    // overall score display.
    const meters = page.getByText(/^\d+\.\d \/ 10$/);
    await expect(meters.first()).toBeVisible();
    const values = await meters.allTextContents();
    expect(values.length).toBeGreaterThanOrEqual(3);
    for (const raw of values) {
      const value = Number(raw.split(' ')[0]);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
    }
    await expect(page.getByText('5.5')).toBeVisible();
    await expect(page.getByText('Activity', { exact: true })).toBeVisible();
    await expect(page.getByText('Stack diversity', { exact: true })).toBeVisible();
    await expect(page.getByText('Project quality', { exact: true })).toBeVisible();

    // Language section.
    await expect(page.getByRole('heading', { name: 'Stack Analysis' })).toBeVisible();
    await expect(page.getByText('Primary: Ruby')).toBeVisible();
    await expect(page.getByText('97.9%')).toBeVisible();

    // Repo highlights.
    await expect(
      page.getByRole('heading', { name: 'Repository Highlights' })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Spoon-Knife/ })).toBeVisible();
    await expect(page.getByText('★ 14034')).toBeVisible();

    // Insights.
    await expect(page.getByRole('heading', { name: 'Developer Insights' })).toBeVisible();
    await expect(
      page.getByText('Low activity — consider pushing code more consistently.')
    ).toBeVisible();

    // Zero unexpected console errors, zero page errors. On a zero-env server
    // the better-auth client's get-session call intentionally 503s (auth not
    // configured — the app degrades to signed-out UI); Chromium logs that as
    // a resource-load line, so it is paired against the observed response.
    expect(
      errors.unexpectedConsoleErrors([{ urlFragment: 'api/auth/', status: 503 }])
    ).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test('/analyze?q=octocat auto-runs the analysis', async ({ page }) => {
    const errors = attachErrorCollector(page);
    await stubAvatars(page);

    await page.goto('/analyze?q=octocat');

    // Input prefilled from the URL, report renders without clicking anything.
    await expect(page.getByLabel('GitHub profile URL or username')).toHaveValue(
      'octocat'
    );
    await expect(page.getByRole('img', { name: 'octocat' })).toBeVisible();
    await expect(page.getByText('Smart Summary')).toBeVisible();
    await expect(page.getByText('Junior Ready')).toBeVisible();

    expect(
      errors.unexpectedConsoleErrors([{ urlFragment: 'api/auth/', status: 503 }])
    ).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });

  test('/share/definitely-not-a-real-token shows an ErrorCard', async ({ page }) => {
    const errors = attachErrorCollector(page);

    await page.goto('/share/definitely-not-a-real-token');

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    if (dbMode) {
      // DB configured: unknown tokens are indistinguishable 404s.
      await expect(alert).toContainText('Share link unavailable');
      await expect(alert).toContainText(/expired|revoked/);
    } else {
      // Zero-env server: public share lookups degrade to 503 CONFIG_MISSING
      // (contract locked in by test/integration/features.test.js).
      await expect(alert).toContainText('not configured');
    }

    // Expected resource-load console lines only: the zero-env get-session
    // 503s and the share lookup itself (404 with DB, 503 without).
    expect(
      errors.unexpectedConsoleErrors([
        { urlFragment: 'api/auth/', status: 503 },
        { urlFragment: 'api/share/', status: 404 },
        { urlFragment: 'api/share/', status: 503 },
      ])
    ).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
  });
});
