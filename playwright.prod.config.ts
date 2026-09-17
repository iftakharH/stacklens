import { defineConfig, devices } from '@playwright/test';

// Production-build smoke suite. Mirrors playwright.config.ts, but the frontend
// is the *built* bundle served by `vite preview` on :4173 with the same
// same-origin /api proxy production uses — the only way to catch build-only
// regressions (e.g. the relative-auth-baseURL blank page).
//
// Zero-env by default (no DATABASE_URL): the API serves /api/analyze plus the
// degraded 503 CONFIG_MISSING auth/feature responses, exactly like the dev e2e
// suite. Set E2E_DATABASE_URL to also exercise populated behaviour.

const apiEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  PORT: '4000',
  NODE_ENV: 'test',
  GITHUB_API_BASE: 'http://127.0.0.1:4999',
  RATE_LIMIT_AUTH_ROUTES: '100',
};

export default defineConfig({
  testDir: 'e2e',
  testMatch: /prod-smoke\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mock-github.mjs',
      url: 'http://127.0.0.1:4999/users/octocat',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node api/index.js',
      url: 'http://127.0.0.1:4000/health',
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Build first, then serve the built bundle. Playwright waits for the
      // :4173 URL, so the build completes before tests run.
      command:
        'npm run build --prefix frontend && npm run preview --prefix frontend',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
});
