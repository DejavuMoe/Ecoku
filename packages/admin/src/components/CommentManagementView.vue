<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'
import { formatDate, safeWebsite } from '../ui'
import { smojiPlainText } from '../smoji'
import type { CommentReview, CommentStatus } from '../types'
import AdminIcon from './AdminIcon.vue'
import SitePicker from './SitePicker.vue'
import SmojiContent from './SmojiContent.vue'

const store = useAdminStore()
const { status, sort, page, pageCount, total, counts, comments, selectedComment, queueBusy, queueQuiet, actionBusy, queueMessage, actionMessage, selectedSite, selectedSiteId, siteBusy, siteMessage } = storeToRefs(store)
const feed = ref<HTMLElement | null>(null)
const sortPicker = ref<HTMLElement | null>(null)
const sortTrigger = ref<HTMLButtonElement | null>(null)
const sortOpen = ref(false)
const confirmation = ref<{ id: number; kind: 'tombstone' | 'permanent' } | null>(null)
const actionErrorId = ref<number | null>(null)
const flashId = ref<number | null>(null)
const leavingId = ref<number | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
const rows = computed(() => comments.value.map(c => selectedComment.value?.id === c.id ? selectedComment.value ?? c : c))
const groups = computed(() => {
  const result: { key: string; name: string; sub: string; comments: CommentReview[] }[] = []
  const today = formatDate(new Date().toISOString()).slice(0, 10)
  const yesterday = formatDate(new Date(Date.now() - 86400000).toISOString()).slice(0, 10)
  for (const comment of rows.value) {
    const key = formatDate(comment.createdAt).slice(0, 10)
    let group = result.at(-1)
    if (!group || group.key !== key) {
      const [year, month, day] = key.split('/')
      const date = new Date(comment.createdAt)
      const valid = !Number.isNaN(date.getTime())
      const md = valid ? `${Number(month)}月${Number(day)}日` : '时间未知'
      const week = valid ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(date) : ''
      group = { key, name: key === today ? '今天' : key === yesterday ? '昨天' : md, sub: !valid ? '' : key === today || key === yesterday ? `${md} ${week}` : `${year === today.slice(0, 4) ? '' : `${year} · `}${week}`, comments: [] }
      result.push(group)
    }
    group.comments.push(comment)
  }
  return result
})
const parents = computed(() => new Map(rows.value.map(c => [c.id, c])))
const quoteText = (comment?: CommentReview) => comment ? smojiPlainText(comment.content, selectedSite.value?.smojiEnabled === true, selectedSite.value?.smojiManifestUrl || '', selectedSite.value?.smojiImageOrigin).replace(/\s+/g, ' ') : ''
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
function sourceURL(comment: CommentReview): string {
  if (!selectedSite.value) return ''
  try {
    const base = new URL(`${selectedSite.value.siteUrl.replace(/\/+$/, '')}/`)
    const url = new URL(comment.mark.replace(/^\/+/, ''), base)
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== base.origin) return ''
    url.hash = `ecoku-comment-${comment.id}`
    return url.href
  } catch { return '' }
}
function entry(id: number) { return feed.value?.querySelector<HTMLElement>(`#c-${id}`) }
function select(comment: CommentReview, focus = false) {
  if (selectedComment.value?.id !== comment.id) store.selectComment(comment.id)
  if (focus) { entry(comment.id)?.focus({ preventScroll: true }); entry(comment.id)?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }) }
}
async function jump(id: number) {
  const comment = rows.value.find(c => c.id === id)
  if (!comment) return
  select(comment, true)
  // Briefly mark the parent so the eye finds where the jump landed.
  flashId.value = null
  await nextTick()
  void entry(id)?.offsetWidth
  flashId.value = id
  if (flashTimer !== undefined) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flashId.value = null }, 1500)
}
// A deleted comment fades out where it stands before the page closes over it.
function leave(id: number): Promise<void> {
  if (!entry(id)) return Promise.resolve()
  leavingId.value = id
  return reducedMotion() ? Promise.resolve() : new Promise(resolve => { setTimeout(resolve, 220) })
}
// After a deletion the next comment takes the deleted one's place, so focus it without scrolling.
function focusEntry(id: number) {
  if (!rows.value.some(c => c.id === id)) return
  if (selectedComment.value?.id !== id) store.selectComment(id)
  entry(id)?.focus({ preventScroll: true })
}
async function openConfirm(comment: CommentReview) {
  if (actionBusy.value || queueBusy.value || (comment.deleted && comment.hasChildren)) return
  select(comment)
  actionErrorId.value = null; store.actionMessage = ''
  confirmation.value = { id: comment.id, kind: comment.deleted ? 'permanent' : 'tombstone' }
  await nextTick(); entry(comment.id)?.querySelector<HTMLButtonElement>('.entry-confirm button')?.focus()
}
async function closeConfirm() {
  const id = confirmation.value?.id
  confirmation.value = null
  await nextTick(); if (id) entry(id)?.querySelector<HTMLButtonElement>('.is-danger')?.focus()
}
async function confirmAction() {
  const target = confirmation.value
  if (!target || actionBusy.value) return
  const index = rows.value.findIndex(c => c.id === target.id)
  const nextId = rows.value[index + 1]?.id ?? rows.value[index - 1]?.id
  actionErrorId.value = target.id
  const succeeded = await store.mutateCurrent(target.kind, target.id, leave)
  leavingId.value = null
  if (succeeded) { confirmation.value = null; actionErrorId.value = null; if (nextId) focusEntry(nextId) }
}
async function chooseStatus(next: CommentStatus) { confirmation.value = null; actionErrorId.value = null; await store.selectStatus(next) }
async function chooseSort(next: 'newest' | 'oldest') {
  sortOpen.value = false; sortTrigger.value?.focus()
  if (next !== sort.value) await store.toggleSort()
}
async function toggleSortMenu() {
  sortOpen.value = !sortOpen.value
  if (sortOpen.value) { await nextTick(); sortPicker.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus() }
}
function sortKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); sortOpen.value = false; sortTrigger.value?.focus(); return }
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const options = [...(sortPicker.value?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
  const current = options.indexOf(document.activeElement as HTMLButtonElement)
  options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + 1) % options.length]?.focus()
}
function outside(event: PointerEvent) { if (!sortPicker.value?.contains(event.target as Node)) sortOpen.value = false }
function keyboard(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [role="listbox"]'))) return
  if (event.key === 'Escape') { sortOpen.value = false; void closeConfirm(); return }
  if (queueBusy.value || actionBusy.value || confirmation.value) return
  const key = event.key.toLowerCase()
  if (['j', 'k', 'arrowdown', 'arrowup'].includes(key)) {
    event.preventDefault()
    const current = rows.value.findIndex(c => c.id === selectedComment.value?.id)
    const index = current < 0 ? 0 : Math.max(0, Math.min(rows.value.length - 1, current + (key === 'j' || key === 'arrowdown' ? 1 : -1)))
    const comment = rows.value[index]; if (comment) select(comment, true)
  } else if (key === 'o' && selectedComment.value) {
    const url = sourceURL(selectedComment.value); if (url) { event.preventDefault(); window.open(url, '_blank', 'noopener,noreferrer') }
  } else if (event.key === 'Delete' && selectedComment.value) { event.preventDefault(); void openConfirm(selectedComment.value) }
  else if (key === 'r' && selectedSite.value) { event.preventDefault(); void store.loadComments(true) }
}
watch(() => [selectedSiteId.value, status.value, sort.value, page.value], () => { confirmation.value = null; actionErrorId.value = null })
watch(queueBusy, value => { if (value && !actionBusy.value) { confirmation.value = null; actionErrorId.value = null } })
onMounted(() => { document.addEventListener('keydown', keyboard); document.addEventListener('pointerdown', outside) })
onBeforeUnmount(() => { document.removeEventListener('keydown', keyboard); document.removeEventListener('pointerdown', outside); if (flashTimer !== undefined) clearTimeout(flashTimer) })
</script>

<template>
  <section class="view" aria-labelledby="comments-title">
    <header class="page-head layout">
      <div class="in-margin head-margin"><SitePicker @select="store.selectSite" /></div>
      <div class="in-main head-main">
        <div class="title-row">
          <h1 id="comments-title" class="page-title" tabindex="-1"><span class="visually-hidden">评论管理：</span><span class="num">{{ total }}</span> {{ status === 'deleted' ? '条已删除评论' : '条评论' }}</h1>
          <div v-if="selectedSite" class="head-tools">
            <div ref="sortPicker" class="menu-anchor">
              <button ref="sortTrigger" class="quiet-trigger" type="button" aria-haspopup="listbox" :aria-expanded="sortOpen" :aria-label="`评论排序：${sort === 'newest' ? '最新在前' : '最早在前'}`" :disabled="queueBusy || actionBusy" @click="toggleSortMenu">{{ sort === 'newest' ? '最新在前' : '最早在前' }}<AdminIcon name="chevron" class="chevron" /></button>
              <div v-if="sortOpen" class="menu menu-end" role="listbox" aria-label="评论排序" @keydown="sortKeydown"><button v-for="order in (['newest', 'oldest'] as const)" :key="order" class="menu-option" type="button" role="option" :aria-selected="sort === order" @click="chooseSort(order)">{{ order === 'newest' ? '最新在前' : '最早在前' }}</button></div>
            </div>
            <button class="icon-button" :class="{ 'is-spinning': queueBusy && !queueQuiet }" type="button" aria-label="刷新评论" title="刷新评论（R）" :disabled="queueBusy || actionBusy" @click="store.loadComments(true)"><AdminIcon name="refresh" /></button>
          </div>
        </div>
        <div v-if="selectedSite" class="tabs" role="tablist" aria-label="评论状态">
          <button class="tab" type="button" role="tab" :aria-selected="status === 'published'" :disabled="queueBusy || actionBusy" @click="chooseStatus('published')">已发布 <span class="count">{{ counts.published }}</span></button><span class="tab-sep" aria-hidden="true">｜</span><button class="tab" type="button" role="tab" :aria-selected="status === 'deleted'" :disabled="queueBusy || actionBusy" @click="chooseStatus('deleted')">已删除 <span class="count">{{ counts.deleted }}</span></button>
        </div>
      </div>
    </header>
    <div ref="feed" class="feed" :aria-busy="queueBusy || siteBusy">
      <div v-if="siteMessage || queueMessage" class="layout feed-state"><section class="in-main service-error" role="alert"><h3>评论列表没有加载出来</h3><p>{{ siteMessage || queueMessage }}</p><button class="button" type="button" :disabled="queueBusy || siteBusy" @click="siteMessage ? store.loadSites(true) : store.loadComments()">重试</button></section></div>
      <div v-else-if="(queueBusy && !queueQuiet) || siteBusy" class="layout day"><div class="in-main"><div v-for="index in 5" :key="index" class="skeleton-entry" aria-hidden="true"><span /><span /><span /></div><span class="visually-hidden">正在加载评论…</span></div></div>
      <div v-else-if="!selectedSite" class="layout feed-state"><p class="in-main feed-empty">当前实例还没有站点。<button class="quiet-link" type="button" @click="store.switchView('sites')">新增站点</button></p></div>
      <section v-for="group in groups" v-else-if="comments.length" :key="group.key" class="day layout" :aria-label="group.name">
        <header class="in-margin day-label"><p class="day-name">{{ group.name }}</p><p class="day-date">{{ group.sub }}</p><p class="day-count">{{ group.comments.length }} 条</p></header>
        <div class="in-main day-entries">
          <article v-for="comment in group.comments" :id="`c-${comment.id}`" :key="comment.id" class="entry" :class="{ 'is-tombstone': comment.deleted, 'is-flash': flashId === comment.id, 'is-leaving': leavingId === comment.id }" tabindex="-1" :aria-current="selectedComment?.id === comment.id ? 'true' : undefined" :aria-label="`#${comment.id} ${comment.deleted ? '已删除' : comment.username}`" @pointerdown="select(comment)">
            <header class="entry-head"><div class="entry-who"><span class="entry-author">{{ comment.deleted ? '已删除' : comment.username }}</span><span v-if="!comment.deleted && comment.email" class="entry-mail" title="私有邮箱"><span class="visually-hidden">私有邮箱 </span>{{ comment.email }}</span><a v-if="!comment.deleted && safeWebsite(comment.url)" class="entry-site" :href="safeWebsite(comment.url)" target="_blank" rel="noopener noreferrer" :title="`访客网站 ${comment.url}`"><span class="visually-hidden">访客网站 </span>{{ comment.url?.replace(/^https?:\/\//, '').replace(/\/$/, '') }}</a></div><time class="entry-time" :datetime="comment.createdAt" :title="formatDate(comment.createdAt)">{{ formatDate(comment.createdAt).slice(11) || '时间未知' }}</time></header>
            <a v-if="comment.parent && parents.get(comment.parent) && !comment.deleted" class="entry-quote" :href="`#c-${comment.parent}`" @click.prevent="jump(comment.parent)"><span class="quote-ref">回复 {{ parents.get(comment.parent)?.username }}</span><span class="quote-text">{{ quoteText(parents.get(comment.parent)) }}</span></a>
            <p v-else-if="comment.parent" class="entry-quote"><span class="quote-ref"><span class="visually-hidden">父评论 </span>回复 #{{ comment.parent }}</span><span v-if="!comment.deleted" class="quote-text">不在当前页</span></p>
            <p class="entry-copy"><template v-if="comment.deleted">该评论已删除</template><SmojiContent v-else :content="comment.content" :enabled="selectedSite?.smojiEnabled === true" :manifest-url="selectedSite?.smojiManifestUrl || ''" :image-origin="selectedSite?.smojiImageOrigin" /></p>
            <footer class="entry-foot"><span class="entry-page" :title="`${comment.pageTitle ? `${comment.pageTitle} · ` : ''}${comment.mark}`"><span v-if="comment.pageTitle" class="entry-title"><span class="visually-hidden">文章标题 </span>《{{ comment.pageTitle }}》</span><span class="entry-key"><span class="visually-hidden">页面 key </span>{{ comment.mark }}</span></span><span class="entry-actions"><span class="entry-id">#{{ comment.id }}</span><a v-if="sourceURL(comment)" class="quiet-link" :href="sourceURL(comment)" target="_blank" rel="noopener noreferrer" :title="`查看原评论 #${comment.id}`">查看原评论</a><button v-if="!comment.deleted || !comment.hasChildren" class="quiet-link is-danger" type="button" :disabled="actionBusy || queueBusy" @click="openConfirm(comment)">{{ comment.deleted ? '彻底删除' : '墓碑删除' }}</button><span v-else class="entry-hint">仍有回复，不能彻底删除</span></span></footer>
            <p v-if="actionErrorId === comment.id && actionMessage" class="notice notice-error" role="alert">{{ actionMessage }}</p>
            <div v-if="confirmation?.id === comment.id" class="entry-confirm" role="alertdialog" :aria-labelledby="`confirm-${comment.id}-title`" :aria-describedby="`confirm-${comment.id}-copy`">
              <p><strong :id="`confirm-${comment.id}-title`">{{ confirmation.kind === 'tombstone' ? '墓碑删除这条评论？' : '彻底删除这条墓碑？' }}</strong><span :id="`confirm-${comment.id}-copy`">{{ confirmation.kind === 'tombstone' ? '昵称、私有邮箱、网站和正文会被清除，公开页面改为显示“已删除”，下面的回复保留不变。此操作无法撤销。' : '这条墓碑会从数据库中移除。此操作无法撤销。' }}</span></p>
              <div class="confirm-actions"><button class="button button-quiet" type="button" :disabled="actionBusy" @click="closeConfirm">取消</button><button class="button button-danger" type="button" :disabled="actionBusy" @click="confirmAction">{{ actionBusy ? '处理中…' : confirmation.kind === 'tombstone' ? '墓碑删除' : '彻底删除' }}</button></div>
            </div>
          </article>
        </div>
      </section>
      <div v-else class="layout feed-state"><p class="in-main feed-empty">当前没有{{ status === 'published' ? '已发布' : '已删除' }}评论</p></div>
    </div>
    <footer v-if="selectedSite" class="feed-foot layout"><p class="in-margin keys" aria-hidden="true"><kbd>J</kbd><kbd>K</kbd>上下条　<kbd>O</kbd>原评论　<kbd>Del</kbd>删除</p><nav class="in-main pager" aria-label="评论列表分页"><button class="pager-button" type="button" :disabled="page <= 1 || queueBusy || actionBusy" @click="store.selectPage(page - 1)">‹ 上一页</button><span class="pager-sep" aria-hidden="true">｜</span><span class="pager-status" aria-live="polite">{{ page }}/{{ Math.max(pageCount, 1) }}</span><span class="pager-sep" aria-hidden="true">｜</span><button class="pager-button" type="button" :disabled="page >= pageCount || queueBusy || actionBusy" @click="store.selectPage(page + 1)">下一页 ›</button></nav></footer>
  </section>
</template>
