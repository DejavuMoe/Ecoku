<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  id?: string
  modelValue: string[]
  kind: 'email' | 'telegram'
  label: string
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const input = ref('')

function valid(value: string): boolean {
  return props.kind === 'telegram'
    ? /^-?\d{1,32}$/.test(value)
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

const invalid = computed(() => props.modelValue.some((value) => !valid(value)))

function add(raw: string) {
  const next = raw.split(/[，,\n]+/).map((value) => value.trim()).filter(Boolean)
  if (next.length) emit('update:modelValue', [...new Set([...props.modelValue, ...next])])
  input.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
    event.preventDefault()
    add(input.value)
  } else if (event.key === 'Backspace' && !input.value && props.modelValue.length) {
    remove(props.modelValue.length - 1)
  }
}

function handlePaste(event: ClipboardEvent) {
  const value = event.clipboardData?.getData('text') ?? ''
  if (/[，,\n]/.test(value)) {
    event.preventDefault()
    add(value)
  }
}

function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, current) => current !== index))
}

defineExpose({ invalid })
</script>

<template>
  <div class="chip-field" :aria-invalid="invalid" :aria-disabled="disabled" @click="($event.currentTarget as HTMLElement).querySelector('input')?.focus()">
    <span
      v-for="(value, index) in modelValue"
      :key="`${value}-${index}`"
      class="chip"
      :class="{ 'is-invalid': !valid(value) }"
    >
      <span class="chip-text" :title="value">{{ value }}</span>
      <button class="chip-remove" type="button" :aria-label="`移除 ${value}`" :disabled="disabled" @click.stop="remove(index)">×</button>
    </span>
    <input
      :id="id"
      v-model="input"
      type="text"
      autocomplete="off"
      :aria-label="label"
      :disabled="disabled"
      @keydown="handleKeydown"
      @paste="handlePaste"
      @blur="input.trim() && add(input)"
    >
  </div>
  <p v-if="invalid" class="field-error">{{ kind === 'email' ? '邮箱格式错误' : '接收目标 ID 格式错误' }}</p>
</template>
