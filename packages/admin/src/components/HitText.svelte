<script lang="ts">
  import { highlightSegments } from '../search'

  let { text, words = [] }: { text: string; words?: readonly string[] } = $props()

  let parts = $derived(highlightSegments(text, words))
</script>

{#each parts as part, index (index)}{#if part.hit}<mark class="hit">{part.text}</mark>{:else}{part.text}{/if}{/each}
