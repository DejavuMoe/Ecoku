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
import SmojiContent from './components/SmojiContent.vue'
import { adminApi, ApiError } from './api'
import { messages } from './messages'
import { useAdminStore } from './stores/admin'
import { formatDate } from './ui'
import type { CommentPage, CommentReview, NotificationSettings, SiteSummary } from './types'
import { tokenizeAdminSmoji } from './smoji'

let pinia = createPinia()

function site(overrides: Partial<SiteSummary> = {}): SiteSummary {
  return {
    id: 'site-a', siteUrl: 'https://blog.example.test', name: "Dejavu's Blog",
    allowedOrigins: ['https://blog.example.test'], defaultSort: 'newest',
    emailRequired: true, websiteRequired: false,
    placeholder: '写下评论（仅支持纯文本）', commentLimit: 1000,
    emptyMessage: '还没有评论\n成为第一个留下评论的人。', revision: 1,
    smojiEnabled: false, smojiManifestUrl: '',
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
  it('maps only the direct-publish site and comment fields and uses the HttpOnly session without a bearer header', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { data: [{
        id: 'site-a', site_url: 'https://blog.example.test', name: "Dejavu's Blog",
        allowed_origins: ['https://blog.example.test'], default_sort: 'newest',
        email_required: true, website_required: false, placeholder: '写下评论',
        comment_limit: 2048, empty_message: '暂无评论', smoji_enabled: true, smoji_manifest_url: 'https://static.example.test/smoji.json', blogger_nickname: 'Dejavu Moe',
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
    const sites = await adminApi.listSites()
    const comments = await adminApi.listComments('site-a', 'published', 1, 20, 'newest')
    expect(sites[0]).toMatchObject({ name: "Dejavu's Blog", commentLimit: 2048, emptyMessage: '暂无评论', smojiEnabled: true, smojiManifestUrl: 'https://static.example.test/smoji.json', bloggerNickname: 'Dejavu Moe', bloggerEmail: 'admin@example.test', bloggerBadge: '[OP]', bloggerPassphraseSet: true })
    expect(sites[0]).not.toHaveProperty('bloggerPassphrase')
    expect(sites[0]).not.toHaveProperty('blogger_passphrase')
    expect(sites[0]).not.toHaveProperty('domain')
    expect(sites[0]).not.toHaveProperty('defaultStatus')
    expect(comments.data[0]).toMatchObject({ pageTitle: '标题', status: 'published', email: 'private@example.com' })
    const [, init] = fetchMock.mock.calls[0]!
    const headers = new Headers(init?.headers)
    expect(headers.has('Authorization')).toBe(false)
    expect(init?.credentials).toBe('same-origin')
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('private-token')
  })

  it('sends the approved site write fields without derived domain or review mode', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(201, { site: {
      id: 'site-a', site_url: 'https://blog.example.test', name: '博客', allowed_origins: ['https://blog.example.test'], default_sort: 'oldest', email_required: false, website_required: true, placeholder: '评论', comment_limit: 500, empty_message: '暂无', revision: 1,
    } }))
    vi.stubGlobal('fetch', fetchMock)
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...write } = site()
    await adminApi.createSite({ ...write, name: '博客', defaultSort: 'oldest', emailRequired: false, websiteRequired: true, placeholder: '评论', commentLimit: 500, emptyMessage: '暂无', bloggerPassphrase: 'correct-horse-battery' })
    const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(payload).toMatchObject({ name: '博客', default_sort: 'oldest', comment_limit: 500, empty_message: '暂无', smoji_enabled: false, smoji_manifest_url: '', blogger_nickname: 'Dejavu Moe', blogger_email: 'admin@example.test', blogger_badge: '[博主]', blogger_passphrase: 'correct-horse-battery' })
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
        expires_at: '2026-08-18T00:00:00Z', expires_in: 3600,
      }))
    vi.stubGlobal('fetch', fetchMock)
    const settings = await adminApi.getCaptcha()
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

describe('administrator Smoji rendering', () => {
  it('renders only configured-origin markers as images without HTML injection', () => {
    const manifestUrl = 'https://static.example.test/smoji.json'
    const marker = '正文 ![smoji:挥手](https://static.example.test/wave.webp)'
    expect(tokenizeAdminSmoji(marker, true, manifestUrl)).toHaveLength(2)
    expect(tokenizeAdminSmoji('![smoji:坏](https://tracker.example/bad.webp)', true, manifestUrl)[0]).toMatchObject({ type: 'text' })
    for (const src of ['https://user:pass@static.example.test/a.webp', 'https://static.example.test/a.webp?q=1', 'https://static.example.test/a.webp#frag']) {
      const unsafe = `![smoji:表情](${src})`
      expect(tokenizeAdminSmoji(unsafe, true, manifestUrl)).toEqual([{ type: 'text', value: unsafe }])
    }
    const wrapper = mount(SmojiContent, { props: { content: marker, enabled: true, manifestUrl } })
    expect(wrapper.get('img').attributes('alt')).toBe('[表情：挥手]')
    expect(wrapper.get('img').attributes('src')).toBe('https://static.example.test/wave.webp')
    expect(wrapper.html()).not.toContain('v-html')
  })
})

describe('administrator state', () => {
  it('keeps a pending navigation behind the discard confirmation and preserves dirty state when cancelled', () => {
    const store = useAdminStore()
    const next = vi.fn()
    store.setDirty('sites', true)
    store.requestNavigation(next)
    expect(store.discardRequested).toBe(true)
    expect(next).not.toHaveBeenCalled()
    store.resolveNavigation(false)
    expect(store.dirtyView).toBe('sites')
    expect(next).not.toHaveBeenCalled()
    store.requestNavigation(next)
    store.resolveNavigation(true)
    expect(next).toHaveBeenCalledTimes(1)
    store.resolveNavigation(true)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('deletes the confirmed ID even if the selected comment changes', async () => {
    const store = useAdminStore()
    store.authenticated = true; store.selectedSiteId = 'site-a'
    store.comments = [comment(), comment({ id: 8 })]; store.selectedComment = comment({ id: 8 })
    const tombstone = vi.spyOn(adminApi, 'tombstone').mockResolvedValue({ comment: comment({ deleted: true, status: 'deleted' }), unchanged: false })
    vi.spyOn(adminApi, 'listComments').mockResolvedValue(page([]))
    await store.mutateCurrent('tombstone', 7)
    expect(tombstone).toHaveBeenCalledWith('site-a', 7)
    store.comments = [comment({ deleted: true, status: 'deleted', hasChildren: false })]
    store.selectedComment = comment({ deleted: true, status: 'deleted', hasChildren: true })
    const permanent = vi.spyOn(adminApi, 'permanentlyDelete')
    expect(await store.mutateCurrent('permanent', 7)).toBe(false)
    expect(permanent).not.toHaveBeenCalled()
    expect(store.actionMessage).toBe('仍有回复，不能彻底删除')
  })
  it('suppresses duplicate destructive actions and reloads after the first succeeds', async () => {
    const store = useAdminStore()
    store.authenticated = true; store.sessionReady = true; store.sites = [site()]; store.selectedSiteId = 'site-a'; store.selectedComment = comment(); store.comments = [comment()]
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
    const store = useAdminStore(); store.authenticated = true; store.sessionReady = true
    vi.spyOn(adminApi, 'testEmail').mockRejectedValue(new ApiError(502, 'private upstream detail', 'authentication_failed'))
    await store.testEmail(notifications().email)
    expect(store.emailTestMessage).toBe('发送失败：SMTP 认证未通过')
    expect(store.emailTestMessage).not.toContain('private upstream detail')
  })
})

describe('approved production surface', () => {
  it('shows every comment and its parent context without opening a detail pane, and cancels inline deletion', async () => {
    const store = useAdminStore()
    store.authenticated = true; store.sites = [site()]; store.selectedSiteId = 'site-a'
    store.comments = [comment({ id: 8, parent: 7, content: '子评论' }), comment()]
    vi.spyOn(adminApi, 'getComment').mockResolvedValue(comment({ id: 8, parent: 7, content: '子评论' }))
    const remove = vi.spyOn(adminApi, 'tombstone')
    const wrapper = mount(CommentManagementView, { global: { plugins: [pinia] } })
    expect(wrapper.findAll('.entry')).toHaveLength(2)
    expect(wrapper.get('#c-8 .entry-copy').text()).toBe('子评论')
    expect(wrapper.get('#c-7 .entry-copy').text()).toContain('<script>')
    expect(wrapper.get('#c-8 .entry-quote').attributes('href')).toBe('#c-7')
    await wrapper.get('#c-8 .is-danger').trigger('click')
    expect(wrapper.get('#c-8 [role="alertdialog"]').text()).toContain('下面的回复保留不变')
    await wrapper.get('#c-8 .entry-confirm .button-quiet').trigger('click')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    expect(remove).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('shows the save bar only after editing and restores the persisted site on discard', async () => {
    const store = useAdminStore(); store.sites = [site()]; store.selectedSiteId = 'site-a'
    const wrapper = mount(SiteManagementView, { global: { plugins: [pinia] } })
    expect(wrapper.find('.savebar').exists()).toBe(false)
    await wrapper.get('#site-name').setValue('新名称')
    expect(wrapper.find('.savebar').exists()).toBe(true)
    expect(store.dirtyView).toBe('sites')
    await wrapper.get('.savebar .button-quiet').trigger('click')
    expect((wrapper.get('#site-name').element as HTMLInputElement).value).toBe("Dejavu's Blog")
    expect(wrapper.find('.savebar').exists()).toBe(false)
    expect(store.dirtyView).toBeNull()
    wrapper.unmount()
  })

  it('preserves the edited site and write-only passphrase when saving fails', async () => {
    const store = useAdminStore(); store.authenticated = true; store.sites = [site()]; store.selectedSiteId = 'site-a'
    vi.spyOn(adminApi, 'updateSite').mockRejectedValue(new ApiError(409, 'conflict'))
    const wrapper = mount(SiteManagementView, { global: { plugins: [pinia] } })
    await wrapper.get('#site-name').setValue('尚未保存的名称')
    await wrapper.get('#blogger-passphrase').setValue('new-private-passphrase')
    await wrapper.get('.save-button').trigger('click')
    await vi.waitFor(() => expect(store.siteBusy).toBe(false))
    await wrapper.vm.$nextTick()
    expect(store.siteMessage).toBe(messages.conflict)
    expect((wrapper.get('#site-name').element as HTMLInputElement).value).toBe('尚未保存的名称')
    expect((wrapper.get('#blogger-passphrase').element as HTMLInputElement).value).toBe('new-private-passphrase')
    expect(wrapper.find('.savebar').exists()).toBe(true)
    expect(store.dirtyView).toBe('sites')
    wrapper.unmount()
  })

  it('locks unloaded instance settings and provides retry after loading fails', async () => {
    const store = useAdminStore()
    store.notificationMessage = messages.serverError; store.captchaMessage = messages.serverError
    const notificationsRetry = vi.spyOn(store, 'loadNotifications').mockResolvedValue()
    const captchaRetry = vi.spyOn(store, 'loadCaptcha').mockResolvedValue()
    const notificationView = mount(NotificationSettingsView, { global: { plugins: [pinia] } })
    const securityView = mount(SecurityView, { global: { plugins: [pinia] } })
    expect(notificationView.get('#email-form > fieldset').attributes('disabled')).toBeDefined()
    expect(notificationView.get('#telegram-form > fieldset').attributes('disabled')).toBeDefined()
    expect(securityView.get('#captcha-form > fieldset').attributes('disabled')).toBeDefined()
    expect(notificationView.find('.savebar').exists()).toBe(false)
    expect(securityView.find('.savebar').exists()).toBe(false)
    await notificationView.get('.notice button').trigger('click')
    await securityView.get('.notice button').trigger('click')
    expect(notificationsRetry).toHaveBeenCalledTimes(1)
    expect(captchaRetry).toHaveBeenCalledTimes(1)
    notificationView.unmount(); securityView.unmount()
  })

  it('saves a valid notification channel while retaining the other channel draft and secret', async () => {
    const store = useAdminStore(); store.authenticated = true; store.notificationSettings = notifications()
    const saveEmail = vi.spyOn(store, 'saveEmail').mockResolvedValue({ ...notifications().email, username: 'changed', revision: 3 })
    const saveTelegram = vi.spyOn(store, 'saveTelegram')
    const wrapper = mount(NotificationSettingsView, { global: { plugins: [pinia] } })
    expect(wrapper.find('.savebar').exists()).toBe(false)
    await wrapper.get('#email-user').setValue('changed')
    await wrapper.get('#telegram-token').setValue('new-private-token')
    await wrapper.get('#telegram-targets-input').setValue('@invalid')
    await wrapper.get('#telegram-targets-input').trigger('blur')
    await wrapper.get('.save-button').trigger('click')
    await vi.waitFor(() => expect(saveEmail).toHaveBeenCalledTimes(1))
    expect(saveTelegram).not.toHaveBeenCalled()
    expect((wrapper.get('#telegram-token').element as HTMLInputElement).value).toBe('new-private-token')
    expect(wrapper.text()).toContain('接收目标 ID 格式错误')
    expect(store.dirtyView).toBe('notifications')
    wrapper.unmount()
  })

  it('protects an unfinished recipient chip and clears it when changes are discarded', async () => {
    const store = useAdminStore(); store.notificationSettings = notifications()
    const wrapper = mount(NotificationSettingsView, { global: { plugins: [pinia] } })
    await wrapper.get('#email-recipients-input').setValue('draft@example.test')
    expect(store.dirtyView).toBe('notifications')
    expect(wrapper.find('.savebar').exists()).toBe(true)
    await wrapper.get('.savebar .button-quiet').trigger('click')
    expect((wrapper.get('#email-recipients-input').element as HTMLInputElement).value).toBe('')
    expect(store.dirtyView).toBeNull()
    wrapper.unmount()
  })

  it('marks an empty recipient list invalid without sending the settings', async () => {
    const store = useAdminStore(); store.authenticated = true; store.notificationSettings = notifications()
    const save = vi.spyOn(store, 'saveEmail')
    const wrapper = mount(NotificationSettingsView, { global: { plugins: [pinia] } })
    await wrapper.get('#email-form .chip-remove').trigger('click')
    await wrapper.get('.save-button').trigger('click')
    expect(save).not.toHaveBeenCalled()
    expect(wrapper.get('#email-recipients-input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('邮箱格式错误')
    wrapper.unmount()
  })
  it('formats administrator timestamps as UTC+8 with a four-digit year and 24-hour time', () => {
    expect(formatDate('2026-08-13T01:02:03Z')).toBe('2026/08/13 09:02')
    expect(formatDate('not-a-date')).toBe('时间未知')
  })

  it('renders published/deleted management only, escapes comments, and links to the original page', () => {
    const store = useAdminStore()
    store.authenticated = true; store.sessionReady = true; store.sites = [site()]; store.selectedSiteId = 'site-a'; store.comments = [comment(), comment({ id: 8, createdAt: 'not-a-date' })]; store.selectedComment = comment(); store.counts = { published: 2, deleted: 0 }; store.total = 2; store.pageCount = 1
    const wrapper = mount(CommentManagementView, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('评论管理')
    expect(wrapper.text()).toContain('已发布 2')
    expect(wrapper.text()).toContain('已删除 0')
    expect(wrapper.text()).not.toContain('待审核')
    expect(wrapper.text()).not.toContain('批准')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('.entry-copy').text()).toContain('<script>alert("xss")</script>')
    expect(wrapper.find<HTMLAnchorElement>('a[href="https://blog.example.test/article/test#ecoku-comment-7"]').exists()).toBe(true)
    expect(wrapper.find('.entry-actions .is-danger').text()).toBe('墓碑删除')
    expect(wrapper.find('.tabs').exists()).toBe(true)
    expect(wrapper.find('.entry').exists()).toBe(true)
    expect(wrapper.find('.pager').exists()).toBe(true)
    expect(wrapper.get('.entry-who').text()).toContain('private@example.com')
    expect(wrapper.get('.entry-page').text()).toContain('文章标题')
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.find('.entry-time').text()).toBe('09:02')
    expect(wrapper.find('.entry-time').attributes('title')).toBe('2026/08/13 09:02')
    expect(wrapper.get('#c-8 .entry-time').text()).toBe('时间未知')
  })

  it('renders the approved off/Turnstile/Cap selector without operational copy or plaintext secrets', () => {
    const store = useAdminStore(); store.authenticated = true; store.sessionReady = true
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
    expect(wrapper.find('h2').text()).toBe('人机验证')
  })

  it('submits newly entered Cap credentials without clearing the write-only secret', async () => {
    const store = useAdminStore(); store.authenticated = true; store.sessionReady = true
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
    const store = useAdminStore(); store.authenticated = true; store.sessionReady = true; store.sites = [site()]; store.selectedSiteId = 'site-a'
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
    expect(wrapper.text()).toContain('表情包')
    expect(wrapper.get('#smoji-enabled').attributes('type')).toBe('radio')
    expect(wrapper.get('#smoji-manifest-url').attributes('type')).toBe('url')
    expect(wrapper.text()).toContain('可能向该站点暴露访客 IP')
    expect(wrapper.text()).not.toContain('通知判定预览')
    expect(wrapper.text()).not.toContain('站点域名')
    expect(wrapper.text()).not.toContain('审核方式')
  })

  it('switches sites from the comment list and shows a static label when only one site exists', async () => {
    const store = useAdminStore()
    store.authenticated = true; store.sessionReady = true; store.sites = [site(), site({ id: 'site-b', name: '', siteUrl: 'https://notes.example.test' })]; store.selectedSiteId = 'site-a'
    const select = vi.spyOn(store, 'selectSite').mockResolvedValue()
    const wrapper = mount(CommentManagementView, { global: { plugins: [pinia] }, attachTo: document.body })
    const trigger = wrapper.get('.site-trigger')
    expect(trigger.text()).toContain("Dejavu's Blog")
    await trigger.trigger('click')
    const options = wrapper.findAll('.site-option')
    expect(options.map((option) => option.find('strong').text())).toEqual(["Dejavu's Blog", 'notes.example.test'])
    await options[1]!.trigger('click')
    expect(select).toHaveBeenCalledWith('site-b')
    store.sites = [site()]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.site-trigger').exists()).toBe(false)
    expect(wrapper.get('.site-static').text()).toContain("Dejavu's Blog")
    wrapper.unmount()
  })

  it('explains why a tombstone with replies cannot be permanently deleted and names the confirm action', async () => {
    const store = useAdminStore()
    const tombstone = comment({ status: 'deleted', deleted: true, hasChildren: true, username: '', content: '' })
    store.authenticated = true; store.sessionReady = true; store.sites = [site()]; store.selectedSiteId = 'site-a'; store.status = 'deleted'; store.comments = [tombstone]; store.selectedComment = tombstone
    const wrapper = mount(CommentManagementView, { global: { plugins: [pinia] } })
    expect(wrapper.find('.entry-actions .is-danger').exists()).toBe(false)
    expect(wrapper.text()).toContain('仍有回复，不能彻底删除')
    store.selectedComment = { ...tombstone, hasChildren: false }; store.comments = [store.selectedComment]
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.entry-actions .is-danger').text()).toBe('彻底删除')
  })

  it('collapses a disabled channel and asks to save only after turning a saved channel off', async () => {
    const store = useAdminStore(); store.authenticated = true; store.sessionReady = true; store.notificationSettings = notifications()
    const wrapper = mount(NotificationSettingsView, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('发送测试邮件')
    expect(wrapper.find('input[type="checkbox"][disabled][checked]').exists()).toBe(false)
    await wrapper.get('input[name="email-enabled"][value="false"]').setValue(true)
    expect(wrapper.text()).not.toContain('发送测试邮件')
    expect(wrapper.text()).toContain('未开启，不会发送任何邮件，包括访客回复通知。')
    expect(wrapper.text()).toContain('关闭后需保存才会生效')
    const save = wrapper.findAll('.save-button')[0]!
    expect(save.attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('input[name="email-encryption"]').map((input) => input.attributes('value'))).toEqual(['tls', 'starttls'])
  })

  it('renders redacted secret placeholders and destination separators without public template previews', () => {
    const store = useAdminStore(); store.authenticated = true; store.sessionReady = true; store.notificationSettings = notifications()
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
    const store = useAdminStore(); store.authenticated = true; store.sessionReady = true; store.sites = [site()]; store.selectedSiteId = 'site-a'; store.comments = []; store.counts = { published: 0, deleted: 0 }
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    const text = wrapper.text()
    for (const forbidden of ['用户注册', 'Count', 'management key', '站点管理密钥', '待审核', '批准所选', '拒绝所选', '配色预览']) expect(text).not.toContain(forbidden)
    expect(text).toContain('评论管理')
    expect(text).toContain('站点')
    expect(text).toContain('通知')
    expect(text).toContain('安全')
  })

  it('uses auto color scheme with comment-aligned dark tokens and no persisted theme switcher', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const html = fs.readFileSync(path.join(here, '../index.html'), 'utf8')
    const css = fs.readFileSync(path.join(here, 'style.css'), 'utf8')
    expect(html).toContain('data-theme="auto"')
    expect(html).toContain('content="light dark"')
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toMatch(/html\[data-theme="auto"\][\s\S]*--paper: #1a1816;/)
    const clientCss = fs.readFileSync(path.join(here, '../../client/src/style.css'), 'utf8')
    for (const [admin, client] of [
      ['--paper: #f7f4ee', '--ecoku-theme: #f7f4ee'], ['--surface: #fbf9f5', '--ecoku-entry: #fbf9f5'], ['--ink: #1e1c19', '--ecoku-primary: #1e1c19'],
      ['--paper: #1a1816', '--ecoku-theme: #1a1816'], ['--surface: #211f1c', '--ecoku-entry: #211f1c'], ['--ink: #eee8dd', '--ecoku-primary: #eee8dd'],
    ]) {
      expect(css).toContain(admin)
      expect(clientCss).toContain(client)
    }
    expect(css).toContain('--accent: color-mix(in oklab, #c8553a 75%, var(--ink))')
    expect(css).toContain('--sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"')
    expect(css).not.toMatch(/"Songti SC"|"STSong"|"Noto Serif SC"|@font-face|@import/)
    expect(css).toContain('.options-list')
    expect(css).toContain('.admin-cap-widget')
    expect(css).toContain('--cap-widget-width: 260px')
    expect(css).toContain('--cap-widget-height: 58px')
    expect(css).not.toContain('OPPO Serif SC')
    expect(html).not.toMatch(/localStorage|sessionStorage/)
    expect(css).not.toMatch(/localStorage|sessionStorage/)
  })
})

describe('request cancellation isolation', () => {
  it('preserves caller abort instead of wrapping a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    })))
    const controller = new AbortController()
    const result = adminApi.listSites(controller.signal)
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('does not let a stale failure overwrite a newer queue', async () => {
    const store = useAdminStore()
    store.authenticated = true; store.sessionReady = true; store.selectedSiteId = 'site-a'
    let rejectOld!: (error: unknown) => void
    vi.spyOn(adminApi, 'listComments').mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject }))
      .mockResolvedValueOnce(page([comment({ id: 99 })]))
    vi.spyOn(adminApi, 'getComment').mockResolvedValue(comment({ id: 99 }))
    const old = store.loadComments()
    await store.loadComments()
    rejectOld(new ApiError(500, 'late'))
    await old
    expect(store.comments[0]?.id).toBe(99)
    expect(store.queueMessage).toBe('')
  })
})

it('times out while reading an admin response body', async () => {
  vi.useFakeTimers()
  try {
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => ({
      ok: true, status: 200,
      json: () => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })),
    })))
    const result = adminApi.listSites()
    const assertion = expect(result).rejects.toMatchObject({ status: 0, errorCode: 'timeout' })
    await vi.advanceTimersByTimeAsync(30000)
    await assertion
  } finally { vi.useRealTimers() }
})

describe('persistent administrator session', () => {
  it('restores the server expiry without storing a credential and keeps a failed logout active', async () => {
    vi.useFakeTimers()
    try {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
      vi.spyOn(adminApi, 'getSession').mockResolvedValue({ expiresAt, expiresIn: 28800 })
      vi.spyOn(adminApi, 'listSites').mockResolvedValue([])
      const store = useAdminStore()
      await store.restoreSession()
      expect(store.authenticated).toBe(true)
      expect(store.expiresAt).toBe(expiresAt)
      expect(store).not.toHaveProperty('token')
      const logout = vi.spyOn(adminApi, 'logout').mockRejectedValueOnce(new ApiError(503, 'unavailable')).mockResolvedValueOnce(undefined)
      expect(await store.logout()).toBe(false)
      expect(store.authenticated).toBe(true)
      expect(store.logoutMessage).toBe('退出失败，请重试。')
      expect(await store.logout()).toBe(true)
      expect(store.authenticated).toBe(false)
      expect(logout).toHaveBeenCalledTimes(2)
    } finally { vi.useRealTimers() }
  })

  it('expires at the original deadline and ignores a private response arriving after logout', async () => {
    vi.useFakeTimers()
    try {
      const store = useAdminStore()
      vi.spyOn(adminApi, 'getSession').mockResolvedValue({ expiresAt: new Date(Date.now() + 1000).toISOString(), expiresIn: 1 })
      vi.spyOn(adminApi, 'listSites').mockResolvedValue([])
      await store.restoreSession()
      vi.advanceTimersByTime(1000)
      expect(store.authenticated).toBe(false)
      expect(store.loginMessage).toBe(messages.sessionExpired)
    } finally { vi.useRealTimers() }
    let release: ((value: Response) => void) | undefined
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(() => new Promise((resolve) => { release = resolve })))
    const store = useAdminStore(); store.authenticated = true
    const pending = store.loadSites()
    vi.spyOn(adminApi, 'logout').mockResolvedValue(undefined)
    await store.logout()
    release?.(response(200, { data: [{ id: 'private-site' }] }))
    await pending
    expect(store.sites).toEqual([])
  })
})
