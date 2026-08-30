// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: './src',
  base: './',
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: './index.html'
    }
  }
});
