import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: ['es2020', 'safari14']
  }
});
