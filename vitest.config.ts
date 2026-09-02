import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
  },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
});
