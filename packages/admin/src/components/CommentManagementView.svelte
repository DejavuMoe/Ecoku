<script lang="ts">
  import { tick, onMount, onDestroy, untrack } from 'svelte'

  import { useAdminStore } from '../stores/admin.svelte'
  import { formatDate, safeWebsite } from '../ui'
  import { smojiPlainText } from '../smoji'
  import type { CommentReview, CommentStatus } from '../types'
  import AdminIcon from './AdminIcon.svelte'
  import SitePicker from './SitePicker.svelte'
  import SmojiContent from './SmojiContent.svelte'
  import { adminLocale, commentCountNoun } from '../i18n.svelte'

  const store = useAdminStore()

  let feed = $state<HTMLElement | null>(null)
  let sortPicker = $state<HTMLElement | null>(null)
  let sortTrigger = $state<HTMLButtonElement | null>(null)
  let sortOpen = $state(false)
  let confirmation = $state<{ id: number; kind: 'tombstone' | 'permanent' } | null>(null)
  let actionErrorId = $state<number | null>(null)
  let flashId = $state<number | null>(null)
  let leavingId = $state<number | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | undefined
  let rows = $derived.by(() =>
    store.comments.map((c) => (store.selectedComment?.id === c.id ? (store.selectedComment ?? c) : c))
  )
  let groups = $derived.by(() => {
    const result: { key: string; name: string; sub: string; comments: CommentReview[] }[] = []
    const locale = adminLocale.value
    const today = formatDate(new Date().toISOString()).slice(0, 10)
    const yesterday = formatDate(new Date(Date.now() - 86400000).toISOString()).slice(0, 10)
    for (const comment of rows) {
      const key = formatDate(comment.createdAt).slice(0, 10)
      let group = result.at(-1)
      if (!group || group.key !== key) {
        const [year, month, day] = key.split('/')
        const date = new Date(comment.createdAt)
        const valid = !Number.isNaN(date.getTime())
        const md = !valid
          ? '时间未知'
          : locale === 'zh-CN'
            ? `${Number(month)}月${Number(day)}日`
            : new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' }).format(date)
        const week = valid
          ? new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(date)
          : ''
        group = {
          key,
          name: key === today ? '今天' : key === yesterday ? '昨天' : md,
          sub: !valid
            ? ''
            : key === today || key === yesterday
              ? `${md} ${week}`
              : `${year === today.slice(0, 4) ? '' : `${year} · `}${week}`,
          comments: []
        }
        result.push(group)
      }
      group.comments.push(comment)
    }
    return result
  })
  let parents = $derived.by(() => new Map(rows.map((c) => [c.id, c])))
  const quoteText = (comment?: CommentReview) =>
    comment
      ? smojiPlainText(
          comment.content,
          store.selectedSite?.smojiEnabled === true,
          store.selectedSite?.smojiManifestUrl || '',
          store.selectedSite?.smojiImageOrigin
        ).replace(/\s+/g, ' ')
      : ''
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  function sourceURL(comment: CommentReview): string {
    if (!store.selectedSite) return ''
    try {
      const base = new URL(`${store.selectedSite.siteUrl.replace(/\/+$/, '')}/`)
      const url = new URL(comment.mark.replace(/^\/+/, ''), base)
      if (!['https:', 'http:'].includes(url.protocol) || url.origin !== base.origin) return ''
      url.hash = `ecoku-comment-${comment.id}`
      return url.href
    } catch {
      return ''
    }
  }
  function entry(id: number) {
    return feed?.querySelector<HTMLElement>(`#c-${id}`)
  }
  function select(comment: CommentReview, focus = false) {
    if (store.selectedComment?.id !== comment.id) store.selectComment(comment.id)
    if (focus) {
      entry(comment.id)?.focus({ preventScroll: true })
      entry(comment.id)?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
    }
  }
  async function jump(id: number) {
    const comment = rows.find((c) => c.id === id)
    if (!comment) return
    select(comment, true)
    // Briefly mark the parent so the eye finds where the jump landed.
    flashId = null
    await tick()
    void entry(id)?.offsetWidth
    flashId = id
    if (flashTimer !== undefined) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      flashId = null
    }, 1500)
  }
  // A deleted comment fades out where it stands before the page closes over it.
  function leave(id: number): Promise<void> {
    if (!entry(id)) return Promise.resolve()
    leavingId = id
    return reducedMotion()
      ? Promise.resolve()
      : new Promise((resolve) => {
          setTimeout(resolve, 220)
        })
  }
  // After a deletion the next comment takes the deleted one's place, so focus it without scrolling.
  function focusEntry(id: number) {
    if (!rows.some((c) => c.id === id)) return
    if (store.selectedComment?.id !== id) store.selectComment(id)
    entry(id)?.focus({ preventScroll: true })
  }
  async function openConfirm(comment: CommentReview) {
    if (store.actionBusy || store.queueBusy || (comment.deleted && comment.hasChildren)) return
    select(comment)
    actionErrorId = null
    store.actionMessage = ''
    confirmation = { id: comment.id, kind: comment.deleted ? 'permanent' : 'tombstone' }
    await tick()
    entry(comment.id)?.querySelector<HTMLButtonElement>('.entry-confirm button')?.focus()
  }
  async function closeConfirm() {
    const id = confirmation?.id
    confirmation = null
    await tick()
    if (id) entry(id)?.querySelector<HTMLButtonElement>('.is-danger')?.focus()
  }
  async function confirmAction() {
    const target = confirmation
    if (!target || store.actionBusy) return
    const index = rows.findIndex((c) => c.id === target.id)
    const nextId = rows[index + 1]?.id ?? rows[index - 1]?.id
    actionErrorId = target.id
    const succeeded = await store.mutateCurrent(target.kind, target.id, leave)
    leavingId = null
    if (succeeded) {
      confirmation = null
      actionErrorId = null
      if (nextId) focusEntry(nextId)
    }
  }
  async function chooseStatus(next: CommentStatus) {
    confirmation = null
    actionErrorId = null
    await store.selectStatus(next)
  }
  async function chooseSort(next: 'newest' | 'oldest') {
    sortOpen = false
    sortTrigger?.focus()
    if (next !== store.sort) await store.toggleSort()
  }
  async function toggleSortMenu() {
    sortOpen = !sortOpen
    if (sortOpen) {
      await tick()
      sortPicker?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    }
  }
  function sortKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      sortOpen = false
      sortTrigger?.focus()
      return
    }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const options = [...(sortPicker?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    const current = options.indexOf(document.activeElement as HTMLButtonElement)
    options[
      event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + 1) % options.length
    ]?.focus()
  }
  function outside(event: PointerEvent) {
    if (!sortPicker?.contains(event.target as Node)) sortOpen = false
  }
  $effect.pre(() => {
    store.selectedSiteId
    store.status
    store.sort
    store.page
    untrack(() => {
      confirmation = null
      actionErrorId = null
    })
  })

  $effect.pre(() => {
    const busy = store.queueBusy
    untrack(() => {
      if (busy && !store.actionBusy) {
        confirmation = null
        actionErrorId = null
      }
    })
  })
  onMount(() => {
    document.addEventListener('pointerdown', outside)
  })
  onDestroy(() => {
    document.removeEventListener('pointerdown', outside)
    if (flashTimer !== undefined) clearTimeout(flashTimer)
  })
</script>

<section aria-labelledby="comments-title" class="view">
  <header class="page-head layout">
    <div class="in-margin head-margin"><SitePicker onselect={store.selectSite} /></div>
    <div class="in-main head-main">
      <div class="title-row">
        <h1 id="comments-title" tabindex="-1" class="page-title">
          <span class="visually-hidden">评论管理：</span><span class="num">{store.total}</span>
          <span>{commentCountNoun(store.total, store.status === 'deleted')}</span>
        </h1>
        {#if store.selectedSite}<div class="head-tools">
            <div bind:this={sortPicker} class="menu-anchor">
              <button
                bind:this={sortTrigger}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                aria-label={`评论排序：${store.sort === 'newest' ? '最新在前' : '最早在前'}`}
                disabled={store.queueBusy || store.actionBusy}
                onclick={toggleSortMenu}
                class="quiet-trigger"
                >{store.sort === 'newest' ? '最新在前' : '最早在前'}<AdminIcon name="chevron" class="chevron" /></button
              >{#if sortOpen}<div role="listbox" tabindex="-1" aria-label="评论排序" onkeydown={sortKeydown} class="menu menu-end">
                  {#each ['newest', 'oldest'] as const as order (order)}<button
                      type="button"
                      role="option"
                      aria-selected={store.sort === order}
                      onclick={() => {
                        chooseSort(order)
                      }}
                      class="menu-option">{order === 'newest' ? '最新在前' : '最早在前'}</button
                    >{/each}
                </div>{/if}
            </div>
            <button
              type="button"
              aria-label="刷新评论"
              title="刷新评论"
              disabled={store.queueBusy || store.actionBusy}
              onclick={() => {
                store.loadComments(true)
              }}
              class={['icon-button', { 'is-spinning': store.queueBusy && !store.queueQuiet }]}
              ><AdminIcon name="refresh" /></button
            >
          </div>{/if}
      </div>
      {#if store.selectedSite}<div role="tablist" aria-label="评论状态" class="tabs">
          <button
            type="button"
            role="tab"
            aria-selected={store.status === 'published'}
            disabled={store.queueBusy || store.actionBusy}
            onclick={() => {
              chooseStatus('published')
            }}
            class="tab">已发布 <span class="count">{store.counts.published}</span></button
          ><span aria-hidden="true" class="tab-sep">｜</span><button
            type="button"
            role="tab"
            aria-selected={store.status === 'deleted'}
            disabled={store.queueBusy || store.actionBusy}
            onclick={() => {
              chooseStatus('deleted')
            }}
            class="tab">已删除 <span class="count">{store.counts.deleted}</span></button
          >
        </div>{/if}
    </div>
  </header>
  <div bind:this={feed} aria-busy={store.queueBusy || store.siteBusy} class="feed">
    {#if store.siteMessage || store.queueMessage}<div class="layout feed-state">
        <section role="alert" class="in-main service-error">
          <h3>评论列表没有加载出来</h3>
          <p>{store.siteMessage || store.queueMessage}</p>
          <button
            type="button"
            disabled={store.queueBusy || store.siteBusy}
            onclick={() => {
              store.siteMessage ? store.loadSites(true) : store.loadComments()
            }}
            class="button">重试</button
          >
        </section>
      </div>{:else if (store.queueBusy && !store.queueQuiet) || store.siteBusy}<div class="layout day">
        <div class="in-main">
          {#each Array.from({ length: 5 }, (_, i) => i + 1) as index (index)}<div
              aria-hidden="true"
              class="skeleton-entry"
            >
              <span></span><span></span><span></span>
            </div>{/each}<span class="visually-hidden">正在加载评论…</span>
        </div>
      </div>{:else if !store.selectedSite}<div class="layout feed-state">
        <p class="in-main feed-empty">
          当前实例还没有站点。<button
            type="button"
            onclick={() => {
              store.switchView('sites')
            }}
            class="quiet-link">新增站点</button
          >
        </p>
      </div>{:else if store.comments.length}{#each groups as group (group.key)}<section
          aria-label={group.name}
          class="day layout"
        >
          <header class="in-margin day-label">
            <p class="day-name">{group.name}</p>
            <p class="day-date">{group.sub}</p>
            <p class="day-count">{group.comments.length} 条</p>
          </header>
          <div class="in-main day-entries">
            {#each group.comments as comment (comment.id)}<article
                id={`c-${comment.id}`}
                tabindex="-1"
                aria-current={store.selectedComment?.id === comment.id ? 'true' : undefined}
                aria-label={`#${comment.id} ${comment.deleted ? '已删除' : comment.username}`}
                onpointerdown={() => {
                  select(comment)
                }}
                class={[
                  'entry',
                  {
                    'is-tombstone': comment.deleted,
                    'is-flash': flashId === comment.id,
                    'is-leaving': leavingId === comment.id
                  }
                ]}
              >
                <header class="entry-head">
                  <div class="entry-who">
                    <span class="entry-author">{comment.deleted ? '已删除' : comment.username}</span
                    >{#if !comment.deleted && comment.email}<span title="私有邮箱" class="entry-mail"
                        ><span class="visually-hidden">私有邮箱 </span><span translate="no">{comment.email}</span></span
                      >{/if}{#if !comment.deleted && safeWebsite(comment.url)}<a
                        href={safeWebsite(comment.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`访客网站 ${comment.url}`}
                        class="entry-site"
                        ><span class="visually-hidden">访客网站 </span><span translate="no"
                          >{comment.url?.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span
                        ></a
                      >{/if}
                  </div>
                  <time datetime={comment.createdAt} title={formatDate(comment.createdAt)} class="entry-time"
                    >{formatDate(comment.createdAt).slice(11) || '时间未知'}</time
                  >
                </header>
                {#if comment.parent && parents.get(comment.parent) && !comment.deleted}<a
                    href={`#c-${comment.parent}`}
                    onclick={(event) => {
                      event.preventDefault()
                      jump(comment.parent)
                    }}
                    class="entry-quote"
                    ><span class="quote-ref"
                      >回复 <span translate="no">{parents.get(comment.parent)?.username}</span></span
                    ><span translate="no" class="quote-text">{quoteText(parents.get(comment.parent))}</span></a
                  >{:else if comment.parent}<p class="entry-quote">
                    <span class="quote-ref"><span class="visually-hidden">父评论 </span>回复 #{comment.parent}</span
                    >{#if !comment.deleted}<span class="quote-text">不在当前页</span>{/if}
                  </p>{/if}
                <p class="entry-copy">
                  {#if comment.deleted}该评论已删除{:else}<SmojiContent
                      content={comment.content}
                      enabled={store.selectedSite?.smojiEnabled === true}
                      manifestUrl={store.selectedSite?.smojiManifestUrl || ''}
                      imageOrigin={store.selectedSite?.smojiImageOrigin}
                    />{/if}
                </p>
                <footer class="entry-foot">
                  <span
                    title={`${comment.pageTitle ? `${comment.pageTitle} · ` : ''}${comment.mark}`}
                    class="entry-page"
                    >{#if comment.pageTitle}<span class="entry-title"
                        ><span class="visually-hidden">文章标题 </span><span translate="no"
                          >《{comment.pageTitle}》</span
                        ></span
                      >{/if}<span class="entry-key"
                      ><span class="visually-hidden">页面 key </span><span translate="no">{comment.mark}</span></span
                    ></span
                  ><span class="entry-actions"
                    ><span class="entry-id">#{comment.id}</span>{#if sourceURL(comment)}<a
                        href={sourceURL(comment)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`查看原评论 #${comment.id}`}
                        class="quiet-link">查看原评论</a
                      >{/if}{#if !comment.deleted || !comment.hasChildren}<button
                        type="button"
                        disabled={store.actionBusy || store.queueBusy}
                        onclick={() => {
                          openConfirm(comment)
                        }}
                        class="quiet-link is-danger">{comment.deleted ? '彻底删除' : '墓碑删除'}</button
                      >{:else}<span class="entry-hint">仍有回复，不能彻底删除</span>{/if}</span
                  >
                </footer>
                {#if actionErrorId === comment.id && store.actionMessage}<p role="alert" class="notice notice-error">
                    {store.actionMessage}
                  </p>{/if}{#if confirmation?.id === comment.id}<div
                    role="alertdialog"
                    aria-labelledby={`confirm-${comment.id}-title`}
                    aria-describedby={`confirm-${comment.id}-copy`}
                    class="entry-confirm"
                  >
                    <p>
                      <strong id={`confirm-${comment.id}-title`}
                        >{confirmation.kind === 'tombstone' ? '墓碑删除这条评论？' : '彻底删除这条墓碑？'}</strong
                      ><span id={`confirm-${comment.id}-copy`}
                        >{confirmation.kind === 'tombstone'
                          ? '昵称、私有邮箱、网站和正文会被清除，公开页面改为显示“已删除”，下面的回复保留不变。此操作无法撤销。'
                          : '这条墓碑会从数据库中移除。此操作无法撤销。'}</span
                      >
                    </p>
                    <div class="confirm-actions">
                      <button
                        type="button"
                        disabled={store.actionBusy}
                        onclick={closeConfirm}
                        class="button button-quiet">取消</button
                      ><button
                        type="button"
                        disabled={store.actionBusy}
                        onclick={confirmAction}
                        class="button button-danger"
                        >{store.actionBusy
                          ? '处理中…'
                          : confirmation.kind === 'tombstone'
                            ? '墓碑删除'
                            : '彻底删除'}</button
                      >
                    </div>
                  </div>{/if}
              </article>{/each}
          </div>
        </section>{/each}{:else}<div class="layout feed-state">
        <p class="in-main feed-empty">当前没有{store.status === 'published' ? '已发布' : '已删除'}评论</p>
      </div>{/if}
  </div>
  {#if store.selectedSite}<footer class="feed-foot layout">
      <nav aria-label="评论列表分页" class="in-main pager">
        <button
          type="button"
          disabled={store.page <= 1 || store.queueBusy || store.actionBusy}
          onclick={() => {
            store.selectPage(store.page - 1)
          }}
          class="pager-button">‹ 上一页</button
        ><span aria-hidden="true" class="pager-sep">｜</span><span aria-live="polite" class="pager-status"
          >{store.page}/{Math.max(store.pageCount, 1)}</span
        ><span aria-hidden="true" class="pager-sep">｜</span><button
          type="button"
          disabled={store.page >= store.pageCount || store.queueBusy || store.actionBusy}
          onclick={() => {
            store.selectPage(store.page + 1)
          }}
          class="pager-button">下一页 ›</button
        >
      </nav>
    </footer>{/if}
</section>
