<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AdminIcon from './AdminIcon.vue'
import { rowIssue, splitPasted, type ListKind } from '../listInput'

// One input per item. Enter moves on to the next item, Backspace in an empty item removes it,
// pasting several lines fills one item each, and an item's problems show once the cursor leaves it.
// The model holds the trimmed, non-empty items, so a blank row never counts as a change.
const props = defineProps<{
  id: string
  modelValue: string[]
  kind: ListKind
  label: string
  addLabel: string
  placeholder?: string
  max?: number
  mono?: boolean
  inputmode?: 'url' | 'email' | 'text'
  requiredError?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

interface Row { key: number; value: string; committed: boolean }
let nextKey = 0
const rows = ref<Row[]>([])
const announcement = ref('')
const root = ref<HTMLElement | null>(null)

const blank = (): Row => ({ key: nextKey++, value: '', committed: false })
const filled = (list: readonly Row[]): string[] => list.map((row) => row.value.trim()).filter(Boolean)
function load(values: readonly string[]) {
  rows.value = values.length ? values.map((value) => ({ key: nextKey++, value, committed: true })) : [blank()]
}
load(props.modelValue)
// A new list from outside (a saved site, a discard) replaces the rows; echoes of our own edits do not.
watch(() => props.modelValue, (values) => {
  if (JSON.stringify(values) !== JSON.stringify(filled(rows.value))) load(values)
})

const full = computed(() => props.max !== undefined && rows.value.length >= props.max)
const count = computed(() => filled(rows.value).length)
const issues = computed(() => {
  const values = rows.value.map((row) => row.value)
  return rows.value.map((row, index) => (row.committed ? rowIssue(props.kind, values, index) : null))
})
const invalid = (index: number) => Boolean(issues.value[index] && !issues.value[index]!.soft) || (index === 0 && Boolean(props.requiredError))

function update() { emit('update:modelValue', filled(rows.value)) }
function announce(text: string) {
  announcement.value = ''
  void nextTick(() => { announcement.value = text })
}
async function focusRow(index: number) {
  await nextTick()
  const input = root.value?.querySelectorAll<HTMLInputElement>('.list-row input')[index]
  if (!input) return
  input.focus()
  input.setSelectionRange(input.value.length, input.value.length)
}
function commit(index: number) {
  const row = rows.value[index]
  if (row?.value.trim()) row.committed = true
}

function onInput(index: number, event: Event) {
  rows.value[index]!.value = (event.target as HTMLInputElement).value
  update()
}

function onKeydown(index: number, event: KeyboardEvent) {
  const row = rows.value[index]!
  if (event.key === 'Enter' && !event.isComposing) {
    // Enter starts the next item instead of submitting the form.
    event.preventDefault()
    commit(index)
    if (index + 1 < rows.value.length) { void focusRow(index + 1); return }
    if (!row.value.trim()) return
    if (full.value) { announce(`已达上限 ${props.max} 项`); return }
    rows.value.splice(index + 1, 0, blank())
    void focusRow(index + 1)
  } else if (event.key === 'Backspace' && !row.value && rows.value.length > 1) {
    event.preventDefault()
    rows.value.splice(index, 1)
    update()
    void focusRow(Math.max(0, index - 1))
  } else if (event.key === 'ArrowDown' && index + 1 < rows.value.length) {
    event.preventDefault(); void focusRow(index + 1)
  } else if (event.key === 'ArrowUp' && index > 0) {
    event.preventDefault(); void focusRow(index - 1)
  }
}

function onPaste(index: number, event: ClipboardEvent) {
  const parts = splitPasted(event.clipboardData?.getData('text') ?? '')
  if (parts.length < 2) return
  event.preventDefault()
  let at = index + 1
  if (!rows.value[index]!.value.trim()) { rows.value.splice(index, 1); at = index }
  const room = props.max === undefined ? parts.length : Math.max(0, props.max - rows.value.length)
  const taken = parts.slice(0, room)
  rows.value.splice(at, 0, ...taken.map((value) => ({ key: nextKey++, value, committed: true })))
  if (!rows.value.length) rows.value.push(blank())
  update()
  void focusRow(Math.max(0, at + taken.length - 1))
  const dropped = parts.length - taken.length
  announce(dropped ? `已添加 ${taken.length} 项；最多 ${props.max} 项，其余 ${dropped} 项未添加` : `已添加 ${taken.length} 项`)
}

function remove(index: number) {
  if (rows.value.length === 1) rows.value = [blank()]
  else rows.value.splice(index, 1)
  update()
  announce(`已删除第 ${index + 1} 项`)
  void focusRow(Math.min(index, rows.value.length - 1))
}

function add() {
  const last = rows.value.length - 1
  if (!rows.value[last]!.value.trim()) { void focusRow(last); return }
  if (full.value) return
  rows.value.push(blank())
  void focusRow(last + 1)
}

function applyFix(index: number, value: string) {
  const row = rows.value[index]!
  row.value = value
  row.committed = true
  update()
  announce(`已改为 ${value}`)
  void focusRow(index)
}

// Saving shows every item's problem, including items the cursor has not left yet.
function reveal() { for (const row of rows.value) if (row.value.trim()) row.committed = true }
defineExpose({ reveal })
</script>

<template>
  <div :id="id" ref="root" class="list-field">
    <!-- Buttons take the press without taking focus, so the item being edited is not blurred
         (and its error shown, shifting the layout) between press and release. -->
    <ul class="list-rows">
      <li v-for="(row, index) in rows" :key="row.key" class="list-row">
        <input
          :id="`${id}-${index}`"
          :value="row.value"
          class="input"
          :class="{ mono }"
          type="text"
          :inputmode="inputmode"
          autocomplete="off"
          spellcheck="false"
          :placeholder="index === 0 ? placeholder : undefined"
          :aria-label="`${label}，第 ${index + 1} 项`"
          :aria-invalid="invalid(index) ? 'true' : undefined"
          :aria-describedby="issues[index] ? `${id}-${index}-note` : undefined"
          @input="onInput(index, $event)"
          @keydown="onKeydown(index, $event)"
          @paste="onPaste(index, $event)"
          @blur="commit(index)"
        >
        <button class="row-remove" :class="{ 'is-idle': rows.length === 1 && !row.value }" type="button" :aria-label="`删除${label}第 ${index + 1} 项`" title="删除" @mousedown.prevent @click="remove(index)"><AdminIcon name="close" /></button>
        <p v-if="issues[index]" :id="`${id}-${index}-note`" class="row-note" :class="{ 'is-soft': issues[index]!.soft }">
          <span>{{ issues[index]!.text }}</span>
          <button v-if="issues[index]!.fix" class="row-fix" type="button" @mousedown.prevent @click="applyFix(index, issues[index]!.fix!)">改为 <span class="mono" translate="no">{{ issues[index]!.fix }}</span></button>
        </p>
      </li>
    </ul>
    <div class="list-foot">
      <button class="list-add" type="button" :disabled="full" @mousedown.prevent @click="add"><AdminIcon name="plus" /><span>{{ full ? `已达上限 ${max} 项` : addLabel }}</span></button>
      <span v-if="max !== undefined" class="list-count" aria-hidden="true">{{ count }}/{{ max }}</span>
    </div>
    <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
  </div>
</template>
