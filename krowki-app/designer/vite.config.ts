import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist/app' },
  test: { environment: 'jsdom', alias: { konva: 'konva/lib/index.js' } },
} as any);
