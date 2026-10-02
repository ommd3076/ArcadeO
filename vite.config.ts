import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const workerPort = Number(process.env.ARCADE_WORKER_PORT || 8787);
if (!Number.isInteger(workerPort) || workerPort < 1 || workerPort > 65535) {
  throw new Error("ARCADE_WORKER_PORT must be a valid TCP port");
}

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
        target: `http://127.0.0.1:${workerPort}`,
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
