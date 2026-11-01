import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { campaign } from './src/config/campaign';

// Vercel's build variables, so each deploy tags its own Sentry release and preview image.
const { VERCEL_GIT_COMMIT_SHA, VERCEL_PROJECT_PRODUCTION_URL } = process.env;
process.env.VITE_RELEASE ||= VERCEL_GIT_COMMIT_SHA ?? '';
process.env.VITE_SITE_URL ||= VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${VERCEL_PROJECT_PRODUCTION_URL}`
  : '';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'campaign-html',
      transformIndexHtml: (html) =>
        html
          .replaceAll('%GAME_TITLE%', campaign.gameTitle)
          .replaceAll('%TAGLINE%', campaign.tagline),
    },
  ],
  resolve: {
    alias: {
      '@sim': fileURLToPath(new URL('./supabase/functions/_shared/sim.ts', import.meta.url)),
    },
  },
  // public/assets is served at /assets, so hashed bundles get their own folder and cache rule.
  build: { assetsDir: 'bundle' },
  test: { include: ['tests/**/*.test.ts'] },
});
