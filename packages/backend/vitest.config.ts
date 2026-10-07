import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "edge-runtime", testTimeout: 10_000, server: { deps: { inline: ["convex-test"] } } },
});
