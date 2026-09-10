import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    resolve: {
      alias: {
        "@": path.resolve(__dirname)
      }
    }
  }
});
