<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import Icon from './Icon.vue'

const props = defineProps<{ title: string, link: string, icon?: string }>()
const { localeIndex } = useData()

// Links are written without the locale prefix so translated pages can reuse them.
const href = computed(() => {
  if (/^https?:/.test(props.link)) return props.link
  const prefix = localeIndex.value === 'root' ? '' : `/${localeIndex.value}`
  return withBase(`${prefix}${props.link}`)
})
const external = computed(() => /^https?:/.test(props.link))
</script>

<template>
  <a class="ek-card" :href="href" :target="external ? '_blank' : undefined" :rel="external ? 'noreferrer' : undefined">
    <span v-if="icon" class="ek-card-icon"><Icon :name="icon" :size="18" /></span>
    <span class="ek-card-body">
      <span class="ek-card-title">{{ title }}</span>
      <span class="ek-card-text"><slot /></span>
    </span>
  </a>
</template>
