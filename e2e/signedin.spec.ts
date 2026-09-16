import { createHash } from 'node:crypto';
import pg from 'pg';
import { expect, test } from '@playwright/test';
import { awaitFreeRateSlots } from './helpers';

// Runs only when E2E_DATABASE_URL is set (docker Postgres recipe from
// .env.example: start the container, `npm run migrate`, then run Playwright
// with E2E_DATABASE_URL pointing at it). The API server receives the same
// URL as DATABASE_URL plus the TEST_SESSION_USER_ID override, so API calls
// are treated as this fixed user even though the browser itself has no real
// session cookie.
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? '';

// Must match TEST_SESSION_USER_ID in playwright.config.ts.
const TEST_SESSION_USER_ID = '11111111-1111-4111-8111-111111111111';

test.skip(!DATABASE_URL, 'requires E2E_DATABASE_URL (docker test Postgres)');

let pool: pg.Pool;

test.beforeAll(async () => {
  pool = new pg.Pool({ connectionString: DATABASE_URL });

  // Ensure the fixed test user row exists (reports.user_id references
  // "user"(id)). Idempotent only: NO table wipes here — if Playwright re-runs
  // this hook in a fresh worker process mid-file, wiping would destroy the
  // rows earlier tests created. Every test below is self-healing against
  // leftovers (report inserts dedupe by content hash, candidates upsert,
  // deletes target rows found in this run's responses).
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified")
     VALUES ($1, 'E2E Test User', 'e2e@stacklens.test', true)
     ON CONFLICT (id) DO NOTHING`,
    [TEST_SESSION_USER_ID]
  );
});

test.afterAll(async () => {
  await pool?.end();
});

// Each test reserves its own /api-call budget in the shared 10/min anon
// window (the probe inside awaitFreeRateSlots consumes one slot itself).
// Counts include dev-mode StrictMode double-firing of the SharePage load
// effect (2 GETs per share-page view).

test('analyze from page context persists the report and returns report_id', async ({
  page,
}) => {
  await awaitFreeRateSlots(1); // this test: 1 analyze call
  await page.goto('/');
  const data = await page.evaluate(async () => {
    const res = await fetch('/api/analyze?q=octocat');
    return res.json();
  });

  expect(data.ok).toBe(true);
  expect(data.data.username).toBe('octocat');
  expect(data.data.report_id).toBeTruthy();

  const { rows } = await pool!.query(
    'SELECT github_username, user_id FROM reports WHERE id = $1',
    [data.data.report_id]
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].github_username).toBe('octocat');
  expect(rows[0].user_id).toBe(TEST_SESSION_USER_ID);
});

test('share link: create → public report renders → expires → ErrorCard', async ({
  page,
}) => {
  // This test: 1 share POST + 2 share GETs per page view (StrictMode
  // double-fires the load effect in dev) × 2 views (initial + reload).
  await awaitFreeRateSlots(5);

  // The persisted report row from the previous test (identical content
  // dedupes to one row per user).
  const { rows } = await pool!.query(
    `SELECT id FROM reports
      WHERE user_id = $1 AND github_username = 'octocat'
      ORDER BY created_at DESC LIMIT 1`,
    [TEST_SESSION_USER_ID]
  );
  expect(rows).toHaveLength(1);
  const reportId = rows[0].id as string;

  await page.goto('/');
  const share = await page.evaluate(async (report_id) => {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id }),
    });
    return res.json();
  }, reportId);
  expect(share.ok).toBe(true);
  expect(share.data.token).toBeTruthy();
  expect(share.data.path).toBe(`/share/${share.data.token}`);
  const token = share.data.token as string;

  // Anyone with the link sees the public report.
  await page.goto(`/share/${token}`);
  await expect(page.getByText('Shared report')).toBeVisible();
  await expect(page.getByRole('img', { name: 'octocat' })).toBeVisible();
  await expect(page.getByText('Smart Summary')).toBeVisible();
  await expect(page.getByText('Generated with')).toBeVisible();

  // Force expiry directly in the DB, then reload.
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await pool!.query(
    `UPDATE share_links SET expires_at = now() - interval '1 hour' WHERE token_hash = $1`,
    [tokenHash]
  );

  await page.reload();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Share link unavailable');
  await expect(alert).toContainText(/expired|revoked/);
});

test('candidates API: save with note, list, delete', async ({ page }) => {
  await awaitFreeRateSlots(3); // this test: POST + GET + DELETE
  await page.goto('/');
  const save = await page.evaluate(async () => {
    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        github_username: 'octocat',
        note: 'Strong Ruby signal',
      }),
    });
    return res.json();
  });
  expect(save.ok).toBe(true);
  expect(save.data.item.github_username).toBe('octocat');
  expect(save.data.item.note).toBe('Strong Ruby signal');

  const list = await page.evaluate(async () => {
    const res = await fetch('/api/candidates');
    return res.json();
  });
  const item = list.data.items.find(
    (i: { github_username: string }) => i.github_username === 'octocat'
  );
  expect(item).toBeTruthy();

  // Known test boundary: /saved gates on the UI session (the browser has no
  // real session cookie), so it shows the sign-in CTA rather than the list.
  // Real-session UI is covered post-deploy with real OAuth.
  await page.goto('/saved');
  await expect(page.getByText('Sign in to save candidates.')).toBeVisible();

  const deleted = await page.evaluate(async (id) => {
    const res = await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
    return res.json();
  }, item.id);
  expect(deleted.data.deleted).toBe(true);
});

test('history API returns the persisted report entry', async ({ page }) => {
  await awaitFreeRateSlots(1); // this test: 1 history GET
  await page.goto('/');
  const history = await page.evaluate(async () => {
    const res = await fetch('/api/history');
    return res.json();
  });

  expect(history.ok).toBe(true);
  const item = history.data.items.find(
    (i: { github_username: string }) => i.github_username === 'octocat'
  );
  expect(item).toBeTruthy();
  expect(item.overall).toBeGreaterThanOrEqual(0);
  expect(item.overall).toBeLessThanOrEqual(10);
  expect(typeof item.hireability).toBe('string');
  expect(item.hireability).toBe('Junior Ready');

  // Same UI-session boundary as /saved.
  await page.goto('/history');
  await expect(page.getByText('Sign in to see your report history.')).toBeVisible();
});
