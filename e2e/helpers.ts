import type { Page } from '@playwright/test';

// DB-gated specs (signedin.spec.ts) only run when E2E_DATABASE_URL is set;
// playwright.config.ts passes it through to the API server as DATABASE_URL.
export const dbMode = Boolean(process.env.E2E_DATABASE_URL);

// Collects browser console errors ("error" severity only) and uncaught page
// errors via events, for the zero-noise assertions in analyze.spec.ts.
export function attachErrorCollector(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  // Chromium's "Failed to load resource: ..." console lines carry no URL, so
  // track failed responses separately and pair them with console lines by
  // status code when asserting.
  const failedResponses: { url: string; status: number }[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedResponses.push({ url: res.url(), status: res.status() });
    }
  });
  return {
    consoleErrors,
    pageErrors,
    // A "Failed to load resource: ... <status>" console line is EXPECTED when
    // it pairs with an observed failed response from an intentionally
    // degraded endpoint (zero-env get-session 503, unknown share token 404).
    // Each observed response excuses at most one console line.
    unexpectedConsoleErrors(
      allowed: { urlFragment: string; status: number }[]
    ): string[] {
      const pool = [...failedResponses];
      const isExpected = (msg: string): boolean => {
        const match =
          /^Failed to load resource: the server responded with a status of (\d+)/.exec(
            msg
          );
        if (!match) return false;
        const status = Number(match[1]);
        const idx = pool.findIndex(
          (r) =>
            r.status === status &&
            allowed.some(
              (a) => a.status === status && r.url.includes(a.urlFragment)
            )
        );
        if (idx === -1) return false;
        pool.splice(idx, 1);
        return true;
      };
      return consoleErrors.filter((msg) => !isExpected(msg));
    },
  };
}

// Fixture avatar_url values point at the real GitHub CDN; fulfilling them
// locally keeps e2e hermetic (no console noise / flake when offline).
export async function stubAvatars(page: Page) {
  await page.route('**/avatars.githubusercontent.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="12" fill="#7C3AED"/></svg>',
    })
  );
}

// ---------------------------------------------------------------------------
// Shared anon rate-limit budget.
//
// The whole suite runs against ONE API process from ONE client IP (the Vite
// dev proxy), so the 10/min anon limit on /api/* is a shared budget across
// spec files. Every /api response carries X-RateLimit-Remaining (free slots
// after this request) and X-RateLimit-Reset (seconds until the OLDEST hit in
// the window expires). Probes go through the same Vite proxy path the browser
// uses, so they observe the exact same per-IP bucket.
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Through the Vite dev proxy exactly like browser /api traffic ("localhost",
// not 127.0.0.1: Vite 8 binds localhost as IPv6 ::1 only, and the proxied
// requests must land in the same per-IP rate-limit bucket as the browser's).
const PROBE_URL = 'http://localhost:5173/api/share/none';

async function probe(): Promise<{ remaining: number; reset: number }> {
  const res = await fetch(PROBE_URL);
  return {
    remaining: Number(res.headers.get('x-ratelimit-remaining') ?? NaN),
    reset: Number(res.headers.get('x-ratelimit-reset') ?? 0),
  };
}

// Waits until at least `slots` rate-limit slots are free (the probe itself
// consumes one, so `slots` must be <= 9 with the default 10/min limit).
// X-RateLimit-Reset only reports the OLDEST hit's expiry, so when the window
// is crowded the only sound move is to wait out a full window: specs run
// back-to-back with workers: 1, so no other /api traffic arrives during the
// sleep and every pre-existing hit (probe included) ages out.
export async function awaitFreeRateSlots(slots: number) {
  for (;;) {
    const { remaining } = await probe();
    if (remaining >= slots) return;
    await sleep(65_000);
  }
}

// Waits until the window is provably empty so the next 10 requests all pass
// and the 11th is blocked. The newest competing hit is at most ~60s old
// (specs run back-to-back, workers: 1); 65s of silence clears everything,
// and no probe is issued afterwards so the window stays empty.
export async function drainRateLimitWindow() {
  await sleep(65_000);
}
