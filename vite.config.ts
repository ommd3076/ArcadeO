import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/planning/**", "**/assets/**", "**/.local/**", "**/.wrangler/**"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: false,
        ws: true,
      },
    },
  },
  build: {
    manifest: true,
    outDir: "dist/client",
    emptyOutDir: true,
  },
  test: {
    exclude: ["assets/**", "node_modules/**", "tests/browser/**", "tests/runtime/**", "tests/workers/**"],
  },
});
