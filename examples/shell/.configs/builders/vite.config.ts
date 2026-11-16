import { IgnisArtifactsVitePlugin } from '@venizia/ignis-boot/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Lists the decorated classes of src/ only: a feature package brings its own through `artifacts`.
  plugins: [IgnisArtifactsVitePlugin.create(), react()],
  resolve: { alias: { '@': '/src' } },
  server: { proxy: { '/api': 'http://127.0.0.1:3100' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:3100' } },
  build: {
    rolldownOptions: {
      output: {
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
