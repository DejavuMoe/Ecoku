<script lang="ts">
  import { tokenizeAdminSmoji } from '../smoji'

  let {
    content,
    enabled,
    manifestUrl,
    imageOrigin,
    compact = false
  }: {
    content: string
    enabled: boolean
    manifestUrl: string
    imageOrigin?: string
    compact?: boolean
  } = $props()

  let tokens = $derived.by(() => tokenizeAdminSmoji(content, enabled, manifestUrl, imageOrigin))
</script>

<span class={['admin-smoji-content', { 'is-compact': compact }]}
  >{#each tokens as token, index (index)}{#if token.type === 'text'}<span>{token.value}</span>{:else}<img
        src={token.src}
        alt={`[表情：${token.label}]`}
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        class="admin-smoji-inline"
      />{/if}{/each}</span
>
