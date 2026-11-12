import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'

// Runs after the library build. The server compares this hash with the file it
// serves and only then marks ecoku.umd.js?v=<hash> as immutable.
const sdk = readFileSync(resolve(import.meta.dirname, 'dist/ecoku.umd.js'))
const sdkHash = createHash('sha256').update(sdk).digest('hex').slice(0, 12)

export default defineConfig({
  define: {
    __ECOKU_SDK_HASH__: JSON.stringify(sdkHash),
  },
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
