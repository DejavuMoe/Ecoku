import { copyFile } from 'node:fs/promises'

await copyFile(new URL('../dist/ecoku.umd.js', import.meta.url), new URL('../dist/ecoku.cjs', import.meta.url))
