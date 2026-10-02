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
  const passwordSetupRequired = ref(false)
  const passwordSetupBusy = ref(false)
  const passwordSetupMessage = ref('')
  const view = ref<MainView>('comments')
  const dirtyView = ref<MainView | null>(null)
  const discardRequested = ref(false)
  let pendingNavigation: (() => void | Promise<unknown>) | null = null
  const sites = ref<SiteSummary[]>([])
  const selectedSiteId = ref('')
  const createSiteRequest = ref(0)
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
  // A quiet reload keeps the current page on screen while it syncs with the server.
  const queueQuiet = ref(false)
  const detailBusy = ref(false)
  const actionBusy = ref(false)
  const queueMessage = ref('')
  const actionMessage = ref('')
  const toastMessage = ref('')
  // Counts toasts so that the same message twice in a row is still shown twice.
  const toastSerial = ref(0)
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

  function toast(message: string) { toastMessage.value = message; toastSerial.value += 1 }
  function clearSession(reason = '') {
    if (expiryTimer) clearTimeout(expiryTimer)
    queueController?.abort(); detailController?.abort()
    ++queueGeneration; ++detailGeneration
    queueBusy.value = false; queueQuiet.value = false; detailBusy.value = false
    cancelAdminRequests()
    authenticated.value = false; expiresAt.value = ''; sites.value = []; selectedSiteId.value = ''
    passwordSetupRequired.value = false; passwordSetupMessage.value = ''
    comments.value = []; selectedComment.value = null; counts.value = emptyCounts()
    notificationSettings.value = null; captchaSettings.value = null
    view.value = 'comments'; dirtyView.value = null; discardRequested.value = false; pendingNavigation = null; loginMessage.value = reason
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
      authenticated.value = true; expiresAt.value = session.expiresAt; passwordSetupRequired.value = session.requiresPasswordChange; armExpiry(session.expiresAt)
      if (!passwordSetupRequired.value) await loadSites(true)
      return authenticated.value
    } catch (error) { clearSession(failureMessage(error, true)); return false }
    finally { loginBusy.value = false }
  }
  async function restoreSession() {
    if (authenticated.value) { sessionReady.value = true; return }
    try {
      const session = await adminApi.getSession()
      authenticated.value = true; expiresAt.value = session.expiresAt; passwordSetupRequired.value = session.requiresPasswordChange; armExpiry(session.expiresAt)
      sessionReady.value = true
      if (authenticated.value && !passwordSetupRequired.value) await loadSites(true)
    } catch (error) {
      clearSession(error instanceof ApiError && error.status === 401 ? '' : messages.loginUnavailable)
    } finally { sessionReady.value = true }
  }
  async function completeInitialSetup(username: string, password: string) {
    if (passwordSetupBusy.value) return false
    passwordSetupBusy.value = true; passwordSetupMessage.value = ''
    try {
      const session = await adminApi.initialSetup(username, password)
      passwordSetupRequired.value = false; expiresAt.value = session.expiresAt; armExpiry(session.expiresAt)
      view.value = 'sites'; createSiteRequest.value += 1
      await loadSites(true)
      return true
    } catch (error) {
      passwordSetupMessage.value = failureMessage(error)
      return false
    } finally { passwordSetupBusy.value = false }
  }
  function consumeCreateSiteRequest() { createSiteRequest.value = 0 }
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
    if (next === view.value) return
    view.value = next
    if (next === 'comments') await loadComments()
    else if (next === 'sites') await loadSites(false)
    else if (next === 'security') await loadCaptcha()
    else await loadNotifications()
  }
  function setDirty(owner: MainView, dirty: boolean) {
    if (dirty) dirtyView.value = owner
    else if (dirtyView.value === owner) dirtyView.value = null
  }
  function requestNavigation(action: () => void | Promise<unknown>) {
    if (!dirtyView.value) { void action(); return }
    pendingNavigation = action
    discardRequested.value = true
  }
  function resolveNavigation(discard: boolean) {
    const action = pendingNavigation
    pendingNavigation = null; discardRequested.value = false
    if (discard && action) void action()
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
      selectedSiteId.value = saved.id; toast(creating ? messages.siteCreated : messages.siteUpdated)
      return saved
    } catch (error) { fail(error, 'site'); return null }
    finally { siteBusy.value = false }
  }
  async function loadComments(announce = false, quiet = false): Promise<void> {
    if (!authenticated.value || !selectedSiteId.value) return
    detailController?.abort(); ++detailGeneration; detailBusy.value = false
    queueController?.abort(); queueController = new AbortController(); const generation = ++queueGeneration
    queueBusy.value = true; queueQuiet.value = quiet; queueMessage.value = ''; actionMessage.value = ''
    try {
      const result = await adminApi.listComments(selectedSiteId.value, status.value, page.value, pageSize.value, sort.value, queueController.signal)
      if (generation !== queueGeneration) return
      if (!result.data.length && result.page > 1 && result.pageCount > 0 && result.page > result.pageCount) {
        // The last comment of the last page is gone: show the new last page rather than an empty one.
        page.value = result.pageCount
        return await loadComments(announce, quiet)
      }
      comments.value = result.data; counts.value = result.counts; total.value = result.total
      page.value = result.page; pageSize.value = result.pageSize; pageCount.value = result.pageCount
      const next = comments.value.find((item) => item.id === selectedComment.value?.id) ?? null
      selectedComment.value = next; if (next) void loadDetail(next.id)
      if (announce) toast(messages.refreshed)
    } catch (error) { if (generation === queueGeneration && !(error instanceof DOMException && error.name === 'AbortError')) fail(error, 'queue') }
    finally { if (generation === queueGeneration) { queueBusy.value = false; queueQuiet.value = false } }
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
  async function mutateCurrent(kind: 'tombstone' | 'permanent', id = selectedComment.value?.id, leave?: (id: number) => Promise<void>) {
    const target = selectedComment.value?.id === id ? selectedComment.value : comments.value.find((item) => item.id === id)
    if (!target || actionBusy.value) return false
    if (kind === 'permanent' && (!target.deleted || target.hasChildren)) {
      actionMessage.value = target.hasChildren ? '仍有回复，不能彻底删除' : messages.invalidRequest
      return false
    }
    const siteId = selectedSiteId.value
    actionBusy.value = true; actionMessage.value = ''
    try {
      if (kind === 'tombstone') await adminApi.tombstone(siteId, target.id)
      else await adminApi.permanentlyDelete(siteId, target.id)
      await leave?.(target.id)
      toast(kind === 'tombstone' ? messages.tombstoned : messages.permanentlyDeleted)
      if (selectedComment.value?.id === target.id) selectedComment.value = null
      // The faded comment keeps its place until the quiet reload swaps in the whole page at once,
      // so the page keeps its height and scroll position when the next page's comment moves up.
      await loadComments(false, true); return true
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
    try { const saved = await adminApi.saveEmail(settings); if (notificationSettings.value) notificationSettings.value.email = saved; toast(messages.emailSaved); return saved }
    catch (error) { fail(error, 'notification'); return null }
    finally { notificationBusy.value = false }
  }
  async function saveTelegram(settings: TelegramNotificationSettings) {
    notificationBusy.value = true
    try { const saved = await adminApi.saveTelegram(settings); if (notificationSettings.value) notificationSettings.value.telegram = saved; toast(messages.telegramSaved); return saved }
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
      toast(messages.captchaSaved)
      return saved
    } catch (error) { fail(error, 'security'); return null }
    finally { captchaBusy.value = false }
  }
  return { sessionReady, logoutBusy, logoutMessage, expiresAt, loginBusy, loginMessage, passwordSetupRequired, passwordSetupBusy, passwordSetupMessage, authenticated, view, dirtyView, discardRequested, sites, selectedSiteId, selectedSite, createSiteRequest, siteBusy, siteMessage,
    status, sort, page, pageSize, pageCount, total, counts, comments, selectedComment, queueBusy, queueQuiet, detailBusy, actionBusy, queueMessage, actionMessage, toastMessage, toastSerial,
    notificationSettings, notificationBusy, notificationMessage, emailTestState, emailTestMessage, telegramTestState, telegramTestMessage,
    captchaSettings, captchaBusy, captchaMessage,
    login, completeInitialSetup, consumeCreateSiteRequest, logout, restoreSession, switchView, loadSites, saveSite, loadComments, loadDetail, selectSite, selectStatus, toggleSort, selectPage, selectComment, mutateCurrent,
    loadNotifications, saveEmail, saveTelegram, testEmail, testTelegram, loadCaptcha, saveCaptcha, setDirty, requestNavigation, resolveNavigation }
})
