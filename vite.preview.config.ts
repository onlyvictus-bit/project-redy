import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const sharedPath = fileURLToPath(new URL('./src/shared', import.meta.url));
const rendererPath = fileURLToPath(new URL('./src/renderer/src', import.meta.url));

export default defineConfig({
  root: './src/renderer',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': sharedPath,
      '@renderer': rendererPath
    }
  },
  server: {
    port: 5199
  }
});
