<script lang="ts">
  import { tick, onMount, onDestroy } from 'svelte'

  import { useAdminStore } from '../stores/admin.svelte'
  import type { SiteSummary } from '../types'
  import AdminIcon from './AdminIcon.svelte'

  let { creating = false, onselect }: { creating?: boolean; onselect: (id: string) => void } = $props()
  const store = useAdminStore()
  let open = $state(false)
  let picker = $state<HTMLElement | null>(null)
  let trigger = $state<HTMLButtonElement | null>(null)
  let menu = $state<HTMLElement | null>(null)
  function label(site: SiteSummary | null): string {
    if (!site) return '没有可用站点'
    if (site.name) return site.name
    try {
      return new URL(site.siteUrl).hostname
    } catch {
      return site.id
    }
  }
  async function toggle() {
    open = !open
    if (open) {
      await tick()
      menu?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    }
  }
  function select(id: string) {
    open = false
    onselect(id)
    trigger?.focus()
  }
  function outside(event: PointerEvent) {
    if (!picker?.contains(event.target as Node)) open = false
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      open = false
      trigger?.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const options = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    const index = options.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
    options[next]?.focus()
  }
  onMount(() => document.addEventListener('pointerdown', outside))
  onDestroy(() => document.removeEventListener('pointerdown', outside))
</script>

<div bind:this={picker} class="site-switch">
  {#if creating}<div class="site-static is-draft">
      <span class="site-name">新站点</span><span class="site-id">尚未保存</span>
    </div>{:else if store.sites.length > 1}<button
      bind:this={trigger}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={`切换站点，当前 ${label(store.selectedSite)}`}
      disabled={store.siteBusy || store.actionBusy}
      onclick={toggle}
      class="site-trigger"
      ><span class="site-name"
        ><span translate="no">{label(store.selectedSite)}</span><AdminIcon name="chevron" class="chevron" /></span
      ><span translate="no" class="site-id">{store.selectedSite?.id}</span></button
    >{:else}<div class="site-static">
      <span class="site-name"
        ><span translate={store.selectedSite ? 'no' : undefined}>{label(store.selectedSite)}</span></span
      >{#if store.selectedSite}<span translate="no" class="site-id">{store.selectedSite.id}</span>{/if}
    </div>{/if}{#if open}<div
      bind:this={menu}
      role="listbox"
      tabindex="-1"
      aria-label="选择站点"
      onkeydown={keydown}
      class="site-menu"
    >
      {#each store.sites as site (site.id)}<button
          type="button"
          role="option"
          aria-selected={store.selectedSiteId === site.id}
          onclick={() => {
            select(site.id)
          }}
          class="site-option"
          ><strong translate="no">{label(site)}</strong><small translate="no">{site.id}</small><AdminIcon
            name="check"
            class="check"
          /></button
        >{/each}
    </div>{/if}
</div>
