import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: { port: 54321, host: '0.0.0.0' },
  resolve: {
    alias: {
      '@root': resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [tanstackStart(), react()],
});
