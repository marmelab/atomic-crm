import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import createHtmlPlugin from "vite-plugin-simple-html";
import { runtimeConfig } from "./scripts/renderRuntimeConfig.ts";

// https://vitejs.dev/config/
export default defineConfig({
  // Reads .env.demo
  mode: "demo",
  server: {
    port: 5174,
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
          mainScript: `demo/main.tsx`,
        },
      },
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
