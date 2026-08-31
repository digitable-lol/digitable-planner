import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-v2.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (asset) => asset.names.some((name) => name.endsWith('.css')) ? 'assets/app-v2.css' : 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'node',
    coverage: { reporter: ['text', 'json-summary'] },
  },
})
