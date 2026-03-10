
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    base: '/',
    define: {
      // Expose API_KEY to the client-side code safely
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process for libraries that might expect it
      'process.env': process.env
    },
    server: {
      port: 3000,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false, // Disable sourcemap in production for security and speed
      chunkSizeWarningLimit: 1000,
    }
  };
});
