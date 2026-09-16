import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { adminApi, ApiError, cancelAdminRequests } from '../api'
import { messages } from '../messages'
import type { CaptchaSettings, CommentReview, CommentStatus, EmailNotificationSettings, MainView, NotificationSettings, SiteSummary, SiteWrite, TelegramNotificationSettings } from '../types'

function failureMessage(error: unknown, login = false): string {
  if (!(error instanceof ApiError)) return messages.genericError
  if (error.status === 0) return messages.networkError
  if (error.status === 401) return login ? messages.loginFailed : messages.sessionExpired
  if (error.status === 400) {
    if (login && error.message) return error.message
    return messages.invalidRequest
  }
  if (error.status === 403) return messages.forbidden
  if (error.status === 404) return messages.notFound
  if (error.status === 409) return messages.conflict
  if (error.status === 413) return messages.tooLarge
  if (error.status === 429) return messages.rateLimited
  if (error.status >= 500) return login ? messages.loginUnavailable : messages.serverError
  return messages.genericError
}

function testFailureMessage(error: unknown, channel: 'email' | 'telegram'): string {
  if (!(error instanceof ApiError)) return '发送失败：未知错误'
  if (error.status === 0) return '发送失败：网络不可用'
  if (error.status === 400) return '发送失败：配置无效'
  if (error.status === 429) return '发送失败：操作过于频繁'
  if (error.errorCode === 'timeout') return channel === 'email' ? '发送失败：连接 SMTP 服务器超时' : '发送失败：连接 Telegram 超时'
  if (error.errorCode === 'authentication_failed') return channel === 'email' ? '发送失败：SMTP 认证未通过' : '发送失败：Telegram 认证未通过'
  if (error.errorCode === 'tls_failed') return channel === 'email' ? '发送失败：SMTP TLS 连接失败' : '发送失败：Telegram TLS 连接失败'
  if (error.errorCode === 'delivery_failed') return channel === 'email' ? '发送失败：SMTP 连接或投递失败' : '发送失败：Telegram 消息投递失败'
  return '发送失败：服务暂时不可用'
}

const emptyCounts = (): Record<CommentStatus, number> => ({ published: 0, deleted: 0 })

export const useAdminStore = defineStore('admin', () => {
  const authenticated = ref(false)
  const sessionReady = ref(false)
  const logoutBusy = ref(false)
  const logoutMessage = ref('')
  const expiresAt = ref('')
  const loginBusy = ref(false)
  const loginMessage = ref('')
  const view = ref<MainView>('comments')
  const sites = ref<SiteSummary[]>([])
  const selectedSiteId = ref('')
  const siteBusy = ref(false)
  const siteMessage = ref('')
  const status = ref<CommentStatus>('published')
  const sort = ref<'oldest' | 'newest'>('newest')
  const page = ref(1)
  const pageSize = ref(20)
  const pageCount = ref(0)
  const total = ref(0)
  const counts = ref(emptyCounts())
  const comments = ref<CommentReview[]>([])
  const selectedComment = ref<CommentReview | null>(null)
  const queueBusy = ref(false)
  const detailBusy = ref(false)
  const actionBusy = ref(false)
  const queueMessage = ref('')
  const actionMessage = ref('')
  const toastMessage = ref('')
  const notificationSettings = ref<NotificationSettings | null>(null)
  const notificationBusy = ref(false)
  const notificationMessage = ref('')
  const emailTestState = ref<'idle' | 'success' | 'failure'>('idle')
  const emailTestMessage = ref('')
  const telegramTestState = ref<'idle' | 'success' | 'failure'>('idle')
  const telegramTestMessage = ref('')
  const captchaSettings = ref<CaptchaSettings | null>(null)
  const captchaBusy = ref(false)
  const captchaMessage = ref('')
  const selectedSite = computed(() => sites.value.find((site) => site.id === selectedSiteId.value) ?? null)
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let queueController: AbortController | undefined
  let detailController: AbortController | undefined
  let queueGeneration = 0
  let detailGeneration = 0

  function clearSession(reason = '') {
    if (expiryTimer) clearTimeout(expiryTimer)
    queueController?.abort(); detailController?.abort()
    ++queueGeneration; ++detailGeneration
    queueBusy.value = false; detailBusy.value = false
    cancelAdminRequests()
    authenticated.value = false; expiresAt.value = ''; sites.value = []; selectedSiteId.value = ''
    comments.value = []; selectedComment.value = null; counts.value = emptyCounts()
    notificationSettings.value = null; captchaSettings.value = null
    view.value = 'comments'; loginMessage.value = reason
  }
  function armExpiry(value: string) {
    if (expiryTimer) clearTimeout(expiryTimer)
    const delay = Date.parse(value) - Date.now()
    if (!Number.isFinite(delay) || delay <= 0) return clearSession(messages.sessionExpired)
    expiryTimer = setTimeout(() => clearSession(messages.sessionExpired), Math.min(delay, 2_147_000_000))
  }
  function fail(error: unknown, destination: 'queue' | 'action' | 'site' | 'notification' | 'security') {
    if (error instanceof ApiError && error.status === 401) return clearSession(messages.sessionExpired)
    const message = failureMessage(error)
    if (destination === 'queue') queueMessage.value = message
    else if (destination === 'action') actionMessage.value = message
    else if (destination === 'site') siteMessage.value = message
    else if (destination === 'security') captchaMessage.value = message
    else notificationMessage.value = message
  }
  async function login(username: string, password: string, captchaToken = '') {
    if (loginBusy.value) return false
    loginBusy.value = true; loginMessage.value = ''
    try {
      const session = await adminApi.login(username, password, captchaToken)
      authenticated.value = true; expiresAt.value = session.expiresAt; armExpiry(session.expiresAt)
      await loadSites(true); return authenticated.value
    } catch (error) { clearSession(failureMessage(error, true)); return false }
    finally { loginBusy.value = false }
  }
  async function restoreSession() {
    if (authenticated.value) { sessionReady.value = true; return }
    try {
      const session = await adminApi.getSession()
      authenticated.value = true; expiresAt.value = session.expiresAt; armExpiry(session.expiresAt)
      sessionReady.value = true
      if (authenticated.value) await loadSites(true)
    } catch (error) {
      clearSession(error instanceof ApiError && error.status === 401 ? '' : messages.loginUnavailable)
    } finally { sessionReady.value = true }
  }
  async function logout() {
    if (logoutBusy.value) return false
    logoutBusy.value = true; logoutMessage.value = ''
    try { await adminApi.logout(); clearSession(); return true }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) { clearSession(); return true }
      logoutMessage.value = messages.logoutFailed; return false
    } finally { logoutBusy.value = false }
  }
  async function switchView(next: MainView) {
    view.value = next
    if (next === 'comments') await loadComments()
    else if (next === 'sites') await loadSites(false)
    else if (next === 'security') await loadCaptcha()
    else await loadNotifications()
  }
  async function loadSites(loadCommentsAfter = false) {
    if (!authenticated.value || siteBusy.value) return
    siteBusy.value = true; siteMessage.value = ''
    try {
      sites.value = await adminApi.listSites()
      if (!sites.value.some((site) => site.id === selectedSiteId.value)) selectedSiteId.value = sites.value[0]?.id ?? ''
      if (loadCommentsAfter && selectedSiteId.value) await loadComments()
    } catch (error) { fail(error, 'site') }
    finally { siteBusy.value = false }
  }
  async function saveSite(input: SiteWrite, creating: boolean) {
    if (!authenticated.value || siteBusy.value) return null
    siteBusy.value = true; siteMessage.value = ''
    try {
      const saved = creating ? await adminApi.createSite(input) : await adminApi.updateSite(input)
      const index = sites.value.findIndex((site) => site.id === saved.id)
      if (index >= 0) sites.value[index] = saved; else sites.value.push(saved)
      sites.value = [...sites.value].sort((a, b) => (a.name || a.siteUrl).localeCompare(b.name || b.siteUrl, 'zh-CN'))
      selectedSiteId.value = saved.id; toastMessage.value = creating ? messages.siteCreated : messages.siteUpdated
      return saved
    } catch (error) { fail(error, 'site'); return null }
    finally { siteBusy.value = false }
  }
  async function loadComments(announce = false) {
    if (!authenticated.value || !selectedSiteId.value) return
    detailController?.abort(); ++detailGeneration; detailBusy.value = false
    queueController?.abort(); queueController = new AbortController(); const generation = ++queueGeneration
    queueBusy.value = true; queueMessage.value = ''; actionMessage.value = ''
    try {
      const result = await adminApi.listComments(selectedSiteId.value, status.value, page.value, pageSize.value, sort.value, queueController.signal)
      if (generation !== queueGeneration) return
      comments.value = result.data; counts.value = result.counts; total.value = result.total
      page.value = result.page; pageSize.value = result.pageSize; pageCount.value = result.pageCount
      const next = comments.value.find((item) => item.id === selectedComment.value?.id) ?? comments.value[0] ?? null
      selectedComment.value = next; if (next) void loadDetail(next.id)
      if (announce) toastMessage.value = messages.refreshed
    } catch (error) { if (generation === queueGeneration && !(error instanceof DOMException && error.name === 'AbortError')) fail(error, 'queue') }
    finally { if (generation === queueGeneration) queueBusy.value = false }
  }
  async function loadDetail(id: number) {
    detailController?.abort(); detailController = new AbortController(); const generation = ++detailGeneration; detailBusy.value = true
    try {
      const comment = await adminApi.getComment(selectedSiteId.value, id, detailController.signal)
      if (generation === detailGeneration && selectedComment.value?.id === id) selectedComment.value = comment
    } catch (error) { if (generation === detailGeneration && !(error instanceof DOMException && error.name === 'AbortError')) fail(error, 'action') }
    finally { if (generation === detailGeneration) detailBusy.value = false }
  }
  async function selectSite(id: string) { selectedSiteId.value = id; page.value = 1; selectedComment.value = null; if (view.value === 'comments') await loadComments() }
  async function selectStatus(next: CommentStatus) { status.value = next; page.value = 1; selectedComment.value = null; await loadComments() }
  async function toggleSort() { sort.value = sort.value === 'oldest' ? 'newest' : 'oldest'; page.value = 1; await loadComments() }
  async function selectPage(next: number) { if (next < 1 || next > pageCount.value) return; page.value = next; await loadComments() }
  function selectComment(id: number) { const value = comments.value.find((item) => item.id === id); if (value) { selectedComment.value = value; void loadDetail(id) } }
  async function mutateCurrent(kind: 'tombstone' | 'permanent') {
    if (!selectedComment.value || actionBusy.value) return false
    actionBusy.value = true; actionMessage.value = ''
    try {
      if (kind === 'tombstone') await adminApi.tombstone(selectedSiteId.value, selectedComment.value.id)
      else await adminApi.permanentlyDelete(selectedSiteId.value, selectedComment.value.id)
      toastMessage.value = kind === 'tombstone' ? messages.tombstoned : messages.permanentlyDeleted
      selectedComment.value = null; await loadComments(); return true
    } catch (error) { fail(error, 'action'); return false }
    finally { actionBusy.value = false }
  }
  async function loadNotifications() {
    if (notificationBusy.value) return
    notificationBusy.value = true; notificationMessage.value = ''
    try { notificationSettings.value = await adminApi.getNotifications() }
    catch (error) { fail(error, 'notification') }
    finally { notificationBusy.value = false }
  }
  async function saveEmail(settings: EmailNotificationSettings) {
    notificationBusy.value = true
    try { const saved = await adminApi.saveEmail(settings); if (notificationSettings.value) notificationSettings.value.email = saved; toastMessage.value = messages.emailSaved; return saved }
    catch (error) { fail(error, 'notification'); return null }
    finally { notificationBusy.value = false }
  }
  async function saveTelegram(settings: TelegramNotificationSettings) {
    notificationBusy.value = true
    try { const saved = await adminApi.saveTelegram(settings); if (notificationSettings.value) notificationSettings.value.telegram = saved; toastMessage.value = messages.telegramSaved; return saved }
    catch (error) { fail(error, 'notification'); return null }
    finally { notificationBusy.value = false }
  }
  async function testEmail(settings: EmailNotificationSettings) {
    notificationBusy.value = true; emailTestState.value = 'idle'; emailTestMessage.value = ''
    try { await adminApi.testEmail(settings); emailTestState.value = 'success'; emailTestMessage.value = '测试邮件已发送' }
    catch (error) { emailTestState.value = 'failure'; emailTestMessage.value = testFailureMessage(error, 'email') }
    finally { notificationBusy.value = false }
  }
  async function testTelegram(settings: TelegramNotificationSettings) {
    notificationBusy.value = true; telegramTestState.value = 'idle'; telegramTestMessage.value = ''
    try { await adminApi.testTelegram(settings); telegramTestState.value = 'success'; telegramTestMessage.value = '测试消息已发送' }
    catch (error) { telegramTestState.value = 'failure'; telegramTestMessage.value = testFailureMessage(error, 'telegram') }
    finally { notificationBusy.value = false }
  }
  async function loadCaptcha() {
    if (captchaBusy.value) return
    captchaBusy.value = true; captchaMessage.value = ''
    try { captchaSettings.value = await adminApi.getCaptcha() }
    catch (error) { fail(error, 'security') }
    finally { captchaBusy.value = false }
  }
  async function saveCaptcha(settings: CaptchaSettings) {
    captchaBusy.value = true; captchaMessage.value = ''
    try {
      const saved = await adminApi.saveCaptcha(settings)
      captchaSettings.value = saved
      toastMessage.value = messages.captchaSaved
      return saved
    } catch (error) { fail(error, 'security'); return null }
    finally { captchaBusy.value = false }
  }
  return { sessionReady, logoutBusy, logoutMessage, expiresAt, loginBusy, loginMessage, authenticated, view, sites, selectedSiteId, selectedSite, siteBusy, siteMessage,
    status, sort, page, pageSize, pageCount, total, counts, comments, selectedComment, queueBusy, detailBusy, actionBusy, queueMessage, actionMessage, toastMessage,
    notificationSettings, notificationBusy, notificationMessage, emailTestState, emailTestMessage, telegramTestState, telegramTestMessage,
    captchaSettings, captchaBusy, captchaMessage,
    login, logout, restoreSession, switchView, loadSites, saveSite, loadComments, loadDetail, selectSite, selectStatus, toggleSort, selectPage, selectComment, mutateCurrent,
    loadNotifications, saveEmail, saveTelegram, testEmail, testTelegram, loadCaptcha, saveCaptcha }
})
