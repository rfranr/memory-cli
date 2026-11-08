import { defineConfig } from "vitest/config";

// Bundled Skills own their test runners; application verification stays in test/.
export default defineConfig({
  test: { include: ["test/**/*.test.{ts,mjs}"] },
});
