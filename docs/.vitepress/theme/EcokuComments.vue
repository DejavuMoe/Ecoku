<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import Ecoku from 'ecoku'
import { commentLanguage } from './comment-language'

const route = useRoute()
const { page, lang } = useData()
const container = ref<HTMLElement | null>(null)
let comments: Ecoku | null = null
let mountedLanguage = ''
const labels = { 'zh-CN': '评论区', 'zh-Hant': '評論區', en: 'Comments' } as const
const label = computed(() => labels[commentLanguage(lang.value)])

function mount() {
  if (!container.value) return
  mountedLanguage = commentLanguage(lang.value)
  comments = new Ecoku({
    container: container.value,
    serverURL: 'https://ecoku-dev.zsh.moe/',
    siteId: 'ecoku-docs',
    pageKey: route.path,
    pageTitle: page.value.title,
    theme: 'auto',
    i18n: mountedLanguage,
  })
  comments.init().catch((error) => console.error('Ecoku comments failed to mount:', error))
}

onMounted(mount)

watch(
  () => [route.path, page.value.title, lang.value] as const,
  ([path, title, language]) => {
    // The comment area's language is fixed at init; switching docs language remounts it.
    if (commentLanguage(language) !== mountedLanguage) {
      comments?.destroy()
      comments = null
      mount()
      return
    }
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
  <section class="ecoku-doc-comments" :aria-label="label">
    <div ref="container"></div>
  </section>
</template>
