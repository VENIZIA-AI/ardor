import { IgnisArtifactsVitePlugin } from '@venizia/ignis-boot/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // The backend app `vulcan add --api` chose; empty when there is none, and then nothing is proxied.
  const apiUrl: string = '{{apiUrl}}';
  const proxy: Record<string, string> = apiUrl === '' ? {} : { '/api': apiUrl };

  return {
    // Builds the class list of src/ into the bundle, so a decorated class is bound without being imported.
    plugins: [IgnisArtifactsVitePlugin.create(), react()],
    server: {
      port: Number(env.PORT ?? '{{devPort}}'),
      strictPort: true,
      proxy,
    },
    build: {
      rolldownOptions: {
        output: {
          // React, react-admin and the router weigh about 500 KB before any application code. Two
          // vendor chunks keep the application's own chunk small, cacheable across a deploy, and
          // under Vite's 500 KB warning.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'vendor', test: /node_modules/ },
            ],
          },
        },
      },
    },
  };
});
