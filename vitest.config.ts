import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(import.meta.dirname),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client/src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  test: {
    environment: "jsdom",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/**/*.test.ts",
      "client/**/*.test.tsx",
      "tests/**/*.test.ts",
    ],
    setupFiles: ['client/src/test/setup.ts'],
    globals: true,
  },
});
