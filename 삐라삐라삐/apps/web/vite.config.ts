import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/v1': 'http://localhost:4200',
      '/health': 'http://localhost:4200',
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
