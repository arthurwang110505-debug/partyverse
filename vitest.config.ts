import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Next.js compiles JSX with the automatic runtime; tests must match it,
  // otherwise every `.tsx` under test would need a `React` import.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    globals: true,
    // `.tsx` tests render real components (jsdom via a per-file environment comment).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
