import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || '/',
  plugins: [react()],
  build: { license: { fileName: 'THIRD_PARTY_LICENSES.md' } },
  test: { include: ['src/**/*.test.ts'] },
});
