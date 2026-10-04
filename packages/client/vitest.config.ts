import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'browser-tests/**'],
    environment: 'happy-dom',
    clearMocks: true,
    restoreMocks: true,
  },
})
