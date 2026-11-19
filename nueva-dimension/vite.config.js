import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative base: the build works from any folder or subdomain (staging).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        es: resolve(import.meta.dirname, 'index.html'),
        ca: resolve(import.meta.dirname, 'ca/index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
      },
    },
  },
});
