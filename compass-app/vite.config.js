import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  root: './src',
  base: './',
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: './src/index.html'
    }
  },
  publicDir: '../public'
});
