import { IgnisArtifactsVitePlugin } from '@venizia/ignis-boot/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiUrl = '{{apiUrl}}';

  return {
    // Builds the class list of src/ into the bundle, so a decorated class is bound without being imported.
    plugins: [IgnisArtifactsVitePlugin.create(), react()],
    resolve: { alias: { '@': '/src' } },
    server: {
      port: Number(env.PORT ?? '{{devPort}}'),
      strictPort: true,
      proxy: { '/api': apiUrl },
    },
  };
});
