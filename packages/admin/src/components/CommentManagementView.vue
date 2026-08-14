<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { statusMeta, statusOrder } from '../messages'
import { useAdminStore } from '../stores/admin'
import { formatDate, safeWebsite } from '../ui'
import type { CommentStatus } from '../types'

const emit = defineEmits<{ mobileDetail: [open: boolean] }>()
defineProps<{ mobileDetail: boolean }>()
const store = useAdminStore()
const { status, sort, page, pageCount, total, counts, comments, selectedComment, queueBusy, detailBusy, actionBusy, queueMessage, actionMessage, selectedSite } = storeToRefs(store)
const confirmKind = ref<'tombstone' | 'permanent' | null>(null)
const confirmDialog = ref<HTMLDialogElement | null>(null)

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
const displayName = computed(() => selectedSite.value?.name || (() => {
  try { return new URL(selectedSite.value?.siteUrl || '').hostname }
  catch { return selectedSite.value?.id || '' }
})())

watch(confirmKind, async (value) => {
  await nextTick()
  const dialog = confirmDialog.value
  if (!dialog) return
  if (value && !dialog.open) dialog.showModal()
  if (!value && dialog.open) dialog.close()
})

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
  <div class="moderation-layout" :data-mobile-detail="mobileDetail">
    <section class="queue-pane" aria-labelledby="queue-title">
      <div class="queue-heading">
        <h1 id="queue-title">评论管理</h1>
        <button class="icon-button" type="button" aria-label="刷新评论" :disabled="queueBusy" @click="store.loadComments(true)">↻</button>
      </div>
      <nav class="status-tabs" aria-label="评论状态">
        <button v-for="item in statusOrder" :key="item" class="status-tab" type="button" :aria-selected="status === item" @click="chooseStatus(item)">{{ statusMeta[item].label }} {{ counts[item] }}</button>
      </nav>
      <div class="queue-meta">
        <button class="sort-button" type="button" @click="store.toggleSort">{{ sort === 'oldest' ? '最早提交优先' : '最新提交优先' }}</button>
        <span>{{ total }} 条</span>
      </div>
      <div class="queue-scroll">
        <p v-if="queueMessage" class="inline-error queue-message" role="alert">{{ queueMessage }}</p>
        <div v-if="comments.length" class="queue-list" role="listbox" aria-label="评论列表">
          <div v-for="comment in comments" :key="comment.id" class="queue-row">
            <button class="queue-item" type="button" role="option" :aria-selected="selectedComment?.id === comment.id" @click="chooseComment(comment.id)">
              <span class="queue-item-line">
                <span class="queue-author" :title="comment.deleted ? '已删除' : comment.username">{{ comment.deleted ? '已删除' : comment.username }}</span>
                <time class="queue-time">{{ formatDate(comment.createdAt) }}</time>
              </span>
              <span class="queue-summary">{{ comment.deleted ? '该评论已删除' : comment.content }}</span>
              <span class="queue-item-line">
                <span class="queue-path" :title="comment.mark">{{ comment.mark }}</span>
                <span class="queue-tail">
                  <span :title="comment.parent ? `回复 #${comment.parent}` : `#${comment.id}`">{{ comment.parent ? `回复 #${comment.parent}` : `#${comment.id}` }}</span>
                  <span class="badge" :class="statusMeta[comment.status].className">{{ statusMeta[comment.status].label }}</span>
                </span>
              </span>
            </button>
          </div>
        </div>
        <p v-else-if="!queueBusy" class="queue-empty">当前没有{{ statusMeta[status].label }}评论</p>
      </div>
      <nav class="pager" aria-label="评论列表分页">
        <button class="pager-button" type="button" :disabled="page <= 1" @click="store.selectPage(page - 1)">‹ 上一页</button>
        <span>｜</span><span>{{ page }}/{{ Math.max(pageCount, 1) }}</span><span>｜</span>
        <button class="pager-button" type="button" :disabled="page >= pageCount" @click="store.selectPage(page + 1)">下一页 ›</button>
      </nav>
    </section>

    <section class="detail-pane">
      <p v-if="!selectedComment" class="detail-empty">从左侧列表选择一条评论</p>
      <article v-else class="review-sheet" :aria-busy="detailBusy" aria-labelledby="comment-detail-title">
        <div class="detail-main">
          <div class="mobile-detail-bar"><button class="back-button" type="button" @click="emit('mobileDetail', false)">‹ 返回</button></div>
          <div class="detail-info">
            <span class="badge" :class="statusMeta[selectedComment.status].className">{{ statusMeta[selectedComment.status].label }}</span>
            <span>·</span><span>#{{ selectedComment.id }}</span>
            <span>·</span><span>{{ selectedComment.parent ? `回复 #${selectedComment.parent}` : '根评论' }}</span>
            <span>·</span><span class="detail-location" :title="`${displayName} / ${selectedComment.mark}`">{{ displayName }} / {{ selectedComment.mark }}</span>
          </div>
          <header class="detail-heading">
            <h2 id="comment-detail-title" :title="selectedComment.deleted ? '已删除' : selectedComment.username">{{ selectedComment.deleted ? '已删除' : selectedComment.username }}</h2>
            <div class="detail-heading-meta">
              <time>{{ formatDate(selectedComment.createdAt) }}</time>
              <a v-if="sourceURL" class="source-link" :href="sourceURL" target="_blank" rel="noopener noreferrer" :title="`查看原评论 #${selectedComment.id}`">查看原评论</a>
            </div>
          </header>
          <p class="comment-body" :class="{ 'is-deleted-copy': selectedComment.deleted }">{{ selectedComment.deleted ? '该评论已删除' : selectedComment.content }}</p>
          <p v-if="actionMessage" class="inline-error" role="alert">{{ actionMessage }}</p>
          <div class="review-actions">
            <button v-if="selectedComment.status === 'published'" class="button danger-button" type="button" :disabled="actionBusy" @click="confirmKind = 'tombstone'">墓碑删除</button>
            <button v-else-if="!selectedComment.hasChildren" class="button danger-button" type="button" :disabled="actionBusy" @click="confirmKind = 'permanent'">彻底删除</button>
          </div>
        </div>
        <aside class="detail-side" aria-label="评论元信息">
          <dl class="detail-facts">
            <div class="fact-row"><dt>私有邮箱</dt><dd :title="selectedComment.email || '—'">{{ selectedComment.email || '—' }}</dd></div>
            <div class="fact-row"><dt>访客网站</dt><dd :title="selectedComment.url || '—'"><a v-if="safeWebsite(selectedComment.url)" :href="safeWebsite(selectedComment.url)" target="_blank" rel="noopener noreferrer">{{ selectedComment.url }}</a><template v-else>—</template></dd></div>
            <div class="fact-row"><dt>文章标题</dt><dd :title="selectedComment.pageTitle || '—'">{{ selectedComment.pageTitle || '—' }}</dd></div>
            <div class="fact-row"><dt>页面 key</dt><dd :title="selectedComment.mark">{{ selectedComment.mark }}</dd></div>
            <div class="fact-row"><dt>站点</dt><dd :title="displayName">{{ displayName }}</dd></div>
            <div class="fact-row"><dt>提交时间</dt><dd>{{ formatDate(selectedComment.createdAt) }}</dd></div>
            <div class="fact-row"><dt>父评论</dt><dd>{{ selectedComment.parent ? `#${selectedComment.parent}` : '—' }}</dd></div>
          </dl>
        </aside>
      </article>
    </section>
  </div>

  <dialog ref="confirmDialog" @cancel.prevent="closeConfirm" @click="handleDialogClick" @close="confirmKind = null">
    <div class="dialog-body">
      <h2>{{ confirmKind === 'tombstone' ? '将评论替换为墓碑？' : '彻底删除这条墓碑？' }}</h2>
      <p>{{ confirmKind === 'tombstone' ? '昵称、私有邮箱、网站和原正文会被清除，后代回复仍会保留。' : '此操作无法恢复。' }}</p>
    </div>
    <div class="dialog-actions">
      <button class="button" type="button" @click="closeConfirm">取消</button>
      <button class="button danger-button" type="button" :disabled="actionBusy" @click="confirmAction">确认删除</button>
    </div>
  </dialog>
</template>
