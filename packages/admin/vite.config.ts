import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig(() => {
  const developmentApiTarget = process.env.ECOKU_ADMIN_DEV_API_URL?.trim()

  return {
    base: '/admin/',
    plugins: [svelte()],
    resolve: { conditions: ['browser'] },
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
