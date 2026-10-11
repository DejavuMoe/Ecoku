import { getContext } from 'svelte'
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

export function createAdminStore() {
  const state = $state({
    authenticated: false,
    sessionReady: false,
    logoutBusy: false,
    logoutMessage: '',
    expiresAt: '',
    loginBusy: false,
    loginMessage: '',
    passwordSetupRequired: false,
    // A reset account may already have a different name.
    setupUsername: '',
    passwordSetupBusy: false,
    passwordSetupMessage: '',
    view: 'comments' as MainView,
    dirtyView: null as MainView | null,
    discardRequested: false,
    sites: [] as SiteSummary[],
    selectedSiteId: '',
    createSiteRequest: 0,
    siteBusy: false,
    siteMessage: '',
    status: 'published' as CommentStatus,
    sort: 'newest' as 'oldest' | 'newest',
    page: 1,
    pageSize: 20,
    pageCount: 0,
    total: 0,
    counts: emptyCounts(),
    comments: [] as CommentReview[],
    selectedComment: null as CommentReview | null,
    queueBusy: false,
    // Keep the page visible while a deletion reloads its contents.
    queueQuiet: false,
    detailBusy: false,
    actionBusy: false,
    queueMessage: '',
    actionMessage: '',
    toastMessage: '',
    // Identical messages must still be announced again.
    toastSerial: 0,
    notificationSettings: null as NotificationSettings | null,
    notificationBusy: false,
    notificationMessage: '',
    emailTestState: 'idle' as 'idle' | 'success' | 'failure',
    emailTestMessage: '',
    telegramTestState: 'idle' as 'idle' | 'success' | 'failure',
    telegramTestMessage: '',
    captchaSettings: null as CaptchaSettings | null,
    captchaBusy: false,
    captchaMessage: '',
    get selectedSite(): SiteSummary | null { return state.sites.find(site => site.id === state.selectedSiteId) ?? null },
  })
  let pendingNavigation: (() => void | Promise<unknown>) | null = null
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let queueController: AbortController | undefined
  let detailController: AbortController | undefined
  let queueGeneration = 0
  let detailGeneration = 0

  function toast(message: string) { state.toastMessage = message; state.toastSerial += 1 }
  function clearSession(reason = '') {
    if (expiryTimer) clearTimeout(expiryTimer)
    queueController?.abort(); detailController?.abort()
    ++queueGeneration; ++detailGeneration
    state.queueBusy = false; state.queueQuiet = false; state.detailBusy = false
    cancelAdminRequests()
    state.authenticated = false; state.expiresAt = ''; state.sites = []; state.selectedSiteId = ''
    state.passwordSetupRequired = false; state.setupUsername = ''; state.passwordSetupMessage = ''
    state.comments = []; state.selectedComment = null; state.counts = emptyCounts()
    state.notificationSettings = null; state.captchaSettings = null
    state.view = 'comments'; state.dirtyView = null; state.discardRequested = false; pendingNavigation = null; state.loginMessage = reason
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
    if (destination === 'queue') state.queueMessage = message
    else if (destination === 'action') state.actionMessage = message
    else if (destination === 'site') state.siteMessage = message
    else if (destination === 'security') state.captchaMessage = message
    else state.notificationMessage = message
  }
  async function login(username: string, password: string, captchaToken = '') {
    if (state.loginBusy) return false
    state.loginBusy = true; state.loginMessage = ''
    try {
      const session = await adminApi.login(username, password, captchaToken)
      state.authenticated = true; state.expiresAt = session.expiresAt; state.passwordSetupRequired = session.requiresPasswordChange; armExpiry(session.expiresAt)
      state.setupUsername = session.requiresPasswordChange ? session.username ?? username.trim() : ''
      if (!state.passwordSetupRequired) await loadSites(true)
      return state.authenticated
    } catch (error) { clearSession(failureMessage(error, true)); return false }
    finally { state.loginBusy = false }
  }
  async function restoreSession() {
    if (state.authenticated) { state.sessionReady = true; return }
    try {
      const session = await adminApi.getSession()
      state.authenticated = true; state.expiresAt = session.expiresAt; state.passwordSetupRequired = session.requiresPasswordChange; armExpiry(session.expiresAt)
      state.setupUsername = session.requiresPasswordChange ? session.username ?? '' : ''
      state.sessionReady = true
      if (state.authenticated && !state.passwordSetupRequired) await loadSites(true)
    } catch (error) {
      clearSession(error instanceof ApiError && error.status === 401 ? '' : messages.loginUnavailable)
    } finally { state.sessionReady = true }
  }
  async function completeInitialSetup(username: string, password: string) {
    if (state.passwordSetupBusy) return false
    state.passwordSetupBusy = true; state.passwordSetupMessage = ''
    try {
      const session = await adminApi.initialSetup(username, password)
      state.passwordSetupRequired = false; state.setupUsername = ''; state.expiresAt = session.expiresAt; armExpiry(session.expiresAt)
      state.view = 'sites'; state.createSiteRequest += 1
      await loadSites(true)
      return true
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clearSession(messages.sessionExpired)
      else state.passwordSetupMessage = failureMessage(error)
      return false
    } finally { state.passwordSetupBusy = false }
  }
  function consumeCreateSiteRequest() { state.createSiteRequest = 0 }
  async function logout() {
    if (state.logoutBusy) return false
    state.logoutBusy = true; state.logoutMessage = ''
    try { await adminApi.logout(); clearSession(); return true }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) { clearSession(); return true }
      state.logoutMessage = messages.logoutFailed; return false
    } finally { state.logoutBusy = false }
  }
  async function switchView(next: MainView) {
    if (next === state.view) return
    state.view = next
    if (next === 'comments') await loadComments()
    else if (next === 'sites') await loadSites(false)
    else if (next === 'security') await loadCaptcha()
    else await loadNotifications()
  }
  function setDirty(owner: MainView, dirty: boolean) {
    if (dirty) state.dirtyView = owner
    else if (state.dirtyView === owner) state.dirtyView = null
  }
  function requestNavigation(action: () => void | Promise<unknown>) {
    if (!state.dirtyView) { void action(); return }
    pendingNavigation = action
    state.discardRequested = true
  }
  function resolveNavigation(discard: boolean) {
    const action = pendingNavigation
    pendingNavigation = null; state.discardRequested = false
    if (discard && action) void action()
  }
  async function loadSites(loadCommentsAfter = false) {
    if (!state.authenticated || state.siteBusy) return
    state.siteBusy = true; state.siteMessage = ''
    try {
      state.sites = await adminApi.listSites()
      if (!state.sites.some((site) => site.id === state.selectedSiteId)) state.selectedSiteId = state.sites[0]?.id ?? ''
      if (loadCommentsAfter && state.selectedSiteId) await loadComments()
    } catch (error) { fail(error, 'site') }
    finally { state.siteBusy = false }
  }
  async function saveSite(input: SiteWrite, creating: boolean) {
    if (!state.authenticated || state.siteBusy) return null
    state.siteBusy = true; state.siteMessage = ''
    try {
      const saved = creating ? await adminApi.createSite(input) : await adminApi.updateSite(input)
      const index = state.sites.findIndex((site) => site.id === saved.id)
      if (index >= 0) state.sites[index] = saved; else state.sites.push(saved)
      state.sites = [...state.sites].sort((a, b) => (a.name || a.siteUrl).localeCompare(b.name || b.siteUrl, 'zh-CN'))
      state.selectedSiteId = saved.id; toast(creating ? messages.siteCreated : messages.siteUpdated)
      return saved
    } catch (error) { fail(error, 'site'); return null }
    finally { state.siteBusy = false }
  }
  async function loadComments(announce = false, quiet = false): Promise<void> {
    if (!state.authenticated || !state.selectedSiteId) return
    detailController?.abort(); ++detailGeneration; state.detailBusy = false
    queueController?.abort(); queueController = new AbortController(); const generation = ++queueGeneration
    state.queueBusy = true; state.queueQuiet = quiet; state.queueMessage = ''; state.actionMessage = ''
    try {
      const result = await adminApi.listComments(state.selectedSiteId, state.status, state.page, state.pageSize, state.sort, queueController.signal)
      if (generation !== queueGeneration) return
      if (!result.data.length && result.page > 1 && result.pageCount > 0 && result.page > result.pageCount) {
        // The last comment of the last page is gone: show the new last page rather than an empty one.
        state.page = result.pageCount
        return await loadComments(announce, quiet)
      }
      state.comments = result.data; state.counts = result.counts; state.total = result.total
      state.page = result.pageCount === 0 ? 1 : result.page; state.pageSize = result.pageSize; state.pageCount = result.pageCount
      const next = state.comments.find((item) => item.id === state.selectedComment?.id) ?? null
      state.selectedComment = next; if (next) void loadDetail(next.id)
      if (announce) toast(messages.refreshed)
    } catch (error) { if (generation === queueGeneration && !(error instanceof DOMException && error.name === 'AbortError')) fail(error, 'queue') }
    finally { if (generation === queueGeneration) { state.queueBusy = false; state.queueQuiet = false } }
  }
  async function loadDetail(id: number) {
    detailController?.abort(); detailController = new AbortController(); const generation = ++detailGeneration; state.detailBusy = true
    try {
      const comment = await adminApi.getComment(state.selectedSiteId, id, detailController.signal)
      if (generation === detailGeneration && state.selectedComment?.id === id) state.selectedComment = comment
    } catch (error) { if (generation === detailGeneration && !(error instanceof DOMException && error.name === 'AbortError')) fail(error, 'action') }
    finally { if (generation === detailGeneration) state.detailBusy = false }
  }
  async function selectSite(id: string) { state.selectedSiteId = id; state.page = 1; state.selectedComment = null; if (state.view === 'comments') await loadComments() }
  async function selectStatus(next: CommentStatus) { state.status = next; state.page = 1; state.selectedComment = null; await loadComments() }
  async function toggleSort() { state.sort = state.sort === 'oldest' ? 'newest' : 'oldest'; state.page = 1; await loadComments() }
  async function selectPage(next: number) { if (next < 1 || next > state.pageCount) return; state.page = next; await loadComments() }
  function selectComment(id: number) { const value = state.comments.find((item) => item.id === id); if (value) { state.selectedComment = value; void loadDetail(id) } }
  async function mutateCurrent(kind: 'tombstone' | 'permanent', id = state.selectedComment?.id, leave?: (id: number) => Promise<void>) {
    const target = state.selectedComment?.id === id ? state.selectedComment : state.comments.find((item) => item.id === id)
    if (!target || state.actionBusy) return false
    if (kind === 'permanent' && (!target.deleted || target.hasChildren)) {
      state.actionMessage = target.hasChildren ? '仍有回复，不能彻底删除' : messages.invalidRequest
      return false
    }
    const siteId = state.selectedSiteId
    state.actionBusy = true; state.actionMessage = ''
    try {
      if (kind === 'tombstone') await adminApi.tombstone(siteId, target.id)
      else await adminApi.permanentlyDelete(siteId, target.id)
      await leave?.(target.id)
      toast(kind === 'tombstone' ? messages.tombstoned : messages.permanentlyDeleted)
      if (state.selectedComment?.id === target.id) state.selectedComment = null
      // The faded comment keeps its place until the quiet reload swaps in the whole page at once,
      // so the page keeps its height and scroll position when the next page's comment moves up.
      await loadComments(false, true); return true
    } catch (error) { fail(error, 'action'); return false }
    finally { state.actionBusy = false }
  }
  async function loadNotifications() {
    if (state.notificationBusy) return
    state.notificationBusy = true; state.notificationMessage = ''
    try { state.notificationSettings = await adminApi.getNotifications() }
    catch (error) { fail(error, 'notification') }
    finally { state.notificationBusy = false }
  }
  async function saveEmail(settings: EmailNotificationSettings) {
    state.notificationBusy = true
    try { const saved = await adminApi.saveEmail(settings); if (state.notificationSettings) state.notificationSettings.email = saved; toast(messages.emailSaved); return saved }
    catch (error) { fail(error, 'notification'); return null }
    finally { state.notificationBusy = false }
  }
  async function saveTelegram(settings: TelegramNotificationSettings) {
    state.notificationBusy = true
    try { const saved = await adminApi.saveTelegram(settings); if (state.notificationSettings) state.notificationSettings.telegram = saved; toast(messages.telegramSaved); return saved }
    catch (error) { fail(error, 'notification'); return null }
    finally { state.notificationBusy = false }
  }
  async function testEmail(settings: EmailNotificationSettings) {
    state.notificationBusy = true; state.emailTestState = 'idle'; state.emailTestMessage = ''
    try { await adminApi.testEmail(settings); state.emailTestState = 'success'; state.emailTestMessage = '测试邮件已发送' }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) return clearSession(messages.sessionExpired)
      state.emailTestState = 'failure'; state.emailTestMessage = testFailureMessage(error, 'email')
    }
    finally { state.notificationBusy = false }
  }
  async function testTelegram(settings: TelegramNotificationSettings) {
    state.notificationBusy = true; state.telegramTestState = 'idle'; state.telegramTestMessage = ''
    try { await adminApi.testTelegram(settings); state.telegramTestState = 'success'; state.telegramTestMessage = '测试消息已发送' }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) return clearSession(messages.sessionExpired)
      state.telegramTestState = 'failure'; state.telegramTestMessage = testFailureMessage(error, 'telegram')
    }
    finally { state.notificationBusy = false }
  }
  async function loadCaptcha() {
    if (state.captchaBusy) return
    state.captchaBusy = true; state.captchaMessage = ''
    try { state.captchaSettings = await adminApi.getCaptcha() }
    catch (error) { fail(error, 'security') }
    finally { state.captchaBusy = false }
  }
  async function saveCaptcha(settings: CaptchaSettings) {
    state.captchaBusy = true; state.captchaMessage = ''
    try {
      const saved = await adminApi.saveCaptcha(settings)
      state.captchaSettings = saved
      toast(messages.captchaSaved)
      return saved
    } catch (error) { fail(error, 'security'); return null }
    finally { state.captchaBusy = false }
  }
  return Object.assign(state, { login, completeInitialSetup, consumeCreateSiteRequest, logout, restoreSession, switchView, loadSites, saveSite, loadComments, loadDetail, selectSite, selectStatus, toggleSort, selectPage, selectComment, mutateCurrent, loadNotifications, saveEmail, saveTelegram, testEmail, testTelegram, loadCaptcha, saveCaptcha, setDirty, requestNavigation, resolveNavigation })
}

export type AdminStore = ReturnType<typeof createAdminStore>
export function useAdminStore(): AdminStore { return getContext<AdminStore>('admin') }
