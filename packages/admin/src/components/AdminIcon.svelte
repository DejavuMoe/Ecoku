<script lang="ts">
  type AdminIconName =
    'refresh' | 'chevron' | 'check' | 'plus' | 'close' | 'comments' | 'sites' | 'notifications' | 'security'

  let { name, class: className = '' }: { name: AdminIconName; class?: string } = $props()

  const paths: Record<AdminIconName, string[]> = {
    refresh: ['M13.5 8a5.5 5.5 0 1 1-1.6-3.9', 'M13.5 2.5v3h-3'],
    chevron: ['m4 6 4 4 4-4'],
    check: ['m3 8.5 3 3 7-7'],
    plus: ['M8 3.5v9M3.5 8h9'],
    close: ['m4.5 4.5 7 7M11.5 4.5l-7 7'],
    comments: ['M4.5 5.5h15v10.5h-8.2L7 19.5V16H4.5Z', 'M8.5 9.5h7M8.5 12.5h4.5'],
    sites: ['M3.5 5h17v14h-17Z', 'M3.5 9h17M6.5 7h.01M8.8 7h.01'],
    notifications: ['M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5Z', 'M10 20.5h4'],
    security: ['M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6Z', 'm9 12 2 2 4-4']
  }
</script>

<svg
  viewBox={['comments', 'sites', 'notifications', 'security'].includes(name) ? '0 0 24 24' : '0 0 16 16'}
  aria-hidden="true"
  focusable="false"
  class={['icon', className]}
  >{#each paths[name] as d (d)}<path {d}></path>{/each}</svg
>
