import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Buduje moduł do osadzenia: jeden plik JS rejestrujący <krowka-designer>.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist/embed',
    lib: { entry: 'src/embed.tsx', name: 'KrowkaDesigner', formats: ['es'], fileName: () => 'krowka-designer.js' },
  },
});
