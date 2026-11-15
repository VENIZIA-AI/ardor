import { IgnisArtifactsVitePlugin } from '@venizia/ignis-boot/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Builds the class list of src/ into the bundle, so a decorated class is bound without being imported.
  plugins: [IgnisArtifactsVitePlugin.create(), react()],
  resolve: { alias: { '@': '/src' } },
  server: { proxy: { '/api': 'http://127.0.0.1:3100' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:3100' } },
  build: {
    rolldownOptions: {
      output: {
        // Runs each module after the modules it imports: a split chunk can otherwise run a DI package
        // before reflect-metadata, and the built app fails with `Reflect.getMetadata is not a function`.
        strictExecutionOrder: true,
        // React gets a chunk of its own. A catch-all `vendor` group would put the libraries of lazy
        // routes into a chunk the first screen loads.
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
});
