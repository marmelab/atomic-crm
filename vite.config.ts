import path from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        visualizer({
            open: process.env.NODE_ENV !== 'CI',
            filename: './dist/stats.html',
        }),
    ],
    base: './',
    esbuild: {
        keepNames: true,
    },
    build: {
        sourcemap: true,
    },
    resolve: {
        preserveSymlinks: true,
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
