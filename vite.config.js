import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: 'esbuild',
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none'
  }
});
