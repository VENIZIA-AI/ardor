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
          // React gets a chunk of its own. There is no catch-all `vendor` group: it put the libraries of
          // lazy routes into a chunk the first screen loads (+56 to +117% gzip on the two largest of six
          // measured apps, a 6.5 MB chunk); the react group alone costs about 4%. The guide has the opt-in.
          codeSplitting: {
            groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
          },
        },
      },
    },
  };
});
