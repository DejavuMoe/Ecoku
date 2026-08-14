import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import ChipInput from './components/ChipInput.vue'
import CommentManagementView from './components/CommentManagementView.vue'
import NotificationSettingsView from './components/NotificationSettingsView.vue'
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
        comment_limit: 2048, empty_message: '暂无评论', revision: 2,
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
    expect(sites[0]).toMatchObject({ name: "Dejavu's Blog", commentLimit: 2048, emptyMessage: '暂无评论' })
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
    await adminApi.createSite('token', { ...write, name: '博客', defaultSort: 'oldest', emailRequired: false, websiteRequired: true, placeholder: '评论', commentLimit: 500, emptyMessage: '暂无' })
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(payload).toMatchObject({ name: '博客', default_sort: 'oldest', comment_limit: 500, empty_message: '暂无' })
    expect(payload).not.toHaveProperty('domain')
    expect(payload).not.toHaveProperty('default_status')
    expect(payload).not.toHaveProperty('review_mode')
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

  it('shows only approved site fields and explains newline-separated origins', () => {
    const store = useAdminStore(); store.token = 'token'; store.sites = [site()]; store.selectedSiteId = 'site-a'
    const wrapper = mount(SiteManagementView, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('站点名称')
    expect(wrapper.text()).toContain('评论排序')
    expect(wrapper.text()).toContain('评论长度上限')
    expect(wrapper.text()).toContain('中文、日文、韩文与其他 Unicode 字符均按一个字符计数')
    expect(wrapper.text()).toContain('每行一个完整来源')
    expect(wrapper.text()).not.toContain('站点域名')
    expect(wrapper.text()).not.toContain('审核方式')
  })

  it('renders redacted secret placeholders, destination separators, and all approved template previews', () => {
    const store = useAdminStore(); store.token = 'token'; store.notificationSettings = notifications()
    const wrapper = mount(NotificationSettingsView, { global: { plugins: [pinia] } })
    expect(wrapper.find<HTMLInputElement>('#email-password').element.placeholder).toBe('已设置，输入新值以更换')
    expect(wrapper.find<HTMLInputElement>('#telegram-token').element.placeholder).toBe('已设置，输入新值以更换')
    expect(wrapper.text()).toContain('按 Enter、逗号或换行添加多个邮箱')
    expect(wrapper.text()).toContain('按 Enter、逗号或换行添加；支持用户、群组、频道 ID')
    expect(wrapper.findAll('.template-link')).toHaveLength(4)
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
    for (const forbidden of ['用户注册', 'Count', 'management key', '站点管理密钥', '待审核', '批准所选', '拒绝所选']) expect(text).not.toContain(forbidden)
    expect(text).toContain('评论管理')
    expect(text).toContain('站点管理')
    expect(text).toContain('通知设置')
  })
})
