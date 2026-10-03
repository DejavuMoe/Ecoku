import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./identity-store', () => ({
  VISITOR_IDENTITY_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  loadVisitorIdentity: vi.fn(),
  saveVisitorIdentity: vi.fn(),
}))

import Ecoku from './ecoku'
import * as captcha from './captcha'
import * as smoji from './smoji'
import { resolveConfig } from './config'
import {
  loadVisitorIdentity,
  saveVisitorIdentity,
  VISITOR_IDENTITY_TTL_MS,
} from './identity-store'
import { zhCN } from './messages'

type RawComment = Record<string, unknown>

const activeClients: Ecoku[] = []

function comment(id: number, parent: number, content: string, extra: RawComment = {}): RawComment {
  return {
    id,
    site_id: 'site-a',
    mark: 'article-a',
    parent,
    username: `Author ${id}`,
    content,
    deleted: false,
    created_at: `2026-08-12T0${Math.min(id, 9)}:00:00Z`,
    updated_at: `2026-08-12T0${Math.min(id, 9)}:00:00Z`,
    ...extra,
  }
}

function jsonResponse(status: number, data: unknown, message = 'ok'): Response {
  return new Response(JSON.stringify({ code: status, message, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function listResponse(
  comments: RawComment[],
  options: {
    page?: number
    pageCount?: number
    total?: number
    commentTotal?: number
    formConfig?: {
      i18n?: 'zh-CN' | 'zh-Hant' | 'en'
      emailRequired: boolean
      websiteRequired: boolean
      placeholder: string
      defaultSort?: 'oldest' | 'newest'
      lengthLimit?: number
      emptyMessage?: string
      bloggerBadge?: string
      turnstileSitekey?: string
      bloggerProofEnabled?: boolean
      captcha?: { provider: 'off' | 'turnstile' | 'cap'; sitekey: string; instanceUrl?: string }
      smoji?: { enabled: boolean; manifestUrl: string; imageOrigin?: string }
    }
    timeZone?: string
  } = {},
): Response {
  return jsonResponse(200, {
    data: comments,
    total: options.total ?? comments.filter((item) => item.parent === 0).length,
    commentTotal: options.commentTotal ?? comments.length,
    page: options.page ?? 1,
    pageSize: 3,
    pageCount: options.pageCount ?? (comments.length > 0 ? 1 : 0),
    timeZone: options.timeZone ?? 'Asia/Shanghai',
    formConfig: options.formConfig ?? {
      emailRequired: true,
      websiteRequired: false,
      placeholder: zhCN.commentPlaceholder,
      defaultSort: 'newest',
      lengthLimit: 1000,
      emptyMessage: '还没有评论\n成为第一个留下评论的人。',
    },
  })
}

function createClient(
  fetchMock: typeof fetch,
  pageKey = 'article-a',
  options: { i18n?: 'zh-CN' | 'zh-Hant' | 'en' } = {},
): { client: Ecoku; container: HTMLElement } {
  vi.stubGlobal('fetch', fetchMock)
  const container = document.createElement('div')
  document.body.append(container)
  const client = new Ecoku({
    container,
    serverURL: 'https://comments.example/base/',
    siteId: 'site-a',
    pageKey,
    pageTitle: '测试文章',
    pageSize: 3,
    theme: 'light',
    ...options,
  })
  activeClients.push(client)
  return { client, container }
}

function setValue(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  control.value = value
  control.dispatchEvent(new Event('input', { bubbles: true }))
}

function fillIdentityAndContent(container: HTMLElement, content = 'Root submission'): HTMLFormElement {
  setValue(container.querySelector<HTMLInputElement>('input[type="text"]')!, 'Guest')
  setValue(container.querySelector<HTMLInputElement>('input[type="email"]')!, 'guest@example.com')
  setValue(container.querySelector<HTMLInputElement>('input[type="url"]')!, 'https://guest.example/profile')
  setValue(container.querySelector<HTMLTextAreaElement>('.ecoku-composer .ecoku-textarea')!, content)
  return container.querySelector<HTMLFormElement>('.ecoku-composer')!
}

async function submitForm(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
  await Promise.resolve()
}

beforeEach(() => {
  document.body.replaceChildren()
  vi.mocked(loadVisitorIdentity).mockReset().mockResolvedValue(null)
  vi.mocked(saveVisitorIdentity).mockReset().mockResolvedValue(true)
})

afterEach(() => {
  for (const client of activeClients.splice(0)) client.destroy()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('approved production comment surface', () => {
  it('supports three locales and rejects an unknown SDK override', () => {
    const base = { container: document.createElement('div'), serverURL: 'https://example.test', siteId: 'blog', pageKey: '/' }
    for (const i18n of ['zh-CN', 'zh-Hant', 'en'] as const) expect(resolveConfig({ ...base, i18n }).i18n).toBe(i18n)
    expect(() => resolveConfig({ ...base, i18n: 'fr' as never })).toThrow(/i18n/)
  })
  it('validates the explicit container, server, site, page, page size, and theme contract', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const valid = {
      container,
      serverURL: 'https://comments.example/',
      siteId: 'site-a',
      pageKey: 'article-a',
    }
    expect(resolveConfig(valid).serverURL).toBe('https://comments.example/')
    expect(resolveConfig({ ...valid, serverURL: undefined, apiBaseUrl: 'https://legacy.example' }).serverURL).toBe('https://legacy.example/')
    expect(() => resolveConfig({ ...valid, container: '#missing' })).toThrow(/container/)
    expect(() => resolveConfig({ ...valid, serverURL: 'ftp://comments.example' })).toThrow(/serverURL/)
    expect(() => resolveConfig({ ...valid, siteId: 'bad site' })).toThrow(/siteId/)
    expect(() => resolveConfig({ ...valid, pageKey: '  ' })).toThrow(/pageKey/)
    expect(() => resolveConfig({ ...valid, pageSize: 101 })).toThrow(/pageSize/)
    expect(() => resolveConfig({ ...valid, theme: 'neon' as 'light' })).toThrow(/theme/)
    expect(resolveConfig(valid).cssURL).toBe('')
    expect(resolveConfig({ ...valid, cssURL: 'none' }).cssURL).toBe('none')
    expect(resolveConfig({ ...valid, cssURL: 'https://cdn.example/theme.css' }).cssURL).toBe('https://cdn.example/theme.css')
    expect(() => resolveConfig({ ...valid, cssURL: 'javascript:alert(1)' })).toThrow(/cssURL/)
  })

  it('renders the approved form without explanatory prompt copy', async () => {
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse([])))
    await client.init()

    expect(Array.from(container.querySelectorAll('.ecoku-field-label')).map((label) => label.textContent))
      .toEqual(['昵称', '邮箱', '网址'])
    expect(container.querySelector<HTMLInputElement>('input[type="text"]')?.required).toBe(true)
    expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.required).toBe(true)
    expect(container.querySelector<HTMLInputElement>('input[type="url"]')?.required).toBe(false)
    expect(container.querySelector<HTMLInputElement>('input[type="url"]')?.placeholder).toBe('')
    expect(container.querySelector('.ecoku-identity-requirements')).toBeNull()
    expect(container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')?.placeholder)
      .toBe(zhCN.commentPlaceholder)
    expect(container.querySelector('.ecoku-composer-guidance')).toBeNull()
    expect(container.querySelector('.ecoku-comments style')).not.toBeNull()
    expect(container.querySelector('.ecoku-loading-state')).toBeNull()
  })

  it('skips injected styles when cssURL is none', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(listResponse([])))
    const container = document.createElement('div')
    document.body.append(container)
    const client = new Ecoku({
      container,
      serverURL: 'https://comments.example/base/',
      siteId: 'site-a',
      pageKey: 'article-a',
      cssURL: 'none',
    })
    activeClients.push(client)
    await client.init()
    expect(container.querySelector('.ecoku-comments style')).toBeNull()
    expect(container.querySelector('.ecoku-composer')).not.toBeNull()
  })

  it('applies site-configured optional email, required website, and custom placeholder to validation and submission', async () => {
    const posts: Record<string, unknown>[] = []
    const formConfig = {
      emailRequired: false,
      websiteRequired: true,
      placeholder: '说说你对这篇文章的看法',
      defaultSort: 'oldest' as const,
      lengthLimit: 321,
      emptyMessage: '暂时没有评论',
    }
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) {
        posts.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return jsonResponse(201, { id: 41 }, 'submitted')
      }
      return listResponse([], { formConfig })
    })
    const { client, container } = createClient(fetchMock)
    await client.init()

    const nickname = container.querySelector<HTMLInputElement>('input[type="text"]')!
    const email = container.querySelector<HTMLInputElement>('input[type="email"]')!
    const website = container.querySelector<HTMLInputElement>('input[type="url"]')!
    const content = container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')!
    const form = container.querySelector<HTMLFormElement>('.ecoku-composer')!
    expect(email.required).toBe(false)
    expect(website.required).toBe(true)
    expect(content.placeholder).toBe(formConfig.placeholder)
    expect(container.querySelector('.ecoku-identity-requirements')).toBeNull()
    expect(content.maxLength).toBe(642)
    expect(container.textContent).toContain('暂时没有评论')

    setValue(nickname, 'Guest')
    setValue(content, 'Configured submission')
    setValue(email, 'not-an-email')
    setValue(website, 'https://guest.example/profile')
    await submitForm(form)
    expect(container.querySelector('.ecoku-form-error')?.textContent).toBe(zhCN.emailInvalid)

    setValue(email, '')
    setValue(website, '')
    await submitForm(form)
    expect(container.querySelector('.ecoku-form-error')?.textContent).toBe(zhCN.websiteRequiredInvalid)

    setValue(website, 'https://guest.example/profile')
    await submitForm(form)
    await vi.waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({
      siteId: 'site-a',
      mark: 'article-a',
      pageTitle: '测试文章',
      username: 'Guest',
      url: 'https://guest.example/profile',
      content: 'Configured submission',
      parent: 0,
    })
  })

  it('falls back to the approved comment placeholder when a response contains an empty or oversized value', async () => {
    for (const placeholder of ['   ', '字'.repeat(81)]) {
      const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse([], {
        formConfig: { emailRequired: true, websiteRequired: false, placeholder },
      })))
      await client.init()
      expect(container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')?.placeholder)
        .toBe(zhCN.commentPlaceholder)
      client.destroy()
    }
  })

  it('renders approved roots and descendants beyond three levels with capped visual indentation', async () => {
    const comments = [
      comment(1, 0, 'root'),
      comment(2, 1, 'child'),
      comment(3, 2, 'grandchild'),
      comment(4, 3, 'great-grandchild'),
      comment(5, 4, 'semantic level five'),
      comment(6, 5, 'semantic level six'),
    ]
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(listResponse(comments))
    const { client, container } = createClient(fetchMock)
    await client.init()

    const rows = container.querySelectorAll<HTMLElement>('.ecoku-comment-row')
    expect(rows).toHaveLength(6)
    expect(container.textContent).toContain('semantic level six')
    expect(rows[5]?.parentElement?.getAttribute('aria-level')).toBe('6')
    expect(rows[5]?.style.getPropertyValue('--ecoku-depth')).toBe('3')
    const replyTarget = rows[5]?.parentElement?.querySelector<HTMLAnchorElement>('.ecoku-reply-context')
    expect(replyTarget?.textContent).toBe('@Author 5')
    expect(replyTarget?.getAttribute('href')).toBe('#ecoku-comment-5')
    expect(replyTarget?.title).toBe(zhCN.replyTarget)
    expect(rows[5]?.querySelectorAll('.ecoku-text-action')).toHaveLength(1)
    expect(rows[5]?.querySelector('.ecoku-comment-meta .ecoku-text-action')?.textContent).toBe(zhCN.reply)
    expect(rows[5]?.querySelector('.ecoku-comment-actions')).toBeNull()
    const requestURL = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(requestURL.searchParams.has('sort')).toBe(false)
  })

  it('orders composer actions, previews Smoji safely, and closes the picker on an outside pointer', async () => {
    const manifestUrl = 'https://static.example.test/smoji.json'
    const marker = '![smoji:挥手](https://static.example.test/wave.webp)'
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === manifestUrl) {
        return new Response(JSON.stringify({
          version: 1,
          packs: [{ id: 'demo', label: '示例', items: [{ id: 'wave', label: '挥手', src: './wave.webp' }] }],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return listResponse([], {
        formConfig: {
          emailRequired: false,
          websiteRequired: false,
          placeholder: '评论',
          smoji: { enabled: true, manifestUrl },
        },
      })
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    const form = container.querySelector<HTMLFormElement>('.ecoku-composer')!
    const labels = Array.from(form.querySelectorAll<HTMLButtonElement>('.ecoku-composer-end > button, .ecoku-composer-end > .ecoku-smoji-control > button'))
      .map((button) => button.textContent)
    expect(labels).toEqual(['表情', '预览', '发布'])

    const textarea = form.querySelector<HTMLTextAreaElement>('textarea')!
    setValue(textarea, `正文 ${marker}`)
    form.querySelector<HTMLButtonElement>('.ecoku-preview-trigger')!.click()
    expect(form.querySelector<HTMLImageElement>('.ecoku-composer-preview img')?.alt).toBe('[表情：挥手]')

    form.querySelector<HTMLButtonElement>('.ecoku-smoji-trigger')!.click()
    await vi.waitFor(() => expect(form.querySelectorAll('.ecoku-smoji-item')).toHaveLength(1))
    const panel = form.querySelector<HTMLElement>('.ecoku-smoji-panel')!
    expect(panel.hidden).toBe(false)
    expect(panel.getAttribute('role')).toBe('dialog')
    const tab = panel.querySelector<HTMLElement>('[role=tab]')!
    expect(document.getElementById(tab.getAttribute('aria-controls')!)?.getAttribute('aria-labelledby')).toBe(tab.id)
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panel.hidden).toBe(true)
    expect(document.activeElement).toBe(form.querySelector('.ecoku-smoji-trigger'))
    form.querySelector<HTMLButtonElement>('.ecoku-smoji-trigger')!.click()
    form.querySelector<HTMLButtonElement>('.ecoku-smoji-item')!.click()
    expect(panel.hidden).toBe(true)
    expect(textarea.value).toContain(marker)
    form.querySelector<HTMLButtonElement>('.ecoku-smoji-trigger')!.click()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(panel.hidden).toBe(true)
    expect(form.querySelector('.ecoku-smoji-trigger')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps fold controls after the timestamp and hides reply while collapsed', async () => {
    const comments = [
      comment(1, 0, 'root'),
      comment(2, 1, 'child'),
      comment(3, 0, 'leaf root'),
    ]
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse(comments, {
      timeZone: 'Asia/Singapore',
    })))
    await client.init()

    const parent = container.querySelector<HTMLElement>('[data-comment-id="1"]')!
    const leaf = container.querySelector<HTMLElement>('[data-comment-id="3"]')!
    const collapse = parent.querySelector<HTMLButtonElement>('.ecoku-collapse-button')!
    const timeLink = parent.querySelector<HTMLAnchorElement>('.ecoku-comment-time')!
    const reply = parent.querySelector<HTMLButtonElement>('.ecoku-reply-action')!
    expect(leaf.querySelector('.ecoku-collapse-button')).toBeNull()
    expect(leaf.querySelector('.ecoku-collapse-placeholder')).toBeNull()
    expect(timeLink.nextElementSibling).toBe(collapse)
    expect(collapse.textContent).toBe('[-]')
    expect(collapse.getAttribute('aria-expanded')).toBe('true')
    expect(collapse.getAttribute('aria-label')).toBe(zhCN.collapse)
    expect(timeLink.textContent).toBe('2026-08-12 09:00')
    expect(timeLink.title).toBe('Asia/Singapore UTC+8')
    expect(timeLink.getAttribute('aria-label')).toBe('2026-08-12 09:00, Asia/Singapore UTC+8')
    expect(reply.hidden).toBe(false)
    collapse.click()
    expect(collapse.textContent).toBe('[+]')
    expect(collapse.getAttribute('aria-expanded')).toBe('false')
    expect(collapse.getAttribute('aria-label')).toBe(zhCN.expand)
    expect(reply.hidden).toBe(true)
    expect(parent.querySelector('.ecoku-folded-summary')?.textContent).toBe('已折叠 1 条回复')
    expect(parent.parentElement?.querySelector<HTMLElement>('.ecoku-children')?.hidden).toBe(true)
  })

  it('shows a blogger badge after matching nicknames and hides it when the mark is empty', async () => {
    const comments = [
      comment(1, 0, 'blogger note', { username: 'Dejavu Moe', url: 'https://blog.example.test/', isBlogger: true }),
      comment(2, 0, 'guest note', { username: '访客', isBlogger: false }),
    ]
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(listResponse(comments, {
      formConfig: {
        emailRequired: true,
        websiteRequired: false,
        placeholder: zhCN.commentPlaceholder,
        bloggerBadge: '[OP]',
      },
    }))
    const { client, container } = createClient(fetchMock)
    await client.init()

    const blogger = container.querySelector('[data-comment-id="1"]')!
    const guest = container.querySelector('[data-comment-id="2"]')!
    expect(blogger.querySelector('.ecoku-comment-author')?.textContent).toBe('Dejavu Moe')
    expect(blogger.querySelector('.ecoku-blogger-badge')?.textContent).toBe('[OP]')
    expect(guest.querySelector('.ecoku-blogger-badge')).toBeNull()

    fetchMock.mockResolvedValue(listResponse(comments, {
      formConfig: {
        emailRequired: true,
        websiteRequired: false,
        placeholder: zhCN.commentPlaceholder,
        bloggerBadge: '',
      },
    }))
    await client.reload()
    expect(container.querySelector('.ecoku-blogger-badge')).toBeNull()
  })

  it('lets a blogger submit only a passphrase and does not store it as visitor identity', async () => {
    const posts: Record<string, unknown>[] = []
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) {
        posts.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return jsonResponse(201, { id: 12, isBlogger: true }, 'submitted')
      }
      return listResponse([], {
        formConfig: {
          emailRequired: true,
          websiteRequired: false,
          placeholder: zhCN.commentPlaceholder,
          bloggerProofEnabled: true,
        },
      })
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    const form = container.querySelector<HTMLFormElement>('.ecoku-composer')!
    setValue(container.querySelector<HTMLInputElement>('input[type="text"]')!, 'correct-horse-battery')
    setValue(container.querySelector<HTMLTextAreaElement>('.ecoku-composer .ecoku-textarea')!, 'Blogger note')
    await submitForm(form)
    await vi.waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({
      username: 'correct-horse-battery',
      content: 'Blogger note',
    })
    expect(posts[0]).not.toHaveProperty('email')
    expect(posts[0]).not.toHaveProperty('url')
    expect(saveVisitorIdentity).not.toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(container.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe('')
    })
  })

  it('keeps the reply identity grid visible when only a passphrase-like nickname is filled', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(listResponse(
      [comment(1, 0, 'existing root')],
      {
        formConfig: {
          emailRequired: true,
          websiteRequired: false,
          placeholder: zhCN.commentPlaceholder,
          bloggerProofEnabled: true,
        },
      },
    ))
    const { client, container } = createClient(fetchMock)
    await client.init()
    setValue(container.querySelector<HTMLInputElement>('.ecoku-composer input[type="text"]')!, 'correct-horse-battery')
    container.querySelector<HTMLButtonElement>('[data-comment-id="1"] .ecoku-text-action')!.click()
    const reply = container.querySelector<HTMLFormElement>('.ecoku-reply-composer')!
    expect(reply.querySelector<HTMLElement>('.ecoku-reply-identity-grid')?.hidden).toBe(false)
  })

  it('renders a 52-comment fixture with complete one-to-six-level semantics and the approved count-only heading', async () => {
    const comments: RawComment[] = [comment(1, 0, 'root level one')]
    for (let id = 2; id <= 6; id += 1) comments.push(comment(id, id - 1, `nested level ${id}`))
    for (let id = 7; id <= 52; id += 1) comments.push(comment(id, 0, `root fixture ${id}`))
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse(comments, {
      total: 47,
      commentTotal: 52,
    })))
    await client.init()

    expect(container.querySelectorAll('.ecoku-comment-row')).toHaveLength(52)
    expect(container.querySelector('.ecoku-section-title')?.textContent).toBe('52 条评论')
    expect(container.querySelector('.ecoku-section-heading')?.textContent).not.toContain('讨论')
    const composer = container.querySelector('.ecoku-composer')
    const heading = container.querySelector('.ecoku-section-heading')
    expect(composer).not.toBeNull()
    expect(heading).not.toBeNull()
    expect(composer!.compareDocumentPosition(heading!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('.ecoku-composer-footer')?.firstElementChild?.classList.contains('ecoku-character-count')).toBe(true)
    expect(container.querySelector('.ecoku-composer .ecoku-primary-button')?.textContent).toBe('发布')
    expect(container.querySelector('[data-depth="6"]')?.getAttribute('aria-level')).toBe('6')
  })

  it('uses a themed keyboard-operable sorter with the approved labels and reloads newest comments', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(listResponse([comment(1, 0, 'root')]))
    const { client, container } = createClient(fetchMock)
    await client.init()

    expect(container.querySelector('select')).toBeNull()
    const trigger = container.querySelector<HTMLButtonElement>('.ecoku-sort-trigger')!
    expect(trigger.textContent).toContain(zhCN.sortNewest)
    trigger.click()
    const oldest = Array.from(container.querySelectorAll<HTMLButtonElement>('.ecoku-sort-option'))
      .find((option) => option.textContent === zhCN.sortOldest)!
    oldest.click()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.get('sort')).toBe('oldest')
    expect(trigger.textContent).toContain(zhCN.sortOldest)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('applies the server locale to the whole public surface and keeps custom copy intact', async () => {
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse([], {
      formConfig: {
        i18n: 'en', emailRequired: true, websiteRequired: false,
        placeholder: zhCN.commentPlaceholder, emptyMessage: 'No custom comments yet',
        defaultSort: 'oldest', lengthLimit: 1000,
      },
    })))
    await client.init()

    expect(container.querySelector('.ecoku-comments')?.getAttribute('lang')).toBe('en')
    expect(container.querySelector('.ecoku-comment-section')?.getAttribute('aria-label')).toBe('Comments')
    expect(container.querySelector('.ecoku-sort-option[data-sort="newest"]')?.textContent).toBe('Newest')
    expect(container.querySelector('.ecoku-sort-option[data-sort="oldest"]')?.textContent).toBe('Oldest')
    expect(container.querySelector<HTMLTextAreaElement>('.ecoku-textarea')?.placeholder).toBe('Write a plain-text comment')
    expect(container.querySelector('.ecoku-empty-state')?.textContent).toContain('No custom comments yet')
  })

  it('lets the SDK i18n option override the site language for copy, lang and the challenge widget', async () => {
    const mount = vi.spyOn(captcha, 'mountChallenge').mockResolvedValue(null)
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse([], {
      formConfig: {
        i18n: 'en', emailRequired: true, websiteRequired: false,
        placeholder: zhCN.commentPlaceholder, emptyMessage: '还没有评论\n成为第一个留下评论的人。',
        captcha: { provider: 'cap', sitekey: 'cap-site', instanceUrl: 'https://cap.example' },
      },
    })), 'article-a', { i18n: 'zh-Hant' })
    await client.init()

    expect(container.querySelector('.ecoku-comments')?.getAttribute('lang')).toBe('zh-Hant')
    expect(container.querySelector('.ecoku-composer .ecoku-primary-button')?.textContent).toBe('發布')
    expect(container.querySelector('.ecoku-empty-state')?.textContent).toBe('還沒有評論\n成為第一個留下評論的人。')
    await vi.waitFor(() => expect(mount).toHaveBeenCalled())
    expect(mount.mock.calls.every(call => call[3] === 'zh-Hant')).toBe(true)
  })

  it('writes the SDK language into the first-paint and failure copy before any site config arrives', async () => {
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(500, null)), 'article-a', { i18n: 'en' })
    await client.init().catch(() => undefined)

    await vi.waitFor(() => expect(container.querySelector<HTMLElement>('.ecoku-service-error')?.hidden).toBe(false))
    expect(container.querySelector('.ecoku-service-error h3')?.textContent).toBe('Comments are temporarily unavailable')
    expect(container.querySelector('.ecoku-service-error button')?.textContent).toBe('Reload')
    expect(container.querySelector('.ecoku-section-title')?.textContent).toBe('No comments')
    expect(container.querySelector('.ecoku-pagination')?.textContent).toContain('Next ›')
  })

  it('localizes the default blogger badge and the reply action, but keeps a custom badge as written', async () => {
    const comments = [comment(1, 0, 'note', { username: 'Owner', isBlogger: true })]
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(listResponse(comments, {
      formConfig: { i18n: 'zh-Hant', emailRequired: true, websiteRequired: false, placeholder: zhCN.commentPlaceholder, bloggerBadge: '[博主]' },
    }))
    const { client, container } = createClient(fetchMock, 'article-a', { i18n: 'en' })
    await client.init()
    expect(container.querySelector('.ecoku-blogger-badge')?.textContent).toBe('[Blogger]')
    expect(container.querySelector('.ecoku-reply-action')?.textContent).toBe('Reply')

    fetchMock.mockResolvedValue(listResponse(comments, {
      formConfig: { i18n: 'zh-Hant', emailRequired: true, websiteRequired: false, placeholder: zhCN.commentPlaceholder, bloggerBadge: '[OP]' },
    }))
    await client.reload()
    expect(container.querySelector('.ecoku-blogger-badge')?.textContent).toBe('[OP]')
  })

  it('uses Traditional Chinese for every reply action', async () => {
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse([comment(1, 0, 'note')], {
      formConfig: { i18n: 'zh-Hant', emailRequired: true, websiteRequired: false, placeholder: zhCN.commentPlaceholder },
    })))
    await client.init()
    expect(container.querySelector('.ecoku-reply-action')?.textContent).toBe('回覆')
  })

  it('renders hostile content only as text and never renders private response fields', async () => {
    const hostile = '<script>window.__ecoku_xss = true</script>\n**not markdown**'
    const comments = [
      comment(1, 0, hostile, {
        email: 'private@example.com',
        management_key: 'private-management-key',
      }),
    ]
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse(comments, { commentTotal: 1 })))
    await client.init()

    const copy = container.querySelector('.ecoku-comment-copy p')
    expect(copy?.textContent).toBe(hostile)
    expect(copy?.querySelector('script')).toBeNull()
    expect(container.textContent).not.toContain('private@example.com')
    expect(container.textContent).not.toContain('private-management-key')
  })

  it('renders a fixed tombstone with descendants and no reply entry on the tombstone', async () => {
    const comments = [
      comment(1, 0, 'deleted secret', {
        deleted: true,
        username: 'Deleted Private Author',
        url: 'https://deleted.example/private',
      }),
      comment(2, 1, 'surviving child'),
    ]
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse(comments)))
    await client.init()

    const tombstone = container.querySelector<HTMLElement>('[data-comment-id="1"]')!
    const tombstoneRow = tombstone.firstElementChild as HTMLElement
    expect(tombstoneRow.textContent).toContain(zhCN.deletedBody)
    expect(tombstoneRow.textContent).not.toContain('deleted secret')
    expect(tombstoneRow.textContent).not.toContain('Deleted Private Author')
    expect(tombstoneRow.querySelector('.ecoku-text-action')).toBeNull()
    expect(container.textContent).toContain('surviving child')
  })

  it('accepts only safe author websites and applies the approved relationship attributes', async () => {
    const comments = [
      comment(1, 0, 'safe link', { url: 'https://author.example/profile' }),
      comment(2, 0, 'unsafe link', { url: 'javascript:alert(1)' }),
    ]
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse(comments)))
    await client.init()

    const safeAuthor = container.querySelector<HTMLAnchorElement>('[data-comment-id="1"] .ecoku-comment-author')!
    expect(safeAuthor.href).toBe('https://author.example/profile')
    expect(new Set(safeAuthor.rel.split(/\s+/))).toEqual(new Set(['nofollow', 'ugc', 'noopener', 'noreferrer']))
    expect(safeAuthor.target).toBe('_blank')
    expect(container.querySelector('[data-comment-id="2"] a.ecoku-comment-author')).toBeNull()
    expect(container.querySelector('.ecoku-comment-permalink')).toBeNull()
    expect(container.textContent).not.toContain('链接')
  })

  it('submits root comments and replies with the exact public API fields', async () => {
    const posts: Record<string, unknown>[] = []
    const initialComments = [comment(1, 0, 'existing root')]
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) {
        posts.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return jsonResponse(201, { id: posts.length + 10 }, 'submitted')
      }
      return listResponse(initialComments)
    })
    const { client, container } = createClient(fetchMock)
    await client.init()

    await submitForm(fillIdentityAndContent(container))
    await vi.waitFor(() => expect(posts).toHaveLength(1))
    await vi.waitFor(() => expect(container.querySelector('.ecoku-text-action')).not.toBeNull())
    expect(posts[0]).toEqual({
      siteId: 'site-a',
      mark: 'article-a',
      pageTitle: '测试文章',
      username: 'Guest',
      email: 'guest@example.com',
      url: 'https://guest.example/profile',
      content: 'Root submission',
      parent: 0,
    })

    await vi.waitFor(() => expect(container.querySelector('.ecoku-status-line')?.textContent).toBe(zhCN.submitted))
    container.querySelector<HTMLButtonElement>('.ecoku-text-action')!.click()
    const replyContent = container.querySelector<HTMLTextAreaElement>('.ecoku-reply-composer textarea')!
    setValue(replyContent, 'Nested reply')
    await submitForm(container.querySelector<HTMLFormElement>('.ecoku-reply-composer')!)
    await vi.waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]?.parent).toBe(1)
    expect(posts[1]?.content).toBe('Nested reply')
  })

  it('opens an inline reply identity form instead of redirecting an unidentified visitor to the root composer', async () => {
    const { client, container } = createClient(
      vi.fn<typeof fetch>().mockResolvedValue(listResponse([comment(1, 0, 'existing root')])),
    )
    await client.init()

    const rootNickname = container.querySelector<HTMLInputElement>('.ecoku-composer input[type="text"]')!
    container.querySelector<HTMLButtonElement>('[data-comment-id="1"] .ecoku-text-action')!.click()

    const reply = container.querySelector<HTMLFormElement>('.ecoku-reply-composer')!
    const replyGrid = reply.querySelector<HTMLElement>('.ecoku-reply-identity-grid')!
    const replyNickname = reply.querySelector<HTMLInputElement>('input[type="text"]')!
    expect(replyGrid.hidden).toBe(false)
    expect(document.activeElement).toBe(replyNickname)
    expect(rootNickname.value).toBe('')
    expect(container.querySelector('.ecoku-root-identity-error')).toBeNull()
    expect(reply.textContent).not.toContain('回复 Author 1')
    expect(reply.querySelector('.ecoku-reply-heading')).toBeNull()
    expect(reply.querySelector('.ecoku-reply-identity-summary')).toBeNull()
    expect(reply.querySelector('.ecoku-identity-change')).toBeNull()
    expect(reply.querySelector('.ecoku-primary-button')?.textContent).toBe(zhCN.submitReply)
    expect(Number(reply.querySelector('textarea')?.rows)).toBe(7)
    expect(Number(container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')?.rows)).toBe(7)
    expect(reply.classList.contains('ecoku-composer')).toBe(true)
    expect(reply.querySelector('.ecoku-identity-grid')).not.toBeNull()
    expect(reply.querySelector('.ecoku-message-field textarea')).not.toBeNull()
    expect(reply.querySelector('.ecoku-composer-footer')?.firstElementChild?.classList.contains('ecoku-character-count')).toBe(true)
    expect(Array.from(reply.querySelectorAll<HTMLButtonElement>('.ecoku-composer-end button')).map((button) => button.textContent))
      .toEqual(['表情', '预览', zhCN.cancel, zhCN.submitReply])
  })

  it('submits an inline reply with the identity entered beside that reply and remembers it after success', async () => {
    const posts: Record<string, unknown>[] = []
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) {
        posts.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return jsonResponse(201, { id: 2 }, 'submitted')
      }
      return listResponse([comment(1, 0, 'existing root')])
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    container.querySelector<HTMLButtonElement>('[data-comment-id="1"] .ecoku-text-action')!.click()

    const reply = container.querySelector<HTMLFormElement>('.ecoku-reply-composer')!
    setValue(reply.querySelector<HTMLInputElement>('input[type="text"]')!, 'Reply Guest')
    setValue(reply.querySelector<HTMLInputElement>('input[type="email"]')!, 'reply@example.com')
    setValue(reply.querySelector<HTMLInputElement>('input[type="url"]')!, 'https://reply.example/profile')
    setValue(reply.querySelector<HTMLTextAreaElement>('textarea')!, 'Inline reply')
    await submitForm(reply)

    await vi.waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({
      siteId: 'site-a',
      mark: 'article-a',
      pageTitle: '测试文章',
      username: 'Reply Guest',
      email: 'reply@example.com',
      url: 'https://reply.example/profile',
      content: 'Inline reply',
      parent: 1,
    })
    await vi.waitFor(() => {
      expect(saveVisitorIdentity).toHaveBeenCalledWith(
        'https://comments.example/base/',
        'site-a',
        { username: 'Reply Guest', email: 'reply@example.com', url: 'https://reply.example/profile' },
      )
    })
  })

  it('reuses a valid stored identity in the inline reply composer without displaying private fields', async () => {
    vi.mocked(loadVisitorIdentity).mockResolvedValue({
      username: 'Returning Guest',
      email: 'returning@example.com',
      url: 'https://returning.example/profile',
    })
    const { client, container } = createClient(
      vi.fn<typeof fetch>().mockResolvedValue(listResponse([comment(1, 0, 'existing root')])),
    )
    await client.init()
    await vi.waitFor(() => {
      expect(container.querySelector<HTMLInputElement>('.ecoku-composer input[type="text"]')?.value)
        .toBe('Returning Guest')
    })

    container.querySelector<HTMLButtonElement>('[data-comment-id="1"] .ecoku-text-action')!.click()
    const reply = container.querySelector<HTMLFormElement>('.ecoku-reply-composer')!
    expect(reply.querySelector<HTMLElement>('.ecoku-reply-identity-grid')?.hidden).toBe(true)
    expect(reply.querySelector('.ecoku-reply-identity-summary')).toBeNull()
    expect(reply.querySelector('.ecoku-identity-change')).toBeNull()
    expect(reply.textContent).not.toContain('以 Returning Guest 回复')
    expect(reply.textContent).not.toContain('更换')
    expect(document.activeElement).toBe(reply.querySelector('textarea'))
  })

  it('prevents duplicate submissions while the first request is unresolved', async () => {
    let resolvePost: ((response: Response) => void) | undefined
    let postCalls = 0
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) {
        postCalls += 1
        return new Promise<Response>((resolve) => { resolvePost = resolve })
      }
      return Promise.resolve(listResponse([]))
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    const form = fillIdentityAndContent(container)
    await submitForm(form)
    expect(container.querySelector<HTMLInputElement>('input[type="email"]')?.disabled).toBe(true)
    expect(container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')?.disabled).toBe(true)
    await submitForm(form)
    expect(postCalls).toBe(1)
    resolvePost?.(jsonResponse(201, { id: 9 }))
    await vi.waitFor(() => expect(container.querySelector('.ecoku-primary-button')?.textContent).toBe(zhCN.submitComment))
  })

  it('announces submission success before a slow refresh and keeps duplicate protection active', async () => {
    let listCalls = 0
    let resolveRefresh: ((response: Response) => void) | undefined
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) return Promise.resolve(jsonResponse(201, { id: 20 }))
      listCalls += 1
      if (listCalls === 1) return Promise.resolve(listResponse([]))
      return new Promise<Response>((resolve) => { resolveRefresh = resolve })
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    const form = fillIdentityAndContent(container, 'Slow refresh submission')
    await submitForm(form)
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'))
    expect(container.querySelector('.ecoku-status-line')?.textContent).toBe(zhCN.submitted)
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    const postCalls = fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/api/comment/submit'))
    expect(postCalls).toHaveLength(1)
    resolveRefresh?.(listResponse([]))
    await vi.waitFor(() => expect(container.querySelector('.ecoku-primary-button')?.textContent).toBe(zhCN.submitComment))
  })

  it.each([
    [400, zhCN.submit400],
    [403, zhCN.submit403],
    [413, zhCN.submit413],
    [429, zhCN.submit429],
    [500, zhCN.submit500],
  ])('maps HTTP %i to a safe localized submission error', async (status, expected) => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) {
        return Promise.resolve(jsonResponse(status, null, '<img src=x onerror=alert(1)>'))
      }
      return Promise.resolve(listResponse([]))
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    await submitForm(fillIdentityAndContent(container))
    await vi.waitFor(() => expect(container.querySelector('.ecoku-form-error')?.textContent).toBe(expected))
    expect(container.querySelector('.ecoku-form-error img')).toBeNull()
  })

  it('recognizes the server challenge error in every comment language', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) return Promise.resolve(jsonResponse(400, null, '请完成验证后再发布。'))
      return Promise.resolve(listResponse([], {
        formConfig: { i18n: 'en', emailRequired: true, websiteRequired: false, placeholder: zhCN.commentPlaceholder },
      }))
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    await submitForm(fillIdentityAndContent(container))
    await vi.waitFor(() => expect(container.querySelector('.ecoku-form-error')?.textContent).toBe('Complete the verification before posting.'))
  })

  it('shows a network-specific submission error without clearing the draft', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) return Promise.reject(new TypeError('offline'))
      return Promise.resolve(listResponse([]))
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    await submitForm(fillIdentityAndContent(container, 'Keep this draft'))
    await vi.waitFor(() => expect(container.querySelector('.ecoku-form-error')?.textContent).toBe(zhCN.submitNetwork))
    expect(container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')?.value).toBe('Keep this draft')
  })

  it('paginates by complete root threads without retaining the previous page', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const page = new URL(String(input)).searchParams.get('page')
      if (page === '2') return Promise.resolve(listResponse([comment(3, 0, 'second root')], { page: 2, pageCount: 2, total: 2, commentTotal: 3 }))
      return Promise.resolve(listResponse([comment(1, 0, 'first root'), comment(2, 1, 'first child')], { page: 1, pageCount: 2, total: 2, commentTotal: 3 }))
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    const pagination = container.querySelector<HTMLElement>('.ecoku-pagination')!
    const previous = pagination.querySelectorAll<HTMLButtonElement>('.ecoku-pager-button')[0]!
    const next = pagination.querySelectorAll<HTMLButtonElement>('.ecoku-pager-button')[1]!
    expect(pagination.getAttribute('aria-label')).toBe(zhCN.paginationLabel)
    expect(container.querySelector('.ecoku-pagination-status')?.textContent).toBe('1/2')
    expect(previous.disabled).toBe(true)
    expect(next.disabled).toBe(false)
    expect(container.querySelector('.ecoku-load-more')).toBeNull()

    next.click()
    await vi.waitFor(() => expect(container.textContent).toContain('second root'))
    expect(container.textContent).not.toContain('first child')
    expect(container.querySelectorAll('.ecoku-comment-row')).toHaveLength(1)
    expect(container.querySelector('.ecoku-pagination-status')?.textContent).toBe('2/2')
    expect(container.querySelector('.ecoku-pagination-status')?.getAttribute('aria-live')).toBe('polite')
    expect(container.querySelector('.ecoku-status-line')?.textContent).toBe('')
    expect(previous.disabled).toBe(false)
    expect(next.disabled).toBe(true)

    previous.click()
    await vi.waitFor(() => expect(container.textContent).toContain('first child'))
    expect(container.textContent).not.toContain('second root')
    expect(container.querySelectorAll('.ecoku-comment-row')).toHaveLength(2)
    expect(container.querySelector('.ecoku-pagination-status')?.textContent).toBe('1/2')
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.get('page')).toBe('2')
    expect(new URL(String(fetchMock.mock.calls[2]?.[0])).searchParams.get('page')).toBe('1')
  })

  it('does not let an obsolete page request overwrite a newer page key', async () => {
    let resolveOld: ((response: Response) => void) | undefined
    let resolveNew: ((response: Response) => void) | undefined
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const key = new URL(String(input)).searchParams.get('key')
      return new Promise<Response>((resolve) => {
        if (key === 'old-page') resolveOld = resolve
        else resolveNew = resolve
      })
    })
    const { client, container } = createClient(fetchMock, 'old-page')
    const initial = client.init()
    await vi.waitFor(() => expect(resolveOld).toBeTypeOf('function'))
    const pageChange = client.setPageKey('new-page')
    await vi.waitFor(() => expect(resolveNew).toBeTypeOf('function'))
    resolveNew?.(listResponse([comment(2, 0, 'new page comment', { mark: 'new-page' })]))
    await pageChange
    resolveOld?.(listResponse([comment(1, 0, 'obsolete comment', { mark: 'old-page' })]))
    await initial
    expect(container.textContent).toContain('new page comment')
    expect(container.textContent).not.toContain('obsolete comment')
  })

  it('keeps the Turnstile slot empty unless the public formConfig includes a sitekey', async () => {
    const { client, container } = createClient(vi.fn<typeof fetch>().mockResolvedValue(listResponse([])))
    await client.init()
    expect(container.querySelector('.ecoku-turnstile-slot')?.childElementCount).toBe(0)
    client.destroy()
  })

  it('mounts Turnstile in the composer and sends the one-time token with the comment', async () => {
    const render = vi.fn((_container: HTMLElement, options: Record<string, unknown>) => {
      queueMicrotask(() => (options.callback as ((token: string) => void) | undefined)?.('cf-token'))
      return 'widget-1'
    })
    vi.stubGlobal('turnstile', {
      render,
      reset: vi.fn(),
      remove: vi.fn(),
      getResponse: () => 'cf-token',
      execute: vi.fn(),
    })
    const posts: unknown[] = []
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) {
        posts.push(JSON.parse(String(init?.body)))
        return jsonResponse(201, { id: 11 })
      }
      return listResponse([], {
        formConfig: {
          emailRequired: true,
          websiteRequired: false,
          placeholder: zhCN.commentPlaceholder,
          defaultSort: 'newest',
          lengthLimit: 1000,
          emptyMessage: '还没有评论\n成为第一个留下评论的人。',
          turnstileSitekey: 'public-sitekey',
        },
      })
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    await vi.waitFor(() => expect(render).toHaveBeenCalled())
    await submitForm(fillIdentityAndContent(container, 'Verified comment'))
    await vi.waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ content: 'Verified comment', captchaToken: 'cf-token' })
    expect(posts[0]).not.toHaveProperty('turnstileToken')
    expect(JSON.stringify(posts[0])).not.toContain('secret')
  })

  it('stores visitor identity through the seven-day encrypted store without cookies, localStorage, or URL writes', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const initialURL = window.location.href
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/api/comment/submit')) return Promise.resolve(jsonResponse(201, { id: 9 }))
      return Promise.resolve(listResponse([]))
    })
    const { client, container } = createClient(fetchMock)
    await client.init()
    await submitForm(fillIdentityAndContent(container, 'Remember this identity'))
    await vi.waitFor(() => expect(saveVisitorIdentity).toHaveBeenCalledTimes(1))
    expect(VISITOR_IDENTITY_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(storageWrite).not.toHaveBeenCalled()
    expect(document.cookie).toBe('')
    expect(window.location.href).toBe(initialURL)
    client.destroy()
    expect(container.textContent).toBe('')
  })
})

it('updates the article title with the page key and clears an omitted title', async () => {
  const posts: Record<string, unknown>[] = []
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    if (String(input).includes('/api/comment/submit')) {
      posts.push(JSON.parse(String(init?.body)))
      return jsonResponse(201, { id: 41 }, 'submitted')
    }
    return listResponse([])
  })
  const { client, container } = createClient(fetchMock)
  await client.init()
  await client.setPageKey('article-b', '文章 B')
  expect(container.querySelector('.ecoku-status-line')?.textContent).toBe('')
  await submitForm(fillIdentityAndContent(container))
  await vi.waitFor(() => expect(posts).toHaveLength(1))
  expect(posts[0]).toMatchObject({ mark: 'article-b', pageTitle: '文章 B' })
  await vi.waitFor(() => expect(container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')!.disabled).toBe(false))
  await client.setPageKey('article-c')
  await submitForm(fillIdentityAndContent(container))
  await vi.waitFor(() => expect(posts).toHaveLength(2))
  expect(posts[1]).toMatchObject({ mark: 'article-c', pageTitle: '' })
})

it('removes a reply challenge that resolves after the reply closes', async () => {
  let resolveWidget!: (widget: captcha.ChallengeWidget) => void
  vi.spyOn(captcha, 'mountChallenge').mockResolvedValueOnce(null)
    .mockImplementationOnce(() => new Promise((resolve) => { resolveWidget = resolve }))
  const { client, container } = createClient(vi.fn(async () => listResponse([comment(1, 0, 'root')], {
    formConfig: { emailRequired: false, websiteRequired: false, placeholder: '评论', captcha: { provider: 'turnstile', sitekey: 'test' } },
  })))
  await client.init()
  container.querySelector<HTMLButtonElement>('.ecoku-reply-action')!.click()
  const cancel = Array.from(container.querySelectorAll<HTMLButtonElement>('.ecoku-reply-composer button')).find(button => button.textContent === zhCN.cancel)!
  cancel.click()
  const widget = { remove: vi.fn(), reset: vi.fn(), waitForToken: vi.fn() }
  resolveWidget(widget)
  await vi.waitFor(() => expect(widget.remove).toHaveBeenCalledOnce())
})

it('invalidates Smoji requests, picker and preview when the trust settings change', async () => {
  const manifestUrl = 'https://blog.example/smoji.json'
  const config = { enabled: true, manifestUrl, imageOrigin: 'https://old.example' }
  let resolveOld!: (value: smoji.SmojiManifest) => void
  let signal: AbortSignal | undefined
  const loader = vi.spyOn(smoji, 'loadSmojiManifest')
    .mockImplementationOnce((_url, incoming) => { signal = incoming; return new Promise(resolve => { resolveOld = resolve }) })
    .mockResolvedValue({ version: 1, packs: [{ id: 'new', label: '新', items: [{ id: 'face', label: '脸', src: 'https://new.example/face.webp' }] }] })
  const { client, container } = createClient(vi.fn(async () => listResponse([], {
    formConfig: { emailRequired: false, websiteRequired: false, placeholder: '评论', smoji: config },
  })))
  await client.init()
  const textarea = container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')!
  setValue(textarea, '![smoji:旧](https://old.example/face.webp)')
  const preview = container.querySelector<HTMLElement>('.ecoku-composer-preview')!
  container.querySelector<HTMLButtonElement>('.ecoku-preview-trigger')!.click()
  expect(preview.querySelector('img')).not.toBeNull()
  const trigger = container.querySelector<HTMLButtonElement>('.ecoku-smoji-trigger')!
  trigger.click()
  config.imageOrigin = 'https://new.example'
  await client.reload()
  expect(signal?.aborted).toBe(true)
  expect(preview.hidden).toBe(true)
  expect(preview.querySelector('img')).toBeNull()
  resolveOld({ version: 1, packs: [{ id: 'old', label: '旧', items: [{ id: 'face', label: '旧', src: 'https://old.example/face.webp' }] }] })
  await Promise.resolve()
  expect(container.querySelector('.ecoku-smoji-item')).toBeNull()
  trigger.click()
  await vi.waitFor(() => expect(container.querySelector('.ecoku-smoji-item img')?.getAttribute('src')).toBe('https://new.example/face.webp'))
  expect(loader).toHaveBeenLastCalledWith(manifestUrl, expect.any(AbortSignal), 'https://new.example')
  config.enabled = false
  await client.reload()
  expect(trigger.parentElement?.hidden).toBe(true)
  expect(container.querySelector('.ecoku-smoji-item')).toBeNull()
})

it('aborts Smoji on destroy and ignores a late manifest', async () => {
  let resolveManifest!: (manifest: smoji.SmojiManifest) => void
  let signal: AbortSignal | undefined
  vi.spyOn(smoji, 'loadSmojiManifest').mockImplementation((_url, incoming) => {
    signal = incoming
    return new Promise(resolve => { resolveManifest = resolve })
  })
  const { client, container } = createClient(vi.fn(async () => listResponse([], {
    formConfig: { emailRequired: false, websiteRequired: false, placeholder: '评论', smoji: { enabled: true, manifestUrl: 'https://static.example.test/smoji.json' } },
  })))
  await client.init()
  container.querySelector<HTMLButtonElement>('.ecoku-smoji-trigger')!.click()
  const panel = container.querySelector<HTMLElement>('.ecoku-smoji-panel')!
  client.destroy()
  expect(signal?.aborted).toBe(true)
  resolveManifest({ version: 1, packs: [{ id: 'demo', label: '包', items: [{ id: 'one', label: '笑', src: 'https://static.example.test/one.png' }] }] })
  await Promise.resolve()
  expect(panel.querySelector('.ecoku-smoji-item')).toBeNull()
})

it('counts non-BMP comment input by code point while retaining a safe native ceiling', async () => {
  const { client, container } = createClient(vi.fn(async () => listResponse([], {
    formConfig: { emailRequired: false, websiteRequired: false, placeholder: '评论', lengthLimit: 2 },
  })))
  await client.init()
  fillIdentityAndContent(container, '😀😀')
  const input = container.querySelector<HTMLTextAreaElement>('.ecoku-composer textarea')!
  const submit = container.querySelector<HTMLButtonElement>('.ecoku-composer .ecoku-primary-button')!
  expect(input.maxLength).toBe(4)
  expect(submit.disabled).toBe(false)
  setValue(input, '😀😀😀')
  expect(submit.disabled).toBe(true)
})
