<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { statusMeta, statusOrder } from '../messages'
import { useAdminStore } from '../stores/admin'
import { formatDate, safeWebsite } from '../ui'
import type { CommentStatus, SiteSummary } from '../types'
import AdminIcon from './AdminIcon.vue'
import SmojiContent from './SmojiContent.vue'

const emit = defineEmits<{ mobileDetail: [open: boolean] }>()
defineProps<{ mobileDetail: boolean }>()
const store = useAdminStore()
const {
  status, sort, page, pageCount, total, counts, comments, selectedComment, queueBusy, detailBusy, actionBusy,
  queueMessage, actionMessage, sites, selectedSiteId, selectedSite, siteBusy,
} = storeToRefs(store)
const confirmKind = ref<'tombstone' | 'permanent' | null>(null)
const confirmDialog = ref<HTMLDialogElement | null>(null)
const queueList = ref<HTMLElement | null>(null)
const sitePicker = ref<HTMLElement | null>(null)
const siteTrigger = ref<HTMLButtonElement | null>(null)
const siteMenu = ref<HTMLElement | null>(null)
const siteMenuOpen = ref(false)

function siteLabel(site: SiteSummary | null): string {
  if (!site) return ''
  if (site.name) return site.name
  try { return new URL(site.siteUrl).hostname } catch { return site.id }
}

const displayName = computed(() => siteLabel(selectedSite.value))
const sourceURL = computed(() => {
  if (!selectedComment.value || !selectedSite.value) return ''
  try {
    const result = new URL(selectedComment.value.mark.replace(/^\/+/, ''), `${selectedSite.value.siteUrl.replace(/\/+$/, '')}/`)
    result.hash = `ecoku-comment-${selectedComment.value.id}`
    return result.toString()
  } catch {
    return ''
  }
})
const confirmTarget = computed(() => {
  const comment = selectedComment.value
  if (!comment) return ''
  if (confirmKind.value === 'permanent' || comment.deleted) return `#${comment.id} · ${comment.mark}`
  const excerpt = [...comment.content.replace(/\s+/g, ' ').trim()]
  return `#${comment.id} · ${comment.username} · ${excerpt.slice(0, 40).join('')}${excerpt.length > 40 ? '…' : ''}`
})

watch(confirmKind, async (value) => {
  await nextTick()
  const dialog = confirmDialog.value
  if (!dialog) return
  if (value && !dialog.open) dialog.showModal()
  if (!value && dialog.open) dialog.close()
})

function handleDocumentPointerDown(event: PointerEvent) {
  if (siteMenuOpen.value && !sitePicker.value?.contains(event.target as Node)) siteMenuOpen.value = false
}
onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown))
function handleKeyboard(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
  const index = comments.value.findIndex((item) => item.id === selectedComment.value?.id)
  if (event.key === 'j') {
    if (index < comments.value.length - 1) { event.preventDefault(); store.selectComment(comments.value[index + 1]!.id) }
  } else if (event.key === 'k') {
    if (index > 0) { event.preventDefault(); store.selectComment(comments.value[index - 1]!.id) }
  } else if (event.key.toLowerCase() === 'o' && sourceURL.value) {
    event.preventDefault(); window.open(sourceURL.value, '_blank', 'noopener,noreferrer')
  } else if (event.key === 'Delete' && selectedComment.value && !actionBusy.value) {
    event.preventDefault(); confirmKind.value = selectedComment.value.status === 'published' ? 'tombstone' : selectedComment.value.hasChildren ? null : 'permanent'
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault(); void store.loadComments(true)
  } else if (event.key === 'Escape') {
    siteMenuOpen.value = false; closeConfirm()
  }
}
onMounted(() => document.addEventListener('keydown', handleKeyboard))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleKeyboard)
})

async function toggleSiteMenu(open = !siteMenuOpen.value) {
  if (siteBusy.value || sites.value.length < 2) return
  siteMenuOpen.value = open
  if (!open) return
  await nextTick()
  siteMenu.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
}

async function chooseSite(siteId: string) {
  siteMenuOpen.value = false
  emit('mobileDetail', false)
  await store.selectSite(siteId)
  await nextTick()
  siteTrigger.value?.focus()
}

function handleSiteMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    siteMenuOpen.value = false
    siteTrigger.value?.focus()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const options = Array.from(siteMenu.value?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])
  if (!options.length) return
  const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement)
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? options.length - 1
      : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
  options[nextIndex]?.focus()
}

function handleQueueKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const items = Array.from(queueList.value?.querySelectorAll<HTMLButtonElement>('.queue-item') ?? [])
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  if (index < 0) return
  event.preventDefault()
  const next = items[index + (event.key === 'ArrowDown' ? 1 : -1)]
  if (!next) return
  store.selectComment(Number(next.dataset.commentId))
  next.focus()
}

async function chooseStatus(next: CommentStatus) { await store.selectStatus(next); emit('mobileDetail', false) }
function chooseComment(id: number) { store.selectComment(id); emit('mobileDetail', true) }
function closeConfirm() { confirmKind.value = null }
function handleDialogClick(event: MouseEvent) {
  if (event.target === event.currentTarget) closeConfirm()
}
async function confirmAction() {
  if (!confirmKind.value) return
  const kind = confirmKind.value
  closeConfirm()
  await store.mutateCurrent(kind)
  emit('mobileDetail', false)
}
</script>

<template>
  <section class="comment-ledger" :data-mobile-detail="mobileDetail" aria-labelledby="queue-title">
    <header class="ledger-head">
      <div ref="sitePicker" class="ledger-margin site-picker">
        <button v-if="sites.length > 1" ref="siteTrigger" class="site-trigger" type="button" aria-haspopup="listbox" :aria-expanded="siteMenuOpen" :aria-label="`切换站点，当前 ${displayName}`" :disabled="siteBusy" @click="toggleSiteMenu()">
          <span class="site-name"><span>{{ displayName }}</span><AdminIcon name="chevron" class="chevron" /></span><span class="site-id">{{ selectedSite?.id }}</span>
        </button>
        <div v-else class="site-static"><span class="site-name"><span>{{ displayName || '没有可用站点' }}</span></span><span v-if="selectedSite" class="site-id">{{ selectedSite.id }}</span></div>
        <div v-show="siteMenuOpen" ref="siteMenu" class="site-menu" role="listbox" aria-label="选择站点" @keydown="handleSiteMenuKeydown">
          <button v-for="site in sites" :key="site.id" class="site-option" type="button" role="option" :aria-selected="selectedSiteId === site.id" @click="chooseSite(site.id)"><strong>{{ siteLabel(site) }}</strong><small>{{ site.id }}</small><AdminIcon name="check" class="check" /></button>
        </div>
      </div>
      <div class="ledger-main">
        <div class="ledger-title-row">
          <h1 id="queue-title"><span class="visually-hidden">评论管理：</span><span class="title-count">{{ total }}</span> 条评论</h1>
          <div class="ledger-tools">
            <button class="sort-button" type="button" :aria-label="`排序：${sort === 'oldest' ? '最早提交在前' : '最新提交在前'}，点击切换`" @click="store.toggleSort"><AdminIcon name="sort" /><span>{{ sort === 'oldest' ? '最早在前' : '最新在前' }}</span></button>
            <button class="icon-button" :class="{ 'is-spinning': queueBusy }" type="button" aria-label="刷新评论" title="刷新评论（R）" :disabled="queueBusy" @click="store.loadComments(true)"><AdminIcon name="refresh" /></button>
          </div>
        </div>
        <div class="queue-toolbar status-tabs" role="tablist" aria-label="评论状态">
          <button v-for="item in statusOrder" :key="item" class="status-tab" type="button" role="tab" :aria-selected="status === item" @click="chooseStatus(item)">{{ statusMeta[item].label }} <span class="count">{{ counts[item] }}</span></button>
        </div>
      </div>
    </header>

    <div class="ledger-feed" :aria-busy="queueBusy">
      <p v-if="queueMessage" class="notice notice-error ledger-notice" role="alert">{{ queueMessage }}<button class="button" type="button" :disabled="queueBusy" @click="store.loadComments()">重试</button></p>
      <div v-if="queueBusy && !comments.length" class="ledger-main ledger-loading" aria-hidden="true"><div v-for="index in 6" :key="index" class="skeleton-row"><span /><span /><span /></div></div>
      <ul v-else-if="comments.length" ref="queueList" class="queue-list ledger-main" role="listbox" aria-label="评论列表" @keydown="handleQueueKeydown">
        <li v-for="(comment, index) in comments" :key="comment.id" class="queue-row feed-entry" :class="{ 'is-selected': selectedComment?.id === comment.id }" role="none">
          <p v-if="index === 0 || formatDate(comment.createdAt).slice(0, 10) !== formatDate(comments[index - 1]!.createdAt).slice(0, 10)" class="feed-date">{{ formatDate(comment.createdAt).slice(0, 10) }}</p>
          <button class="queue-item feed-row" type="button" role="option" :data-comment-id="comment.id" :aria-selected="selectedComment?.id === comment.id" @click="chooseComment(comment.id)">
            <span class="feed-index">#{{ comment.id }}</span>
            <span class="queue-item-line"><span class="queue-author" :class="{ 'is-deleted': comment.deleted }" :title="comment.deleted ? '已删除' : comment.username">{{ comment.deleted ? '已删除' : comment.username }}</span><time class="queue-time">{{ formatDate(comment.createdAt) }}</time></span>
            <span class="queue-summary" :class="{ 'is-deleted': comment.deleted }"><template v-if="comment.deleted">该评论已删除</template><SmojiContent v-else :content="comment.content" :enabled="selectedSite?.smojiEnabled === true" :manifest-url="selectedSite?.smojiManifestUrl || ''" compact /></span>
            <span class="feed-context"><span>{{ comment.pageTitle || comment.mark }}</span><span>{{ comment.parent ? `回复 #${comment.parent}` : '根评论' }}</span></span>
          </button>

          <section v-if="selectedComment?.id === comment.id" class="detail-pane inline-detail" aria-label="评论详情">
            <div class="detail-toolbar">
              <button class="button button-quiet mobile-back" type="button" @click="emit('mobileDetail', false)"><AdminIcon name="left" />评论列表</button>
              <div class="detail-ref"><span class="badge" :class="statusMeta[selectedComment.status].className">{{ statusMeta[selectedComment.status].label }}</span><span>#{{ selectedComment.id }}</span><span aria-hidden="true">·</span><span>{{ selectedComment.parent ? `回复 #${selectedComment.parent}` : '根评论' }}</span></div>
              <div class="detail-actions">
                <a v-if="sourceURL" class="button button-quiet source-link" :href="sourceURL" target="_blank" rel="noopener noreferrer" :title="`查看原评论 #${selectedComment.id}`"><AdminIcon name="external" /><span class="label">查看原评论</span></a>
                <button v-if="selectedComment.status === 'published'" class="button danger-button" type="button" :disabled="actionBusy" @click="confirmKind = 'tombstone'">墓碑删除</button>
                <button v-else-if="!selectedComment.hasChildren" class="button danger-button" type="button" :disabled="actionBusy" @click="confirmKind = 'permanent'">彻底删除</button>
                <span v-else class="hint">仍有回复，不能彻底删除</span>
              </div>
            </div>
            <p v-if="actionMessage" class="notice notice-error" role="alert">{{ actionMessage }}</p>
            <article class="review-sheet" :aria-busy="detailBusy" aria-labelledby="comment-detail-title">
              <div class="detail-main"><header class="detail-heading"><h2 id="comment-detail-title" :class="{ 'is-deleted': selectedComment.deleted }" :title="selectedComment.deleted ? '已删除' : selectedComment.username">{{ selectedComment.deleted ? '已删除' : selectedComment.username }}</h2><time>{{ formatDate(selectedComment.createdAt) }}</time></header><p class="comment-body" :class="{ 'is-deleted-copy': selectedComment.deleted }"><template v-if="selectedComment.deleted">该评论已删除</template><SmojiContent v-else :content="selectedComment.content" :enabled="selectedSite?.smojiEnabled === true" :manifest-url="selectedSite?.smojiManifestUrl || ''" /></p></div>
              <dl class="detail-facts detail-side" aria-label="评论信息"><div class="fact-row"><dt>私有邮箱</dt><dd :class="{ mono: selectedComment.email }" :title="selectedComment.email || '—'"><template v-if="selectedComment.email">{{ selectedComment.email }}</template><span v-else class="is-empty">—</span></dd></div><div class="fact-row"><dt>访客网站</dt><dd :class="{ mono: safeWebsite(selectedComment.url) }" :title="selectedComment.url || '—'"><a v-if="safeWebsite(selectedComment.url)" :href="safeWebsite(selectedComment.url)" target="_blank" rel="noopener noreferrer">{{ selectedComment.url }}</a><span v-else class="is-empty">—</span></dd></div><div class="fact-row"><dt>文章标题</dt><dd :title="selectedComment.pageTitle || '—'"><template v-if="selectedComment.pageTitle">{{ selectedComment.pageTitle }}</template><span v-else class="is-empty">—</span></dd></div><div class="fact-row"><dt>页面 key</dt><dd class="mono" :title="selectedComment.mark">{{ selectedComment.mark }}</dd></div><div class="fact-row"><dt>父评论</dt><dd><template v-if="selectedComment.parent">#{{ selectedComment.parent }}</template><span v-else class="is-empty">—</span></dd></div></dl>
            </article>
          </section>
        </li>
      </ul>
      <p v-else-if="!queueBusy && !queueMessage" class="queue-empty ledger-main">当前没有{{ statusMeta[status].label }}评论</p>
    </div>

    <footer class="feed-foot ledger-main">
      <p class="keys" aria-hidden="true"><kbd>J</kbd><kbd>K</kbd>上下条　<kbd>O</kbd>原评论　<kbd>Del</kbd>删除</p>
      <nav class="pager" aria-label="评论列表分页"><button class="pager-button" type="button" :disabled="page <= 1" @click="store.selectPage(page - 1)">‹ 上一页</button><span class="pager-status">{{ page }} / {{ Math.max(pageCount, 1) }}</span><button class="pager-button" type="button" :disabled="page >= pageCount" @click="store.selectPage(page + 1)">下一页 ›</button></nav>
    </footer>
  </section>

  <dialog ref="confirmDialog" aria-labelledby="confirm-title" @cancel.prevent="closeConfirm" @click="handleDialogClick" @close="confirmKind = null">
    <div class="dialog-body">
      <h2 id="confirm-title">{{ confirmKind === 'tombstone' ? '墓碑删除这条评论？' : '彻底删除这条墓碑？' }}</h2>
      <p>{{ confirmKind === 'tombstone' ? '昵称、私有邮箱、网站和正文会被清除，公开页面改为显示“已删除”，下面的回复保留不变。此操作无法撤销。' : '这条墓碑会从数据库中移除。此操作无法撤销。' }}</p>
      <p v-if="confirmTarget" class="dialog-target">{{ confirmTarget }}</p>
    </div>
    <div class="dialog-actions">
      <button class="button" type="button" @click="closeConfirm">取消</button>
      <button class="button danger-button is-solid" type="button" :disabled="actionBusy" @click="confirmAction">{{ confirmKind === 'tombstone' ? '墓碑删除' : '彻底删除' }}</button>
    </div>
  </dialog>
</template>
