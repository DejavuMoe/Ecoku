import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'
import type { Theme } from 'vitepress'
import EcokuComments from './EcokuComments.vue'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'doc-after': () => h(EcokuComments),
  }),
} satisfies Theme
