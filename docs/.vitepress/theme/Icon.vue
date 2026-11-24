<script setup lang="ts">
import { computed } from 'vue'
import { icons } from './icons'

const props = withDefaults(defineProps<{ name: string, size?: number | string }>(), { size: 20 })
const markup = computed(() => icons[props.name] ?? '')
</script>

<template>
  <svg
    class="ek-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="markup"
  />
</template>
