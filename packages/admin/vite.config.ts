import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig(() => {
  const developmentApiTarget = process.env.ECOKU_ADMIN_DEV_API_URL?.trim()

  return {
    base: '/admin/',
    plugins: [vue()],
    server: developmentApiTarget
      ? {
          proxy: {
            '/api': {
              target: developmentApiTarget,
              changeOrigin: true,
            },
          },
        }
      : undefined,
    test: {
      environment: 'happy-dom',
      restoreMocks: true,
    },
  }
})
