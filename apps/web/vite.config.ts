import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@kitsumy/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
      },
    },
    server: {
      port: parseInt(env.VITE_PORT!, 10),
    },
  };
});

