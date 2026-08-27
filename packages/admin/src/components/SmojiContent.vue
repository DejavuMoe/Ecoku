<script setup lang="ts">
import { computed } from 'vue'
import { tokenizeAdminSmoji } from '../smoji'

const props = withDefaults(defineProps<{
  content: string
  enabled: boolean
  manifestUrl: string
  compact?: boolean
}>(), { compact: false })

const tokens = computed(() => tokenizeAdminSmoji(props.content, props.enabled, props.manifestUrl))
</script>

<template>
  <span class="admin-smoji-content" :class="{ 'is-compact': compact }">
    <template v-for="(token, index) in tokens" :key="index">
      <span v-if="token.type === 'text'">{{ token.value }}</span>
      <img v-else class="admin-smoji-inline" :src="token.src" :alt="`[表情：${token.label}]`" loading="lazy" decoding="async" referrerpolicy="no-referrer">
    </template>
  </span>
</template>
