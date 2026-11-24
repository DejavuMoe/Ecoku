<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useData, useRoute } from 'vitepress'
import Ecoku from 'ecoku'
import { commentLanguage } from './comment-language'

// A real Ecoku comment section on the home page, served by the same demo
// instance as the comment sections under each docs page.
const props = defineProps<{ address: string, title: string }>()
const route = useRoute()
const { lang } = useData()
const container = ref<HTMLElement | null>(null)
let comments: Ecoku | null = null

onMounted(() => {
  if (!container.value) return
  comments = new Ecoku({
    container: container.value,
    serverURL: 'https://ecoku-dev.zsh.moe/',
    siteId: 'ecoku-docs',
    pageKey: route.path,
    pageTitle: props.title,
    pageSize: 5,
    theme: 'auto',
    i18n: commentLanguage(lang.value),
  })
  comments.init().catch((error) => console.error('Ecoku demo failed to mount:', error))
})

onBeforeUnmount(() => {
  comments?.destroy()
  comments = null
})
</script>

<template>
  <div class="live-demo">
    <div class="live-demo-bar" aria-hidden="true">
      <span class="live-demo-dots"><i /><i /><i /></span>
      <span class="live-demo-address">{{ address }}</span>
    </div>
    <div class="live-demo-body ecoku-doc-comments-tokens">
      <div ref="container" />
    </div>
  </div>
</template>
