import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import createHtmlPlugin from "vite-plugin-simple-html";
import { runtimeConfig } from "./scripts/renderRuntimeConfig.ts";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeConfig(),
    visualizer({
      open: process.env.NODE_ENV !== "CI",
      filename: "./dist/stats.html",
    }),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          mainScript: `src/main.tsx`,
        },
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        // config.js is rewritten at deploy time: a precached copy would go stale.
        globIgnores: ["**/node_modules/**/*", "config.js"],
        // It blocks the app's startup: on a stalled network, fall back to the
        // cached copy instead of waiting for the request to fail.
        runtimeCaching: [
          {
            urlPattern: /\/config\.js$/,
            handler: "NetworkFirst",
            options: { networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: false, // Use existing manifest.json from public/
    }),
  ],
  base: "./",
  build: {
    rolldownOptions: {
      output: {
        keepNames: true,
      },
    },
    sourcemap: true,
  },
  resolve: {
    preserveSymlinks: true,
    dedupe: ["react-router", "react-router-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
