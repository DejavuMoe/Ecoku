<script setup lang="ts">
export type AdminIconName = 'refresh' | 'chevron' | 'left' | 'right' | 'sort' | 'external' | 'check' | 'alert' | 'plus' | 'comments' | 'sites' | 'notify' | 'security'

defineProps<{ name: AdminIconName }>()

const paths: Record<AdminIconName, string[]> = {
  refresh: ['M13.5 8a5.5 5.5 0 1 1-1.6-3.9', 'M13.5 2.5v3h-3'],
  chevron: ['m4 6 4 4 4-4'],
  left: ['m10 3.5-4.5 4.5 4.5 4.5'],
  right: ['m6 3.5 4.5 4.5L6 12.5'],
  sort: ['M5 3v10M2.5 10.5 5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5'],
  external: ['M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3'],
  check: ['m3 8.5 3 3 7-7'],
  alert: ['M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Z', 'M8 5v3.5M8 11v.01'],
  plus: ['M8 3v10M3 8h10'],
  comments: ['M3 4.5h10v7H7.5L5 14v-2.5H3z', 'M5.5 7h5M5.5 9.5h3.5'],
  sites: ['M2.5 4h11v8h-11z', 'M2.5 7h11', 'M5 5.5h.01M7 5.5h.01'],
  notify: ['M4.5 11.5h7L10.5 10V7a2.5 2.5 0 0 0-5 0v3z', 'M6.5 13h3'],
  security: ['M8 2.5 13 4.3v3.9c0 3.1-2.1 5.4-5 6.5-2.9-1.1-5-3.4-5-6.5V4.3z', 'm5.8 8 1.5 1.5 3-3'],
}
</script>

<template>
  <svg class="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path v-for="d in paths[name]" :key="d" :d="d" /></svg>
</template>
