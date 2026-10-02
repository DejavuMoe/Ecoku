import { defineConfig } from 'vitepress'
import { shared } from './shared'
import { zh } from './zh'
import { zhHant } from './zh-hant'
import { en } from './en'

export default defineConfig({
  ...shared,
  vite: {
    server: {
      host: '127.0.0.1',
      port: 7621,
      strictPort: false,
    },
  },
  locales: {
    root: { label: '简体中文', lang: 'zh-Hans', ...zh },
    'zh-hant': { label: '繁體中文', lang: 'zh-Hant', ...zhHant },
    en: { label: 'English', lang: 'en', ...en },
  },
})
