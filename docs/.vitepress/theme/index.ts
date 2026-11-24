import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'
import type { Theme } from 'vitepress'
import EcokuComments from './EcokuComments.vue'
import Icon from './Icon.vue'
import Card from './Card.vue'
import LiveDemo from './LiveDemo.vue'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'doc-after': () => h(EcokuComments),
  }),
  enhanceApp({ app }) {
    app.component('Icon', Icon)
    app.component('Card', Card)
    app.component('LiveDemo', LiveDemo)
  },
} satisfies Theme
