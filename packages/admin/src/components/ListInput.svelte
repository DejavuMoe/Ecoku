<script lang="ts">
  import { tick, untrack } from 'svelte'

  import AdminIcon from './AdminIcon.svelte'
  import { rowIssue, splitPasted, type ListKind } from '../listInput'

  // One input per item. Enter moves on to the next item, Backspace in an empty item removes it,
  // pasting several lines fills one item each, and an item's problems show once the cursor leaves it.
  // The model holds the trimmed, non-empty items, so a blank row never counts as a change.
  let {
    id,
    modelValue = $bindable(),
    kind,
    label,
    addLabel,
    placeholder,
    max,
    mono,
    inputmode,
    requiredError
  }: {
    id: string
    modelValue: string[]
    kind: ListKind
    label: string
    addLabel: string
    placeholder?: string
    max?: number
    mono?: boolean
    inputmode?: 'url' | 'email' | 'text'
    requiredError?: string
  } = $props()

  interface Row {
    key: number
    value: string
    committed: boolean
  }
  let nextKey = 0
  let rows = $state<Row[]>([])
  let announcement = $state('')
  let root = $state<HTMLElement | null>(null)

  const blank = (): Row => ({ key: nextKey++, value: '', committed: false })
  const filled = (list: readonly Row[]): string[] => list.map((row) => row.value.trim()).filter(Boolean)
  function load(values: readonly string[]) {
    rows = values.length ? values.map((value) => ({ key: nextKey++, value, committed: true })) : [blank()]
  }
  load(modelValue)
  // A new list from outside (a saved site, a discard) replaces the rows; echoes of our own edits do not.

  $effect.pre(() => {
    const values = modelValue
    untrack(() => {
      if (JSON.stringify(values) !== JSON.stringify(filled(rows))) load(values)
    })
  })

  let full = $derived.by(() => max !== undefined && rows.length >= max)
  let count = $derived.by(() => filled(rows).length)
  let issues = $derived.by(() => {
    const values = rows.map((row) => row.value)
    return rows.map((row, index) => (row.committed ? rowIssue(kind, values, index) : null))
  })
  const invalid = (index: number) =>
    Boolean(issues[index] && !issues[index]!.soft) || (index === 0 && Boolean(requiredError))

  function update() {
    modelValue = filled(rows)
  }
  function announce(text: string) {
    announcement = ''
    void tick().then(() => {
      announcement = text
    })
  }
  async function focusRow(index: number) {
    await tick()
    const input = root?.querySelectorAll<HTMLInputElement>('.list-row input')[index]
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }
  function commit(index: number) {
    const row = rows[index]
    if (row?.value.trim()) row.committed = true
  }

  function onInput(index: number, event: Event) {
    rows[index]!.value = (event.target as HTMLInputElement).value
    update()
  }

  function onKeydown(index: number, event: KeyboardEvent) {
    const row = rows[index]!
    if (event.key === 'Enter' && !event.isComposing) {
      // Enter starts the next item instead of submitting the form.
      event.preventDefault()
      commit(index)
      if (index + 1 < rows.length) {
        void focusRow(index + 1)
        return
      }
      if (!row.value.trim()) return
      if (full) {
        announce(`已达上限 ${max} 项`)
        return
      }
      rows.splice(index + 1, 0, blank())
      void focusRow(index + 1)
    } else if (event.key === 'Backspace' && !row.value && rows.length > 1) {
      event.preventDefault()
      rows.splice(index, 1)
      update()
      void focusRow(Math.max(0, index - 1))
    } else if (event.key === 'ArrowDown' && index + 1 < rows.length) {
      event.preventDefault()
      void focusRow(index + 1)
    } else if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault()
      void focusRow(index - 1)
    }
  }

  function onPaste(index: number, event: ClipboardEvent) {
    const parts = splitPasted(event.clipboardData?.getData('text') ?? '')
    if (parts.length < 2) return
    event.preventDefault()
    let at = index + 1
    if (!rows[index]!.value.trim()) {
      rows.splice(index, 1)
      at = index
    }
    const room = max === undefined ? parts.length : Math.max(0, max - rows.length)
    const taken = parts.slice(0, room)
    rows.splice(at, 0, ...taken.map((value) => ({ key: nextKey++, value, committed: true })))
    if (!rows.length) rows.push(blank())
    update()
    void focusRow(Math.max(0, at + taken.length - 1))
    const dropped = parts.length - taken.length
    announce(
      dropped ? `已添加 ${taken.length} 项；最多 ${max} 项，其余 ${dropped} 项未添加` : `已添加 ${taken.length} 项`
    )
  }

  function remove(index: number) {
    if (rows.length === 1) rows = [blank()]
    else rows.splice(index, 1)
    update()
    announce(`已删除第 ${index + 1} 项`)
    void focusRow(Math.min(index, rows.length - 1))
  }

  function add() {
    const last = rows.length - 1
    if (!rows[last]!.value.trim()) {
      void focusRow(last)
      return
    }
    if (full) return
    rows.push(blank())
    void focusRow(last + 1)
  }

  function applyFix(index: number, value: string) {
    const row = rows[index]!
    row.value = value
    row.committed = true
    update()
    announce(`已改为 ${value}`)
    void focusRow(index)
  }

  // Saving shows every item's problem, including items the cursor has not left yet.
  export function reveal() {
    for (const row of rows) if (row.value.trim()) row.committed = true
  }
</script>

<div {id} bind:this={root} class="list-field">
  <!-- Buttons take the press without taking focus, so the item being edited is not blurred
         (and its error shown, shifting the layout) between press and release. -->
  <ul class="list-rows">
    {#each rows as row, index (row.key)}<li class="list-row">
        <input
          id={`${id}-${index}`}
          value={row.value}
          type="text"
          {inputmode}
          autocomplete="off"
          spellcheck="false"
          placeholder={index === 0 ? placeholder : undefined}
          aria-label={`${label}，第 ${index + 1} 项`}
          aria-invalid={invalid(index) ? 'true' : undefined}
          aria-describedby={issues[index] ? `${id}-${index}-note` : undefined}
          oninput={(event) => {
            onInput(index, event)
          }}
          onkeydown={(event) => {
            onKeydown(index, event)
          }}
          onpaste={(event) => {
            onPaste(index, event)
          }}
          onblur={() => {
            commit(index)
          }}
          class={['input', { mono }]}
        /><button
          type="button"
          aria-label={`删除${label}第 ${index + 1} 项`}
          title="删除"
          onmousedown={(event) => {
            event.preventDefault()
          }}
          onclick={() => {
            remove(index)
          }}
          class={['row-remove', { 'is-idle': rows.length === 1 && !row.value }]}><AdminIcon name="close" /></button
        >{#if issues[index]}<p id={`${id}-${index}-note`} class={['row-note', { 'is-soft': issues[index]!.soft }]}>
            <span>{issues[index]!.text}</span>{#if issues[index]!.fix}<button
                type="button"
                onmousedown={(event) => {
                  event.preventDefault()
                }}
                onclick={() => {
                  applyFix(index, issues[index]!.fix!)
                }}
                class="row-fix">改为 <span translate="no" class="mono">{issues[index]!.fix}</span></button
              >{/if}
          </p>{/if}
      </li>{/each}
  </ul>
  <div class="list-foot">
    <button
      type="button"
      disabled={full}
      onmousedown={(event) => {
        event.preventDefault()
      }}
      onclick={add}
      class="list-add"><AdminIcon name="plus" /><span>{full ? `已达上限 ${max} 项` : addLabel}</span></button
    >{#if max !== undefined}<span aria-hidden="true" class="list-count">{count}/{max}</span>{/if}
  </div>
  <p aria-live="polite" class="visually-hidden">{announcement}</p>
</div>
