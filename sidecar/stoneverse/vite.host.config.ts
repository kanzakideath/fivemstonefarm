import { defineConfig } from 'vite';

export default defineConfig({
  // This library is loaded directly in WebView2, without a Node.js global.
  // Vite library mode preserves process.env unless explicitly replaced.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
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
