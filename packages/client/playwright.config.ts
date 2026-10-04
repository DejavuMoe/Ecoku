import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './browser-tests',
  testMatch: '**/*.spec.ts',
  outputDir: '../../artifacts/client-storage',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 20_000,
  globalTimeout: 90_000,
  use: {
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
})
