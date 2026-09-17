import { defineConfig, devices } from '@playwright/test';

// DB detection is deliberately simple: when E2E_DATABASE_URL is set (e.g.
// the docker Postgres recipe from .env.example, after `npm run migrate`),
// the API server additionally gets DATABASE_URL + the TEST_SESSION_USER_ID
// override + auth config values, and e2e/signedin.spec.ts runs. Otherwise
// the suite runs in zero-env mode.

// Must match the fixed user row inserted by e2e/signedin.spec.ts.
const TEST_SESSION_USER_ID = '11111111-1111-4111-8111-111111111111';

const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? '';

const apiEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  PORT: '4000',
  // Enables the TEST_SESSION_USER_ID override in lib/session.js (test only).
  NODE_ENV: 'test',
  GITHUB_API_BASE: 'http://127.0.0.1:4999',
  // Session reads are unlimited, but mutating auth endpoints default to 30/min
  // for humans and the suite fires many sign-in attempts; raise it so auth
  // behaviour, not the limiter, is what these specs exercise. Same approach as
  // the vitest integration suite.
  RATE_LIMIT_AUTH_ROUTES: '100',
  ...(E2E_DATABASE_URL
    ? {
        DATABASE_URL: E2E_DATABASE_URL,
        TEST_SESSION_USER_ID,
        BETTER_AUTH_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
        GITHUB_CLIENT_ID: 'test',
        GITHUB_CLIENT_SECRET: 'test',
      }
    : {}),
};

export default defineConfig({
  testDir: 'e2e',
  // prod-smoke runs against the built bundle via playwright.prod.config.ts.
  testIgnore: /prod-smoke\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://localhost:5173' },
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
      command: 'npm run dev --prefix frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
