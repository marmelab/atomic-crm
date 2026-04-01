import path from "node:path";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import createHtmlPlugin from "vite-plugin-simple-html";
import { VitePWA } from "vite-plugin-pwa";

const shouldAnalyzeBundle = process.env.BUNDLE_ANALYZE === "true";
const shouldGenerateSourceMaps = process.env.BUILD_SOURCEMAP === "true";

const vendorDomainRules: Array<{
  chunk: string;
  match: (pkg: string) => boolean;
}> = [
  {
    chunk: "vendor-react",
    match: (pkg) =>
      pkg === "react" ||
      pkg === "react-dom" ||
      pkg === "react-router" ||
      pkg === "react-router-dom" ||
      pkg === "scheduler" ||
      pkg === "use-sync-external-store",
  },
  {
    chunk: "vendor-ra",
    match: (pkg) =>
      pkg.startsWith("ra-") ||
      pkg === "redux" ||
      pkg === "redux-thunk" ||
      pkg === "react-redux" ||
      pkg === "reselect" ||
      pkg === "@reduxjs/toolkit",
  },
  {
    chunk: "vendor-radix",
    match: (pkg) =>
      pkg.startsWith("@radix-ui/") ||
      pkg.startsWith("@floating-ui/") ||
      pkg === "radix-ui" ||
      pkg === "cmdk" ||
      pkg === "vaul",
  },
  {
    chunk: "vendor-query",
    match: (pkg) => pkg.startsWith("@tanstack/"),
  },
  {
    chunk: "vendor-supabase",
    match: (pkg) => pkg.startsWith("@supabase/") || pkg === "postgrest-js",
  },
  {
    chunk: "vendor-pdf-react-renderer",
    match: (pkg) => pkg === "@react-pdf/renderer",
  },
  {
    chunk: "vendor-pdf-react-reconciler",
    match: (pkg) => pkg === "@react-pdf/reconciler",
  },
  {
    chunk: "vendor-pdf-react-layout",
    match: (pkg) => pkg === "@react-pdf/layout",
  },
  {
    chunk: "vendor-pdf-react-pdfkit",
    match: (pkg) => pkg === "@react-pdf/pdfkit" || pkg === "@react-pdf/png-js",
  },
  {
    chunk: "vendor-pdf-react-render",
    match: (pkg) => pkg === "@react-pdf/render",
  },
  {
    chunk: "vendor-pdf-react-text",
    match: (pkg) =>
      pkg === "@react-pdf/textkit" ||
      pkg === "@react-pdf/font" ||
      pkg === "@react-pdf/image" ||
      pkg === "@react-pdf/stylesheet" ||
      pkg === "@react-pdf/primitives" ||
      pkg === "@react-pdf/fns",
  },
  {
    chunk: "vendor-pdf-react-support",
    match: (pkg) => pkg.startsWith("@react-pdf/"),
  },
  {
    chunk: "vendor-pdf-runtime",
    match: (pkg) =>
      pkg === "pdfkit" ||
      pkg === "clone" ||
      pkg === "png-js" ||
      pkg === "brotli" ||
      pkg === "crypto-js" ||
      pkg === "pako",
  },
  {
    chunk: "vendor-pdf-font",
    match: (pkg) =>
      pkg === "fontkit" ||
      pkg === "linebreak" ||
      pkg === "restructure" ||
      pkg === "unicode-properties" ||
      pkg === "unicode-trie" ||
      pkg === "hyphen",
  },
  {
    chunk: "vendor-pdf-layout",
    match: (pkg) =>
      pkg === "yoga-layout" || pkg === "jay-peg" || pkg === "media-engine",
  },
  {
    chunk: "vendor-charts",
    match: (pkg) =>
      pkg === "recharts" ||
      pkg === "@nivo/bar" ||
      pkg.startsWith("d3-") ||
      pkg === "internmap" ||
      pkg === "victory-vendor",
  },
  {
    chunk: "vendor-dnd",
    match: (pkg) =>
      pkg === "@hello-pangea/dnd" ||
      pkg === "css-box-model" ||
      pkg === "raf-schd",
  },
  {
    chunk: "vendor-ui",
    match: (pkg) =>
      pkg === "lucide-react" ||
      pkg === "sonner" ||
      pkg === "class-variance-authority" ||
      pkg === "tailwind-merge" ||
      pkg === "clsx" ||
      pkg === "next-themes" ||
      pkg === "tw-animate-css",
  },
  {
    chunk: "vendor-upload",
    match: (pkg) =>
      pkg === "react-dropzone" ||
      pkg === "file-selector" ||
      pkg === "attr-accept" ||
      pkg === "react-cropper" ||
      pkg === "cropperjs",
  },
  {
    chunk: "vendor-markdown",
    match: (pkg) => pkg === "dompurify" || pkg === "marked",
  },
  {
    chunk: "vendor-lodash",
    match: (pkg) => pkg === "lodash",
  },
  {
    chunk: "vendor-forms",
    match: (pkg) => pkg === "react-hook-form" || pkg === "zod",
  },
  {
    chunk: "vendor-date",
    match: (pkg) => pkg === "date-fns",
  },
];

const getNodeModulePackageName = (normalizedId: string) => {
  const marker = "/node_modules/";
  const markerIndex = normalizedId.lastIndexOf(marker);
  if (markerIndex === -1) return null;

  const modulePath = normalizedId.slice(markerIndex + marker.length);
  const segments = modulePath.split("/");
  if (segments[0]?.startsWith("@")) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : segments[0];
  }

  return segments[0] ?? null;
};

const getManualChunk = (id: string) => {
  const normalizedId = id.replaceAll("\\", "/");
  if (normalizedId.includes("/src/lib/semantics/")) return "app-semantics";

  const packageName = getNodeModulePackageName(normalizedId);
  if (!packageName) return undefined;

  const groupedChunk = vendorDomainRules.find((rule) =>
    rule.match(packageName),
  );
  if (groupedChunk) return groupedChunk.chunk;

  return "vendor-misc";
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(shouldAnalyzeBundle
      ? [
          visualizer({
            open: process.env.NODE_ENV !== "CI",
            filename: "./dist/stats.html",
          }),
        ]
      : []),
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
      },
      manifest: false, // Use existing manifest.json from public/
    }),
  ],
  define:
    process.env.NODE_ENV === "production" && process.env.VITE_SUPABASE_URL
      ? {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
            process.env.VITE_SUPABASE_URL,
          ),
          "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify(
            process.env.VITE_SB_PUBLISHABLE_KEY,
          ),
          "import.meta.env.VITE_INBOUND_EMAIL": JSON.stringify(
            process.env.VITE_INBOUND_EMAIL,
          ),
        }
      : undefined,
  base: "./",
  esbuild: {
    keepNames: true,
  },
  build: {
    sourcemap: shouldGenerateSourceMaps,
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.js"],
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router"),
    },
  },
});
