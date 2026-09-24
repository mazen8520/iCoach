import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: unit tests don't need the TanStack Start / Nitro build plugins.
export default defineConfig({
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
