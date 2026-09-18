import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import createHtmlPlugin from "vite-plugin-simple-html";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: true,
  },
  plugins: [
    react(),
    tailwindcss(),
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
    // A whole acceptance round was spent on fixes that were deployed and
    // correct while the browser in front of Leif kept serving an older
    // cached shell — the report said "fixed", the screen said otherwise,
    // and neither of us could tell which build was on screen.
    //
    // autoUpdate alone installs the new service worker but lets an
    // already-open tab keep the assets it started with. skipWaiting and
    // clientsClaim make the new worker take over open clients as soon as
    // it installs, so a deploy reaches an open tab on its next navigation
    // instead of whenever every tab happens to close.
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        skipWaiting: true,
        clientsClaim: true,
        // Never serve a stale index.html: the shell is what decides which
        // hashed chunks load, so a stale one pins every other stale asset.
        cleanupOutdatedCaches: true,
      },
      manifest: false, // Use existing manifest.json from public/
    }),
  ],
  define:
    process.env.NODE_ENV === "production" && process.env.VITE_SUPABASE_URL
      ? {
          "import.meta.env.VITE_IS_DEMO": JSON.stringify(
            process.env.VITE_IS_DEMO,
          ),
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
            process.env.VITE_SUPABASE_URL,
          ),
          "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify(
            process.env.VITE_SB_PUBLISHABLE_KEY,
          ),
          "import.meta.env.VITE_INBOUND_EMAIL": JSON.stringify(
            process.env.VITE_INBOUND_EMAIL,
          ),
          "import.meta.env.VITE_ATTACHMENTS_BUCKET": JSON.stringify(
            process.env.VITE_ATTACHMENTS_BUCKET,
          ),
        }
      : undefined,
  base: "./",
  esbuild: {
    keepNames: true,
  },
  build: {
    sourcemap: true,
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // @hello-pangea/dnd (the Opportunities Kanban board) is only ever
    // reached through deals/index.ts's React.lazy(() => import("./DealList")),
    // so Vite's dependency crawler never discovers it at server start — only
    // on first navigation to /deals, which forces an on-demand re-optimize
    // and hands the in-flight lazy chunk a second, mismatched React module
    // graph ("Invalid hook call" / "Failed to fetch dynamically imported
    // module"). Listing it here makes Vite pre-bundle it eagerly instead.
    include: ["@hello-pangea/dnd"],
  },
});
