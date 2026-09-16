import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

// Root JS (CommonJS app + ESM tooling). The frontend has its own config in
// frontend/eslint.config.js and is ignored here. e2e/ + playwright.config.ts
// are TypeScript and run under Playwright's own transpiler.
export default defineConfig([
  globalIgnores([
    "frontend/",
    "node_modules/",
    "dist/",
    "e2e/",
    "playwright.config.ts",
    "test-results/",
    "playwright-report/",
  ]),
  {
    // Server code: CommonJS (package.json "type": "commonjs").
    files: ["*.js", "api/**/*.js", "lib/**/*.js", "db/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      // Leading-underscore params/vars mark intentionally unused values
      // (Express middlewares: _req, _res, _next).
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // ESM tooling (vitest config, fixture/golden scripts).
    files: ["*.mjs", "scripts/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Tests: ESM (transformed by Vitest regardless of package type).
    files: ["test/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        // Vitest globals (most suites import these from "vitest", but
        // define them so any style works).
        afterAll: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        suite: "readonly",
        test: "readonly",
        vi: "readonly",
        vitest: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
