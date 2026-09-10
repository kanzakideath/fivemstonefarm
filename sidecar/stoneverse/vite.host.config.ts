import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/farmHostEntry.ts',
      formats: ['es'],
      fileName: () => 'stoneverse-host.js',
    },
    outDir: 'dist-host',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false,
  },
});
