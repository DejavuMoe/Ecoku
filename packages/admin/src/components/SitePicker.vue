<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'
import type { SiteSummary } from '../types'
import AdminIcon from './AdminIcon.vue'

defineProps<{ creating?: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
const { sites, selectedSite, selectedSiteId, siteBusy, actionBusy } = storeToRefs(useAdminStore())
const open = ref(false)
const picker = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
function label(site: SiteSummary | null): string {
  if (!site) return '没有可用站点'
  if (site.name) return site.name
  try { return new URL(site.siteUrl).hostname } catch { return site.id }
}
async function toggle() {
  open.value = !open.value
  if (open.value) { await nextTick(); menu.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus() }
}
function select(id: string) { open.value = false; emit('select', id); trigger.value?.focus() }
function outside(event: PointerEvent) { if (!picker.value?.contains(event.target as Node)) open.value = false }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); open.value = false; trigger.value?.focus(); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const options = [...(menu.value?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
  const index = options.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
  options[next]?.focus()
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="picker" class="site-switch">
    <div v-if="creating" class="site-static is-draft"><span class="site-name">新站点</span><span class="site-id">尚未保存</span></div>
    <button v-else-if="sites.length > 1" ref="trigger" class="site-trigger" type="button" aria-haspopup="listbox" :aria-expanded="open" :aria-label="`切换站点，当前 ${label(selectedSite)}`" :disabled="siteBusy || actionBusy" @click="toggle">
      <span class="site-name"><span>{{ label(selectedSite) }}</span><AdminIcon name="chevron" class="chevron" /></span><span class="site-id">{{ selectedSite?.id }}</span>
    </button>
    <div v-else class="site-static"><span class="site-name"><span>{{ label(selectedSite) }}</span></span><span v-if="selectedSite" class="site-id">{{ selectedSite.id }}</span></div>
    <div v-if="open" ref="menu" class="site-menu" role="listbox" aria-label="选择站点" @keydown="keydown">
      <button v-for="site in sites" :key="site.id" class="site-option" type="button" role="option" :aria-selected="selectedSiteId === site.id" @click="select(site.id)"><strong>{{ label(site) }}</strong><small>{{ site.id }}</small><AdminIcon name="check" class="check" /></button>
    </div>
  </div>
</template>
