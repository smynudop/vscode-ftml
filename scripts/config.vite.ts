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
    outDir: join(process.cwd(), 'dist'),
    assetsDir: '.',
    rollupOptions: {
      external: "vscode",
      output: {
        globals: {
          vscode: "vscode"
        },
        manualChunks: undefined,
        experimentalMinChunkSize: 10 * 1024 * 1024,
      }
    },
    lib: {
      entry: [
        resolve(__dirname, '../src/extension'),
      ],
      formats: ["cjs"],
      fileName: () => '[name].cjs',
    },

    sourcemap: true,
  },
});
