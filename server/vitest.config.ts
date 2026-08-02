import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    // Integration tests hit the running server
    include: ['tests/**/*.test.ts'],
  },
});
