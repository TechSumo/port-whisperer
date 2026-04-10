import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Vite config for the port-whisperer dashboard SPA.
// Run from the web/ directory: `npm run web:dev` / `npm run web:build`.
// In dev mode, API calls proxy to the Hono backend on 7777.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:7777",
      "/events": "http://127.0.0.1:7777",
    },
  },
});
