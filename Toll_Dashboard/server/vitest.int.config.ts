import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/int/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 20000,
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
