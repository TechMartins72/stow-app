import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["engine/**/*.test.ts", "mock-gateway/**/*.test.ts", "db/**/*.test.ts", "app/**/*.test.ts"],
    environment: "node",
  },
});
