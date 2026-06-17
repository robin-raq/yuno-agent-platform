import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: proxy API + MCP calls to the Fastify server. Prod: Fastify serves the built dist/.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/mcp': 'http://127.0.0.1:8080',
    },
  },
  build: { outDir: 'dist' },
});
