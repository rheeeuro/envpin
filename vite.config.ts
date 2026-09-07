import { defineConfig } from 'vitest/config';
export default defineConfig({ build: { modulePreload: { polyfill: false }, rollupOptions: { input: { popup: 'popup.html', background: 'src/background.ts' }, output: { entryFileNames: '[name].js' } } }, test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] } });
