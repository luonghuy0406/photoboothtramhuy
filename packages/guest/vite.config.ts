import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/photos': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    // Output will be served by the Fastify server
  },
});
