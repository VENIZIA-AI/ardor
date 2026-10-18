import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  server: { proxy: { '/api': 'http://127.0.0.1:3100' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:3100' } },
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
