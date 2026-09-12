import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// IGNIS `examples/vert` serves its API under /api on :3000 (see its .env.example).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
});
