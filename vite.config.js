import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',

  server: {
    port:3005,
    host: '127.0.0.1',
  },

  build: {
    outDir: 'dist',
    target: 'es2022',
  },

  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
