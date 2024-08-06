import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: ['./setupFiles/jest.ts'],
        globals: true,
    },
});
