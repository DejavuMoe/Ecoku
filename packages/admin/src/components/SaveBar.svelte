<script lang="ts">
  let {
    busy,
    errorCount = 0,
    status = '有未保存的修改',
    saveLabel = '保存',
    discardLabel = '撤销修改',
    onsave,
    ondiscard
  }: {
    busy: boolean
    errorCount?: number
    status?: string
    saveLabel?: string
    discardLabel?: string
    onsave: () => void
    ondiscard: () => void
  } = $props()
</script>

<div class="savebar-dock layout">
  <div role="region" aria-label="保存修改" class={['savebar in-main', { 'is-error': errorCount }]}>
    <p aria-live="polite" class="savebar-status">
      <span aria-hidden="true" class="savebar-dot"></span><span
        >{errorCount ? `有 ${errorCount} 处需要修改` : status}</span
      >
    </p>
    <span class="savebar-actions"
      ><button
        type="button"
        disabled={busy}
        onclick={() => {
          ondiscard()
        }}
        class="button button-quiet">{discardLabel}</button
      ><button
        type="button"
        disabled={busy}
        onclick={() => {
          onsave()
        }}
        class="button button-primary save-button">{busy ? '保存中…' : saveLabel}</button
      ></span
    >
  </div>
</div>
