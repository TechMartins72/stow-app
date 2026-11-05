import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["engine/**/*.test.ts", "mock-gateway/**/*.test.ts", "db/**/*.test.ts"],
    environment: "node",
  },
});
