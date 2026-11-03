import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = path.join(__dirname, "..", "..", "api");

// Vercel deploys every .js file in api/ as a standalone serverless function.
// Files that export a bare expressive Router crash at invocation
// ("argument callback is required" -> FUNCTION_INVOCATION_FAILED like the
// Nov 2026 /api/history + /api/candidates production outage: the router gets
// called as handler(req, res) with no `next`). Only the composed Express app
// may live here; feature routers belong under lib/.
describe("api/ deployable-entry guard", () => {
  it("api/ contains only the single serverless entry (index.js)", () => {
    const files = fs
      .readdirSync(API_DIR)
      .filter((f) => f.endsWith(".js") || f.endsWith(".cjs"));
    expect(files).toEqual(["index.js"]);
  });

  it("api/index.js exports a callable handler", async () => {
    // Remove any env influence from earlier suites, then require the module.
    const mod = await import("../../api/index.js");
    const app = mod.default ?? mod;
    expect(typeof app).toBe("function");
  });
});
