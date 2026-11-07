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
          // Runs each module after the modules it imports: a split chunk can otherwise run a DI package
          // before reflect-metadata (vitejs/vite#21866). It costs about 3% of the gzip size of a small app
          // and 3 to 20% of the first screen of an app with more than a thousand chunks: keep it on, or
          // measure (the Vite setup guide).
          strictExecutionOrder: true,
          // React gets a chunk of its own. `vendor` takes the modules that two chunks or more import,
          // so the library that only a lazy route needs stays with that route and the first screen
          // does not load it. Without `minShareCount` it takes every module under node_modules into one
          // chunk the first screen loads, 11 to 119% more gzip on six measured apps. A small app with
          // few lazy routes may drop `minShareCount` to cache the vendor code across a deploy (the Vite
          // setup guide).
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'vendor', test: /node_modules/, minShareCount: 2 },
            ],
          },
        },
      },
    },
  };
});
