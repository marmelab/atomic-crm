import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'node:path';

const alias = [
    {
        find: 'react-admin',
        replacement: path.resolve(__dirname, './node_modules/react-admin/src'),
    },
    {
        find: 'ra-core',
        replacement: path.resolve(__dirname, './node_modules/ra-core/src'),
    },
    {
        find: 'ra-i18n-polyglot',
        replacement: path.resolve(
            __dirname,
            './node_modules/ra-i18n-polyglot/src'
        ),
    },
    {
        find: 'ra-language-english',
        replacement: path.resolve(
            __dirname,
            './node_modules/ra-language-english/src'
        ),
    },
    {
        find: 'ra-ui-materialui',
        replacement: path.resolve(
            __dirname,
            './node_modules/ra-ui-materialui/src'
        ),
    },
    {
        find: 'ra-data-fakerest',
        replacement: path.resolve(
            __dirname,
            './node_modules/ra-data-fakerest/src'
        ),
    },
    {
        find: 'ra-supabase-core',
        replacement: path.resolve(
            __dirname,
            './node_modules/ra-supabase-core/src'
        ),
    },
    {
        find: 'ra-supabase-ui-materialui',
        replacement: path.resolve(
            __dirname,
            './node_modules/ra-supabase-ui-materialui/src'
        ),
    },
    {
        find: 'ra-supabase-language-english',
        replacement: path.resolve(
            __dirname,
            './node_modules/ra-supabase-language-english/src'
        ),
    },
    {
        find: 'ra-supabase',
        replacement: path.resolve(__dirname, './node_modules/ra-supabase/src'),
    },
    // add any other react-admin packages you have
];

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        visualizer({
            open: process.env.NODE_ENV !== 'CI',
            filename: './dist/stats.html',
        }),
    ],
    define: {
        'process.env': process.env,
    },
    base: './',
    esbuild: {
        keepNames: true,
    },
    build: {
        sourcemap: true,
    },
    resolve: {
        alias,
        preserveSymlinks: true,
    },
});
