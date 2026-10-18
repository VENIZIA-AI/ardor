import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// IGNIS `examples/vert` serves its API under /api on :3000 (see its .env.example).
const API_URL = 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  server: { proxy: { '/api': API_URL } },
  preview: { proxy: { '/api': API_URL } },
  build: {
    rolldownOptions: {
      output: {
        // React, react-admin and the router weigh about 500 KB before any application code. Two
        // vendor chunks keep the application's own chunk small and cacheable across a deploy.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
});
