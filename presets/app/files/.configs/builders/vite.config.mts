import tailwindcss from '@tailwindcss/vite';
import { IgnisArtifactsVitePlugin } from '@venizia/ignis-boot/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // The backend app `vulcan add --api` chose, unless .env sets API_URL; empty when there is none, and
  // then nothing is proxied.
  const apiUrl: string = env.API_URL || '{{apiUrl}}';
  const proxy: Record<string, string> = apiUrl === '' ? {} : { '/api': apiUrl };

  return {
    // The app's own files are in src/, index.html included, so nothing but .configs/, src/, package.json,
    // tsconfig.json and .env.example sits at the app root; `.env` files are read from that root.
    root: 'src',
    envDir: '..',
    // Builds the class list of src/ into the bundle, so a decorated class is bound without being imported.
    plugins: [IgnisArtifactsVitePlugin.create({ root: 'src' }), react(), tailwindcss()],
    server: {
      port: Number(env.PORT || '{{devPort}}'),
      strictPort: true,
      proxy,
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rolldownOptions: {
        output: {
          // Runs every module after the modules it imports. Without it a split chunk can run a DI package
          // before reflect-metadata and fail on Reflect.getMetadata (vitejs/vite#21866). It adds about 3%
          // to the gzip size of the vendor chunk: keep it on.
          strictExecutionOrder: true,
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
