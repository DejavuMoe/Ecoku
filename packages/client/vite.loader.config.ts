import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/loader.ts'),
      name: 'EcokuLoader',
      formats: ['iife'],
      fileName: () => 'ecoku-loader.js',
    },
  },
})
