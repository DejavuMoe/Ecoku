<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import Ecoku from 'ecoku'

const route = useRoute()
const { page } = useData()
const container = ref<HTMLElement | null>(null)
let comments: Ecoku | null = null

onMounted(() => {
  if (!container.value) return
  comments = new Ecoku({
    container: container.value,
    serverURL: 'https://ecoku-dev.zsh.moe/',
    siteId: 'ecoku-docs',
    pageKey: route.path,
    pageTitle: page.value.title,
    theme: 'auto',
  })
  comments.init().catch((error) => console.error('Ecoku comments failed to mount:', error))
})

watch(
  () => [route.path, page.value.title] as const,
  ([path, title]) => {
    comments?.setPageKey(path, title).catch((error) => console.error('Ecoku comments failed to change page:', error))
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  comments?.destroy()
  comments = null
})
</script>

<template>
  <section class="ecoku-doc-comments" aria-label="评论区">
    <div ref="container"></div>
  </section>
</template>
