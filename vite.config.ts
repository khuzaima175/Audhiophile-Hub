import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { apoBridgePlugin } from './server/apoBridge';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '127.0.0.1',
    },
    plugins: [react(), apoBridgePlugin()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@google/genai')) return 'ai-sdk';
          },
        },
      },
    },
    envPrefix: 'AUDIOSAGE_PUBLIC_',
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(command === 'serve' ? env.VITE_GEMINI_API_KEY || '' : ''),
      'process.env.API_KEY': JSON.stringify(command === 'serve' ? env.GEMINI_API_KEY || '' : ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(command === 'serve' ? env.GEMINI_API_KEY || '' : ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
