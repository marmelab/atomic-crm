import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import createHtmlPlugin from "vite-plugin-simple-html";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      visualizer({
        open: env.NODE_ENV !== "CI",
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
    ],
    define:
      env.NODE_ENV === "production" && env.VITE_SUPABASE_URL
        ? {
            "import.meta.env.VITE_IS_DEMO": JSON.stringify(env.VITE_IS_DEMO),
            "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
              env.VITE_SUPABASE_URL,
            ),
            "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify(
              env.VITE_SB_PUBLISHABLE_KEY,
            ),
            "import.meta.env.VITE_INBOUND_EMAIL": JSON.stringify(
              env.VITE_INBOUND_EMAIL,
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
    server: {
      host: env.FRONTEND_HTTP_HOST === "true" ? true : env.FRONTEND_HTTP_HOST,
      port: env.FRONTEND_HTTP_PORT
        ? parseInt(env.FRONTEND_HTTP_PORT)
        : undefined,
      strictPort: !!env.FRONTEND_HTTP_PORT,
      origin: `http://0.0.0.0:${env.FRONTEND_HTTP_PORT}`,
      hmr: {
        port: env.FRONTEND_HMR_PORT
          ? parseInt(env.FRONTEND_HMR_PORT)
          : undefined,
      },
    },
    preview: {
      host: env.FRONTEND_HTTP_HOST,
      port: env.FRONTEND_HTTP_PORT
        ? parseInt(env.FRONTEND_HTTP_PORT)
        : undefined,
      strictPort: !!env.FRONTEND_HTTP_PORT,
    },
  };
});
