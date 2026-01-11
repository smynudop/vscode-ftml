import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  mode: process.env.MODE,
  base: './',
  root: join(process.cwd(), './src'),
  server: {
    port: 1212,
    fs: {
      strict: false,
      allow: ['./'],
    },
  },
  plugins: [
  ],
  build: {
    target: 'es2020',
    outDir: join(process.cwd(), 'dist_prebuild'),
    assetsDir: '.',
    rollupOptions: {
    },
    lib: {
      entry: [
        resolve(__dirname, '../src/webview/ftml.web.worker'),
        resolve(__dirname, '../src/webview/styles')
      ],
      formats: ["cjs"],
      fileName: () => '[name].cjs',
    },
    emptyOutDir: true,
    sourcemap: true,
  },
});
