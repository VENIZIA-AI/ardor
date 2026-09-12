import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  server: { proxy: { '/api': 'http://127.0.0.1:3100' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:3100' } },
});
