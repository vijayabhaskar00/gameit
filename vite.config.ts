import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@sim': fileURLToPath(new URL('./supabase/functions/_shared/sim.ts', import.meta.url)),
    },
  },
  // public/assets is served at /assets, so hashed bundles get their own folder and cache rule.
  build: { assetsDir: 'bundle' },
  test: { include: ['tests/**/*.test.ts'] },
});
