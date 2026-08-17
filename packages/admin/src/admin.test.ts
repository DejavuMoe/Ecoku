import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import ChipInput from './components/ChipInput.vue'
import CommentManagementView from './components/CommentManagementView.vue'
import NotificationSettingsView from './components/NotificationSettingsView.vue'
import SecurityView from './components/SecurityView.vue'
import SiteManagementView from './components/SiteManagementView.vue'
import { adminApi, ApiError } from './api'
import { messages } from './messages'
import { useAdminStore } from './stores/admin'
import { formatDate } from './ui'
import type { CommentPage, CommentReview, NotificationSettings, SiteSummary } from './types'

let pinia = createPinia()

function site(overrides: Partial<SiteSummary> = {}): SiteSummary {
  return {
    id: 'site-a', siteUrl: 'https://blog.example.test', name: "Dejavu's Blog",
    allowedOrigins: ['https://blog.example.test'], defaultSort: 'newest',
    emailRequired: true, websiteRequired: false,
    placeholder: '写下评论（仅支持纯文本）', commentLimit: 1000,
    emptyMessage: '还没有评论\n成为第一个留下评论的人。', revision: 1,
    bloggerNickname: 'Dejavu Moe', bloggerEmail: 'admin@example.test',
    bloggerBadge: '[博主]', bloggerPassphraseSet: true,
    createdAt: '2026-08-13T01:00:00Z', updatedAt: '2026-08-13T01:00:00Z',
    ...overrides,
  }
}

function comment(overrides: Partial<CommentReview> = {}): CommentReview {
  return {
    id: 7, siteId: 'site-a', mark: '/article/test', pageTitle: '文章标题',
    parent: 0, status: 'published', deleted: false, hasChildren: false,
    username: '访客', email: 'private@example.com', url: 'https://author.example/profile',
    content: '<script>alert("xss")</script> 正文',
    createdAt: '2026-08-13T01:02:03Z', updatedAt: '2026-08-13T01:02:03Z',
    ...overrides,
  }
}

function page(data: CommentReview[]): CommentPage {
  return { data, counts: { published: data.filter((item) => !item.deleted).length, deleted: data.filter((item) => item.deleted).length }, total: data.length, page: 1, pageSize: 20, pageCount: data.length ? 1 : 0 }
}

function notifications(): NotificationSettings {
  return {
    email: { enabled: true, host: 'smtp.example.test', port: 465, encryption: 'tls', username: 'mailer', password: '', passwordSet: true, fromAddress: 'notice@example.test', recipients: ['owner@example.test'], revision: 2 },
    telegram: { enabled: true, token: '', tokenSet: true, targets: ['123456789', '-1001234567890'], revision: 2 },
  }
}

function response(status: number, data: unknown): Response {
  return new Response(JSON.stringify({ code: status, message: 'ok', data }), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => { pinia = createPinia(); setActivePinia(pinia) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '' })

describe('administrator API contract', () => {
  it('maps only the direct-publish site and comment fields and keeps the bearer token in the header', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { data: [{
        id: 'site-a', site_url: 'https://blog.example.test', name: "Dejavu's Blog",
        allowed_origins: ['https://blog.example.test'], default_sort: 'newest',
        email_required: true, website_required: false, placeholder: '写下评论',
        comment_limit: 2048, empty_message: '暂无评论', blogger_nickname: 'Dejavu Moe',
        blogger_email: 'admin@example.test', blogger_badge: '[OP]', blogger_passphrase_set: true, revision: 2,
        created_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:00Z',
        domain: 'MUST_NOT_MAP', default_status: 'MUST_NOT_MAP', management_key_env: 'MUST_NOT_MAP',
      }] }))
      .mockResolvedValueOnce(response(200, { data: [{
        id: 9, site_id: 'site-a', mark: '/post', page_title: '标题', parent: 0,
        status: 'published', deleted: false, has_children: false, username: '访客',
        email: 'private@example.com', content: '正文', created_at: '2026-08-13T00:00:00Z', updated_at: '2026-08-13T00:00:00Z',
      }], counts: { published: 1, deleted: 0 }, total: 1, page: 1, pageSize: 20, pageCount: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const sites = await adminApi.listSites('private-token')
    const comments = await adminApi.listComments('private-token', 'site-a', 'published', 1, 20, 'newest')
    expect(sites[0]).toMatchObject({ name: "Dejavu's Blog", commentLimit: 2048, emptyMessage: '暂无评论', bloggerNickname: 'Dejavu Moe', bloggerEmail: 'admin@example.test', bloggerBadge: '[OP]', bloggerPassphraseSet: true })
    expect(sites[0]).not.toHaveProperty('bloggerPassphrase')
    expect(sites[0]).not.toHaveProperty('blogger_passphrase')
    expect(sites[0]).not.toHaveProperty('domain')
    expect(sites[0]).not.toHaveProperty('defaultStatus')
    expect(comments.data[0]).toMatchObject({ pageTitle: '标题', status: 'published', email: 'private@example.com' })
    const [, init] = fetchMock.mock.calls[0]!
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer private-token')
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('private-token')
  })

  it('sends the approved site write fields without derived domain or review mode', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(201, { site: {
      id: 'site-a', site_url: 'https://blog.example.test', name: '博客', allowed_origins: ['https://blog.example.test'], default_sort: 'oldest', email_required: false, website_required: true, placeholder: '评论', comment_limit: 500, empty_message: '暂无', revision: 1,
    } }))
    vi.stubGlobal('fetch', fetchMock)
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...write } = site()
    await adminApi.createSite('token', { ...write, name: '博客', defaultSort: 'oldest', emailRequired: false, websiteRequired: true, placeholder: '评论', commentLimit: 500, emptyMessage: '暂无', bloggerPassphrase: 'correct-horse-battery' })
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(payload).toMatchObject({ name: '博客', default_sort: 'oldest', comment_limit: 500, empty_message: '暂无', blogger_nickname: 'Dejavu Moe', blogger_email: 'admin@example.test', blogger_badge: '[博主]', blogger_passphrase: 'correct-horse-battery' })
    expect(payload).not.toHaveProperty('blogger_passphrase_set')
    expect(payload).not.toHaveProperty('domain')
    expect(payload).not.toHaveProperty('default_status')
    expect(payload).not.toHaveProperty('review_mode')
  })

  it('maps provider-neutral CAPTCHA settings and sends only the generic login token', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, {
        provider: 'cap',
        turnstile: { sitekey: 'turnstile-public', secret_set: true },
        cap: { instance_url: 'https://cap.example.test', sitekey: 'cap-public', secret_set: true },
        revision: 4,
      }))
      .mockResolvedValueOnce(response(200, {
        token: 'admin-token', token_type: 'Bearer', expires_at: '2026-08-18T00:00:00Z', expires_in: 3600,
      }))
    vi.stubGlobal('fetch', fetchMock)
    const settings = await adminApi.getCaptcha('admin-token')
    expect(settings).toEqual({
      provider: 'cap',
      turnstile: { sitekey: 'turnstile-public', secret: '', secretSet: true },
      cap: { instanceUrl: 'https://cap.example.test', sitekey: 'cap-public', secret: '', secretSet: true },
      revision: 4,
    })
    await adminApi.login('admin', 'password', 'cap-token')
    const loginPayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<string, unknown>
    expect(loginPayload).toMatchObject({ username: 'admin', password: 'password', captchaToken: 'cap-token' })
    expect(loginPayload).not.toHaveProperty('turnstileToken')
  })
})

describe('administrator state', () => {
  it('suppresses duplicate destructive actions and reloads after the first succeeds', async () => {
    const store = useAdminStore()
    store.token = 'token'; store.sites = [site()]; store.selectedSiteId = 'site-a'; store.selectedComment = comment(); store.comments = [comment()]
    let release: (() => void) | undefined
    const tombstone = vi.spyOn(adminApi, 'tombstone').mockImplementation(() => new Promise((resolve) => { release = () => resolve({ comment: comment({ status: 'deleted', deleted: true }), unchanged: false }) }))
    vi.spyOn(adminApi, 'listComments').mockResolvedValue(page([]))
    const first = store.mutateCurrent('tombstone')
    const second = await store.mutateCurrent('tombstone')
    expect(second).toBe(false)
    expect(tombstone).toHaveBeenCalledTimes(1)
    release?.(); expect(await first).toBe(true)
    expect(store.toastMessage).toBe(messages.tombstoned)
  })

  it('maps SMTP failure categories to actionable inline feedback', async () => {
    const store = useAdminStore(); store.token = 'token'
    vi.spyOn(adminApi, 'testEmail').mockRejectedValue(new ApiError(502, 'private upstream detail', 'authentication_failed'))
    await store.testEmail(notifications().email)
    expect(store.emailTestMessage).toBe('发送失败：SMTP 认证未通过')
    expect(store.emailTestMessage).not.toContain('private upstream detail')
  })
})

describe('approved production surface', () => {
  it('formats administrator timestamps as UTC+8 with a four-digit year and 24-hour time', () => {
    expect(formatDate('2026-08-13T01:02:03Z')).toBe('2026/08/13 09:02')
    expect(formatDate('not-a-date')).toBe('时间未知')
  })

  it('renders published/deleted management only, escapes comments, and links to the original page', () => {
    const store = useAdminStore()
    store.token = 'token'; store.sites = [site()]; store.selectedSiteId = 'site-a'; store.comments = [comment()]; store.selectedComment = comment(); store.counts = { published: 1, deleted: 0 }; store.total = 1; store.pageCount = 1
    const wrapper = mount(CommentManagementView, { props: { mobileDetail: false }, global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('评论管理')
    expect(wrapper.text()).toContain('已发布 1')
    expect(wrapper.text()).toContain('已删除 0')
    expect(wrapper.text()).not.toContain('待审核')
    expect(wrapper.text()).not.toContain('批准')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('.comment-body').text()).toContain('<script>alert("xss")</script>')
    expect(wrapper.find<HTMLAnchorElement>('a[href="https://blog.example.test/article/test#ecoku-comment-7"]').exists()).toBe(true)
    expect(wrapper.find('.danger-button').text()).toBe('墓碑删除')
    expect(wrapper.find('.queue-meta').exists()).toBe(true)
    expect(wrapper.find('.queue-row').exists()).toBe(true)
    expect(wrapper.find('.pager').exists()).toBe(true)
    expect(wrapper.find('.detail-main').exists()).toBe(true)
    expect(wrapper.find('.detail-side').exists()).toBe(true)
    expect(wrapper.find('.queue-time').text()).toBe('2026/08/13 09:02')
  })

  it('renders the approved off/Turnstile/Cap selector without operational copy or plaintext secrets', () => {
    const store = useAdminStore(); store.token = 'token'
    store.captchaSettings = {
      provider: 'cap',
      turnstile: { sitekey: '0x4AAAAAAA00000000000000', secret: '', secretSet: true },
      cap: { instanceUrl: 'https://cap.example.test', sitekey: 'cap-public', secret: '', secretSet: true },
      revision: 2,
    }
    const wrapper = mount(SecurityView, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('安全')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('关闭')
    expect(wrapper.text()).toContain('Cloudflare Turnstile')
    expect(wrapper.text()).toContain('Cap')
    expect(wrapper.text()).toContain('实例地址')
    expect(wrapper.text()).toContain('Site key')
    expect(wrapper.text()).toContain('Secret key')
    expect(wrapper.text()).toContain('访客评论和管理员登录')
    expect((wrapper.get('input[value="cap"]').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('#cap-instance-url').element as HTMLInputElement).value).toBe('https://cap.example.test')
    expect((wrapper.get('#cap-sitekey').element as HTMLInputElement).value).toBe('cap-public')
    expect(wrapper.get('#cap-secret').attributes('placeholder')).toBe('已设置，输入新值以更换')
    expect((wrapper.get('#cap-secret').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).not.toContain('公开标识')
    expect(wrapper.text()).not.toContain('Cloudflare 控制台')
    expect(wrapper.text()).not.toContain('Siteverify')
    expect(wrapper.text()).not.toContain('Pre-clearance')
    expect(wrapper.text()).not.toContain('captcha disable')
    expect(wrapper.text()).not.toContain('服务器恢复说明')
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('submits newly entered Cap credentials without clearing the write-only secret', async () => {
    const store = useAdminStore(); store.token = 'token'
    store.captchaSettings = {
      provider: 'cap',
      turnstile: { sitekey: '', secret: '', secretSet: false },
      cap: { instanceUrl: '', sitekey: '', secret: '', secretSet: false },
      revision: 1,
    }
    const save = vi.spyOn(store, 'saveCaptcha').mockResolvedValue({
      provider: 'cap',
      turnstile: { sitekey: '', secret: '', secretSet: false },
      cap: { instanceUrl: 'https://cap.example.test', sitekey: 'cap-public', secret: '', secretSet: true },
      revision: 2,
    })
    const wrapper = mount(SecurityView, { global: { plugins: [pinia] } })
    await wrapper.get('#cap-instance-url').setValue('https://cap.example.test/')
    await wrapper.get('#cap-sitekey').setValue('cap-public')
    await wrapper.get('#cap-secret').setValue('cap-private')
    await wrapper.get('.save-button').trigger('click')
    await vi.waitFor(() => {
      expect(save).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'cap',
        cap: expect.objectContaining({ instanceUrl: 'https://cap.example.test', sitekey: 'cap-public', secret: 'cap-private' }),
      }))
    })
  })

  it('shows only approved site fields and explains newline-separated origins', () => {
    const store = useAdminStore(); store.token = 'token'; store.sites = [site()]; store.selectedSiteId = 'site-a'
    const wrapper = mount(SiteManagementView, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('站点名称')
    expect(wrapper.text()).toContain('评论排序')
    expect(wrapper.text()).toContain('评论长度上限')
    expect(wrapper.text()).toContain('中文、日文、韩文与其他 Unicode 字符均按一个字符计数')
    expect(wrapper.text()).toContain('每行一个完整来源')
    expect(wrapper.text()).toContain('博主身份')
    expect(wrapper.text()).toContain('仅用于通知去重与历史评论回填，不会公开')
    expect(wrapper.text()).toContain('博主口令')
    expect(wrapper.get('#blogger-passphrase').attributes('type')).toBe('password')
    expect((wrapper.get('#blogger-passphrase').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('评论区标志')
    expect(wrapper.text()).toContain('留空则不显示')
    expect(wrapper.text()).not.toContain('通知判定预览')
    expect(wrapper.text()).not.toContain('站点域名')
    expect(wrapper.text()).not.toContain('审核方式')
  })

  it('renders redacted secret placeholders and destination separators without public template previews', () => {
    const store = useAdminStore(); store.token = 'token'; store.notificationSettings = notifications()
    const wrapper = mount(NotificationSettingsView, { global: { plugins: [pinia] } })
    expect(wrapper.find<HTMLInputElement>('#email-password').element.placeholder).toBe('已设置，输入新值以更换')
    expect(wrapper.find<HTMLInputElement>('#telegram-token').element.placeholder).toBe('已设置，输入新值以更换')
    expect(wrapper.text()).toContain('按 Enter、逗号或换行添加多个邮箱')
    expect(wrapper.text()).toContain('按 Enter、逗号或换行添加；支持用户、群组、频道 ID')
    expect(wrapper.find('.template-panel').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('/admin/templates/')
    expect(wrapper.html()).not.toContain('不加密')
    expect(wrapper.find('#email-encryption').html()).not.toContain('value="none"')
  })

  it('accepts pasted comma/newline chips, flags invalid values, and removes one chip', async () => {
    const wrapper = mount(ChipInput, { props: { modelValue: [], kind: 'email', label: '通知收件人' } })
    const input = wrapper.find('input')
    const paste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'a@example.com,b@example.com\nbad' } })
    await input.element.dispatchEvent(paste)
    const values = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as string[]
    expect(values).toEqual(['a@example.com', 'b@example.com', 'bad'])
    await wrapper.setProps({ modelValue: values })
    expect(wrapper.attributes('aria-invalid')).not.toBe('true')
    expect(wrapper.find('.field-error').text()).toBe('邮箱格式错误')
    await wrapper.findAll('.chip-remove')[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(['a@example.com', 'bad'])
  })

  it('contains no ordinary-user, Count, management-key, or review workflow surface', () => {
    const store = useAdminStore(); store.token = 'token'; store.sites = [site()]; store.selectedSiteId = 'site-a'; store.comments = []; store.counts = { published: 0, deleted: 0 }
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    const text = wrapper.text()
    for (const forbidden of ['用户注册', 'Count', 'management key', '站点管理密钥', '待审核', '批准所选', '拒绝所选', '配色预览']) expect(text).not.toContain(forbidden)
    expect(text).toContain('评论管理')
    expect(text).toContain('站点管理')
    expect(text).toContain('通知设置')
    expect(text).toContain('安全')
  })

  it('uses auto color scheme with comment-aligned dark tokens and no persisted theme switcher', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const html = fs.readFileSync(path.join(here, '../index.html'), 'utf8')
    const css = fs.readFileSync(path.join(here, 'style.css'), 'utf8')
    expect(html).toContain('data-theme="auto"')
    expect(html).toContain('content="light dark"')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toMatch(/html\[data-theme="auto"\][\s\S]*--paper: rgb\(26, 29, 32\)/)
    expect(css).toContain('--surface: rgb(34, 38, 42)')
    expect(css).toContain('--ink: rgb(242, 236, 226)')
    expect(css).toContain('--serif: "Noto Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", serif')
    expect(css).toContain('.provider-group')
    expect(css).toContain('.admin-cap-widget')
    expect(css).toContain('--cap-widget-width: 260px')
    expect(css).toContain('--cap-widget-height: 58px')
    expect(css).not.toContain('OPPO Serif SC')
    expect(html).not.toMatch(/localStorage|sessionStorage/)
    expect(css).not.toMatch(/localStorage|sessionStorage/)
  })
})
