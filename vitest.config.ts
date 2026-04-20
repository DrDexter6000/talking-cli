import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'benchmark/**/*.test.ts'],
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
  },
});
