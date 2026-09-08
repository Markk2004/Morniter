import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "node", passWithNoTests: true },
  resolve: { alias: { "@desktop": path.resolve(__dirname, "src") } },
});
