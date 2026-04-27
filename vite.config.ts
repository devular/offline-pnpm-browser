import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: { port: 54321, host: '0.0.0.0' },
  resolve: {
    alias: {
      '@root': resolve(import.meta.dirname, 'src'),
      '@generated': resolve(import.meta.dirname, 'generated'),
    },
  },
  plugins: [react()],
});
