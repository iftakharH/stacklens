import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.js", "test/integration/**/*.test.js"],
    testTimeout: 15000,
    // Files share a test database when TEST_DATABASE_URL is set (auth +
    // features suites both clean tables), so files must not run concurrently.
    fileParallelism: false,
  },
});
