import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
    testTimeout: 15000,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/e2e-morniter/**", "**/desktop-agent/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
