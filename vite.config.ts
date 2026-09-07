import { defineConfig } from 'vitest/config';
export default defineConfig({ build: { rollupOptions: { input: { popup: 'popup.html', background: 'src/background.ts' }, output: { entryFileNames: '[name].js' } } }, test: { environment: 'node' } });
