<script setup lang="ts">
withDefaults(defineProps<{ busy: boolean; errorCount?: number; status?: string; saveLabel?: string; discardLabel?: string }>(), {
  errorCount: 0, status: '有未保存的修改', saveLabel: '保存', discardLabel: '撤销修改',
})
defineEmits<{ save: []; discard: [] }>()
</script>

<template>
  <div class="savebar-dock layout">
    <div class="savebar in-main" :class="{ 'is-error': errorCount }" role="region" aria-label="保存修改">
      <p class="savebar-status" aria-live="polite"><span class="savebar-dot" aria-hidden="true" /><span>{{ errorCount ? `有 ${errorCount} 处需要修改` : status }}</span></p>
      <span class="savebar-actions">
        <button class="button button-quiet" type="button" :disabled="busy" @click="$emit('discard')">{{ discardLabel }}</button>
        <button class="button button-primary save-button" type="button" :disabled="busy" @click="$emit('save')">{{ busy ? '保存中…' : saveLabel }}</button>
      </span>
    </div>
  </div>
</template>
