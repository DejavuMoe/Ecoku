import styles from './style.css?inline'
import {
  DEFAULT_COMMENT_FORM_CONFIG,
  normalizePageKey,
  type CommentFormConfig,
  type ResolvedEcokuConfig,
} from './config'
import {
  EcokuRequestError,
  fetchComments,
  submitComment,
  type CommentData,
  type CommentDraft,
  type CommentSort,
} from './fetch'
import {
  loadVisitorIdentity,
  saveVisitorIdentity,
  type StoredVisitorIdentity,
} from './identity-store'
import { getMessages, type ClientMessages } from './messages'
import { mountChallenge, type ChallengeWidget } from './captcha'
import {
  codePointLength,
  createElement,
  DEFAULT_DISPLAY_TIME_ZONE,
  formatCommentTime,
  formatTimeZoneTitle,
  isAbortError,
  isEmailForClient,
  resolveTimeZone,
  safeHTTPURL,
} from './util'
import { loadSmojiManifest, renderSmojiContent, smojiMarker, type SmojiManifest } from './smoji'

const MAX_NICKNAME_LENGTH = 80
const COMPOSER_ROWS = 7
let instanceSequence = 0

interface ActiveReply {
  parentId: number
  trigger: HTMLButtonElement
  form: HTMLFormElement
  nickname: HTMLInputElement
  email: HTMLInputElement
  website: HTMLInputElement
  identityGrid: HTMLDivElement
  textarea: HTMLTextAreaElement
  captchaSlot: HTMLDivElement
  captchaGeneration: number
  widget: ChallengeWidget | null
  error: HTMLParagraphElement
  submit: HTMLButtonElement
  smojiControl: HTMLElement
}

type IdentityDraft = StoredVisitorIdentity

export class CommentSurface {
  private config: ResolvedEcokuConfig
  private messages: ClientMessages = getMessages('zh-CN')
  private readonly instanceId = ++instanceSequence
  private readonly root = createElement('div', 'ecoku-comments')
  private readonly core = createElement('div', 'ecoku-core')
  private readonly serviceError = createElement('section', 'ecoku-service-error')
  private readonly retryButton = createElement('button', 'ecoku-secondary-button', this.messages.retry)
  private readonly count = createElement('h2', 'ecoku-section-title', this.messages.noCommentCount)
  private readonly sortPicker = createElement('div', 'ecoku-sort-picker')
  private readonly sortTrigger = createElement('button', 'ecoku-sort-trigger')
  private readonly sortTriggerLabel = createElement('span', '', this.messages.sortOldest)
  private readonly sortMenu = createElement('div', 'ecoku-sort-menu')
  private readonly sortOptions: HTMLButtonElement[] = []
  private readonly rootForm = createElement('form', 'ecoku-composer')
  private readonly nickname = createElement('input', 'ecoku-input')
  private readonly email = createElement('input', 'ecoku-input')
  private readonly website = createElement('input', 'ecoku-input')
  private readonly rootContent = createElement('textarea', 'ecoku-textarea')
  private readonly rootCaptcha = createElement('div', 'ecoku-turnstile-slot ecoku-captcha-slot')
  private readonly rootError = createElement('p', 'ecoku-form-error')
  private readonly characterCount = createElement('span', 'ecoku-character-count', `0/${DEFAULT_COMMENT_FORM_CONFIG.lengthLimit}`)
  private readonly rootSubmit = createElement('button', 'ecoku-primary-button', this.messages.submitComment)
  private readonly statusLine = createElement('p', 'ecoku-status-line')
  private readonly emptyState = createElement('section', 'ecoku-empty-state')
  private readonly threadList = createElement('div', 'ecoku-thread-list')
  private readonly pagination = createElement('nav', 'ecoku-pagination')
  private readonly previousPageButton = createElement('button', 'ecoku-pager-button', this.messages.previousPage)
  private readonly paginationStatus = createElement('span', 'ecoku-pagination-status', '1/1')
  private readonly nextPageButton = createElement('button', 'ecoku-pager-button', this.messages.nextPage)
  private comments: CommentData[] = []
  private currentPage = 0
  private pageCount = 0
  private rootTotal = 0
  private commentTotal = 0
  private sort: CommentSort | undefined
  private formConfig: CommentFormConfig = { ...DEFAULT_COMMENT_FORM_CONFIG }
  private timeZone = DEFAULT_DISPLAY_TIME_ZONE
  private listController: AbortController | null = null
  private submitController: AbortController | null = null
  private refreshController: AbortController | null = null
  private activeReply: ActiveReply | null = null
  private rootWidget: ChallengeWidget | null = null
  private captchaGeneration = 0
  private requestVersion = 0
  private pageRevision = 0
  private listBusy = false
  private submissionBusy = false
  private destroyed = false
  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target as Node
    if (!this.sortPicker.contains(target)) this.toggleSortMenu(false)
    for (const control of this.smojiControls) {
      if (!control.contains(target)) this.closeSmojiControl(control)
    }
  }
  private readonly smojiControls = new Set<HTMLElement>()
  private smojiManifestPromise: Promise<SmojiManifest> | null = null
  private smojiManifestController: AbortController | null = null

  constructor(config: ResolvedEcokuConfig) {
    this.config = config
    this.messages = getMessages(config.i18n ?? 'zh-CN')
    this.buildSurface()
  }

  async mount(): Promise<void> {
    this.config.container.replaceChildren(this.root)
    await this.restoreVisitorIdentity()
    await this.loadPage(1, false)
  }

  async reload(): Promise<void> {
    await this.loadPage(Math.max(1, this.currentPage), false)
  }

  async setPageKey(value: string, pageTitle = ''): Promise<void> {
    const pageKey = normalizePageKey(value)
    this.config = { ...this.config, pageTitle: pageTitle.trim() }
    if (pageKey === this.config.pageKey) {
      await this.refreshAfterSubmission()
      return
    }
    this.pageRevision += 1
    this.abortRequests()
    this.smojiManifestController?.abort()
    this.smojiManifestController = null
    this.smojiManifestPromise = null
    this.closeReply(false)
    this.config = { ...this.config, pageKey }
    this.comments = []
    this.currentPage = 0
    this.pageCount = 0
    this.rootTotal = 0
    this.commentTotal = 0
    this.rootContent.value = ''
    this.updateRootFormState()
    this.statusLine.textContent = ''
    await this.loadPage(1, false)
    if (!this.destroyed) this.announce(this.messages.pageChanged)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.smojiManifestController?.abort()
    this.smojiManifestPromise = null
    this.pageRevision += 1
    this.abortRequests()
    this.closeReply(false)
    this.rootWidget?.remove()
    this.rootWidget = null
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown)
    this.root.remove()
  }

  private buildSurface(): void {
    this.root.dataset.theme = this.config.theme
    this.root.setAttribute('lang', this.localeLanguage())

    if (!this.config.cssURL) {
      const style = createElement('style')
      style.textContent = styles
      this.root.append(style)
    }

    const section = createElement('section', 'ecoku-comment-section')
    section.setAttribute('aria-label', this.messages.ariaComments)
    const heading = createElement('div', 'ecoku-section-heading')
    this.count.setAttribute('aria-live', 'polite')
    this.sortTrigger.type = 'button'
    this.sortTrigger.setAttribute('aria-haspopup', 'listbox')
    this.sortTrigger.setAttribute('aria-expanded', 'false')
    this.sortTrigger.setAttribute('aria-label', `${this.messages.ariaSort}: ${this.messages.sortOldest}`)
    this.sortTrigger.append(this.sortTriggerLabel, createElement('span', 'ecoku-sort-chevron'))
    this.sortMenu.setAttribute('role', 'listbox')
    this.sortMenu.setAttribute('aria-label', this.messages.ariaSort)
    this.sortMenu.hidden = true
    const newest = createElement('button', 'ecoku-sort-option', this.messages.sortNewest)
    newest.type = 'button'
    newest.dataset.sort = 'newest'
    newest.setAttribute('role', 'option')
    newest.setAttribute('aria-selected', 'false')
    const oldestButton = createElement('button', 'ecoku-sort-option', this.messages.sortOldest)
    oldestButton.type = 'button'
    oldestButton.dataset.sort = 'oldest'
    oldestButton.setAttribute('role', 'option')
    oldestButton.setAttribute('aria-selected', 'true')
    this.sortOptions.push(newest, oldestButton)
    this.sortMenu.append(newest, oldestButton)
    this.sortPicker.append(this.sortTrigger, this.sortMenu)
    heading.append(this.count, this.sortPicker)

    this.serviceError.hidden = true
    this.serviceError.setAttribute('aria-live', 'polite')
    this.serviceError.setAttribute('aria-atomic', 'true')
    const errorTitle = createElement('h3', '', this.messages.serviceErrorTitle)
    const errorBody = createElement('p', '', this.messages.serviceErrorBody)
    this.retryButton.type = 'button'
    this.serviceError.append(errorTitle, errorBody, this.retryButton)

    this.buildRootComposer()
    this.statusLine.setAttribute('role', 'status')
    this.statusLine.setAttribute('aria-live', 'polite')
    this.statusLine.setAttribute('aria-atomic', 'true')
    this.statusLine.tabIndex = -1

    this.emptyState.hidden = true
    this.emptyState.append(createElement('p', '', this.formConfig.emptyMessage))
    this.threadList.setAttribute('role', 'list')
    this.threadList.hidden = true
    this.pagination.setAttribute('aria-label', this.messages.paginationLabel)
    this.pagination.hidden = true
    this.previousPageButton.type = 'button'
    this.nextPageButton.type = 'button'
    this.paginationStatus.setAttribute('aria-live', 'polite')
    this.paginationStatus.setAttribute('aria-atomic', 'true')
    const firstSeparator = createElement('span', 'ecoku-pagination-separator', '｜')
    const secondSeparator = createElement('span', 'ecoku-pagination-separator', '｜')
    firstSeparator.setAttribute('aria-hidden', 'true')
    secondSeparator.setAttribute('aria-hidden', 'true')
    this.pagination.append(
      this.previousPageButton,
      firstSeparator,
      this.paginationStatus,
      secondSeparator,
      this.nextPageButton,
    )

    this.core.append(
      this.rootForm,
      heading,
      this.statusLine,
      this.emptyState,
      this.threadList,
      this.pagination,
    )
    section.append(this.serviceError, this.core)
    this.root.append(section)

    this.sortTrigger.addEventListener('click', () => this.toggleSortMenu(this.sortMenu.hidden !== false))
    this.sortTrigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        this.toggleSortMenu(true, true)
      }
    })
    this.sortMenu.addEventListener('click', (event) => {
      const option = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-sort]')
      if (option) this.chooseSort(option.dataset.sort === 'newest' ? 'newest' : 'oldest')
    })
    this.sortMenu.addEventListener('keydown', (event) => this.handleSortMenuKeydown(event))
    document.addEventListener('pointerdown', this.handleDocumentPointerDown)
    this.retryButton.addEventListener('click', () => void this.loadPage(Math.max(1, this.currentPage), false))
    this.previousPageButton.addEventListener('click', () => void this.goToPage(this.currentPage - 1))
    this.nextPageButton.addEventListener('click', () => void this.goToPage(this.currentPage + 1))
  }

  private toggleSortMenu(open: boolean, focusSelected = false): void {
    if (this.sortTrigger.disabled) open = false
    this.sortMenu.hidden = !open
    this.sortTrigger.setAttribute('aria-expanded', String(open))
    if (open && focusSelected) {
      const selected = this.sortOptions.find((option) => option.getAttribute('aria-selected') === 'true')
      window.setTimeout(() => selected?.focus(), 0)
    }
  }

  private handleSortMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      this.toggleSortMenu(false)
      this.sortTrigger.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = this.sortOptions.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? this.sortOptions.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + this.sortOptions.length) % this.sortOptions.length
    this.sortOptions[nextIndex]?.focus()
  }

  private chooseSort(nextSort: CommentSort): void {
    this.sortTriggerLabel.textContent = nextSort === 'oldest' ? this.messages.sortOldest : this.messages.sortNewest
    this.sortTrigger.setAttribute('aria-label', `${this.messages.ariaSort}: ${this.sortTriggerLabel.textContent}`)
    for (const option of this.sortOptions) {
      option.setAttribute('aria-selected', String(option.dataset.sort === nextSort))
    }
    this.toggleSortMenu(false)
    this.sortTrigger.focus()
    if (nextSort === this.sort) return
    this.sort = nextSort
    this.closeReply(false)
    void this.loadPage(1, false)
  }

  private setSortDisabled(disabled: boolean): void {
    this.sortTrigger.disabled = disabled
    for (const option of this.sortOptions) option.disabled = disabled
    if (disabled) this.toggleSortMenu(false)
  }

  private buildRootComposer(): void {
    this.rootForm.noValidate = true
    const identityGrid = createElement('div', 'ecoku-identity-grid')
    this.configureInput(this.nickname, 'text', 'nickname', MAX_NICKNAME_LENGTH * 2)
    this.configureInput(this.email, 'email', 'email', 254)
    this.configureInput(this.website, 'url', 'url', 2048)
    this.nickname.required = true
    identityGrid.append(
      this.field(this.messages.nickname, this.nickname),
      this.field(this.messages.email, this.email),
      this.field(this.messages.website, this.website),
    )

    const messageLabel = createElement('label', 'ecoku-message-field')
    const visuallyHidden = createElement('span', 'ecoku-visually-hidden', this.messages.commentContent)
    this.rootContent.name = 'comment'
    this.rootContent.maxLength = this.formConfig.lengthLimit * 2
    this.rootContent.rows = COMPOSER_ROWS
    this.rootContent.required = true
    this.rootContent.placeholder = this.messages.commentPlaceholder
    messageLabel.append(visuallyHidden, this.rootContent)

    this.rootError.id = `ecoku-root-error-${this.instanceId}`
    this.rootError.setAttribute('role', 'alert')
    this.rootError.tabIndex = -1
    this.rootError.hidden = true

    const footer = createElement('div', 'ecoku-composer-footer')
    this.rootContent.setAttribute('aria-describedby', this.rootError.id)
    const end = createElement('div', 'ecoku-composer-end')
    const previewControl = this.createPreviewControl(this.rootContent)
    this.rootSubmit.type = 'submit'
    this.rootSubmit.disabled = true
    end.append(this.createSmojiControl(this.rootContent), previewControl.button, this.rootSubmit)
    footer.append(this.characterCount, end)
    this.rootForm.append(identityGrid, messageLabel, previewControl.preview, this.rootCaptcha, this.rootError, footer)
    this.applyFormConfig(this.formConfig, false)

    for (const control of [this.nickname, this.email, this.website, this.rootContent]) {
      control.addEventListener('input', () => {
        control.removeAttribute('aria-invalid')
        this.clearError(this.rootError, this.rootContent)
        this.updateRootFormState()
        if (control !== this.rootContent && this.activeReply?.identityGrid.hidden) {
          const identity = this.identity()
          this.setIdentityControls(
            this.activeReply.nickname,
            this.activeReply.email,
            this.activeReply.website,
            identity,
          )
          this.updateReplyIdentityMode(this.activeReply)
          this.updateReplyFormState(this.activeReply)
        }
      })
    }
    this.rootForm.addEventListener('submit', (event) => void this.handleRootSubmit(event))
  }

  private configureInput(input: HTMLInputElement, type: string, autocomplete: string, maxLength: number): void {
    input.type = type
    input.setAttribute('autocomplete', autocomplete)
    input.maxLength = maxLength
  }

  private field(labelText: string, input: HTMLInputElement): HTMLLabelElement {
    const label = createElement('label', 'ecoku-field')
    const labelElement = createElement('span', 'ecoku-field-label', labelText)
    label.append(labelElement, input)
    return label
  }

  private renderAuthor(comment: CommentData): HTMLElement {
    const website = comment.url ? safeHTTPURL(comment.url) : null
    let author: HTMLElement
    if (website) {
      const link = createElement('a', 'ecoku-comment-author', comment.username)
      link.href = website.toString()
      link.target = '_blank'
      link.rel = 'nofollow ugc noopener noreferrer'
      link.referrerPolicy = 'no-referrer'
      author = link
    } else {
      author = createElement('span', 'ecoku-comment-author', comment.username)
    }
    const badgeText = this.formConfig.bloggerBadge
    if (!comment.isBlogger || !badgeText) return author
    const wrap = createElement('span', 'ecoku-comment-author-wrap')
    const badge = createElement('span', 'ecoku-blogger-badge', badgeText)
    badge.title = '博主'
    wrap.append(author, badge)
    return wrap
  }

  private applyTimeZone(value?: string): void {
    this.timeZone = resolveTimeZone(value)
  }

  private applyFormConfig(next: CommentFormConfig, initializeSort = true): void {
    const previousSmoji = this.formConfig.smoji
    this.formConfig = { ...next, captcha: { ...next.captcha }, smoji: { ...next.smoji } }
    this.messages = getMessages(this.config.i18n ?? next.locale)
    this.applyLocale()
    if (previousSmoji.manifestUrl !== next.smoji.manifestUrl
      || previousSmoji.imageOrigin !== next.smoji.imageOrigin || previousSmoji.enabled !== next.smoji.enabled) {
      this.smojiManifestController?.abort()
      this.smojiManifestPromise = null
      for (const control of this.smojiControls) {
        this.closeSmojiControl(control)
        const panel = control.querySelector<HTMLElement>('.ecoku-smoji-panel')
        if (panel) { panel.replaceChildren(); delete panel.dataset.loaded }
      }
      for (const form of [this.rootForm, this.activeReply?.form]) {
        const preview = form?.querySelector<HTMLElement>('.ecoku-composer-preview')
        if (preview) { preview.hidden = true; preview.replaceChildren() }
        form?.querySelector('.ecoku-preview-trigger')?.setAttribute('aria-pressed', 'false')
      }
    }
    for (const control of this.smojiControls) control.hidden = !next.smoji.enabled
    this.email.required = next.emailRequired
    this.website.required = next.websiteRequired
    this.website.removeAttribute('placeholder')
    this.rootContent.placeholder = next.placeholder
    this.rootContent.maxLength = next.lengthLimit * 2
    if (initializeSort && this.sort === undefined) {
      this.sort = next.defaultSort
      this.syncSortUI()
    } else if (this.sort === undefined) {
      this.syncSortUI()
    }
    const emptyCopy = this.emptyState.querySelector('p')
    if (emptyCopy) emptyCopy.textContent = next.emptyMessage
    if (this.activeReply) {
      this.activeReply.email.required = next.emailRequired
      this.activeReply.website.required = next.websiteRequired
      this.activeReply.textarea.maxLength = next.lengthLimit * 2
      this.updateReplyIdentityMode(this.activeReply)
      this.updateReplyFormState(this.activeReply)
    }
    this.updateRootFormState()
    this.syncRootCaptcha()
    if (this.activeReply) void this.syncReplyCaptcha(this.activeReply)
  }

  private localeLanguage(): string {
    return this.config.i18n === 'en' || this.formConfig.locale === 'en'
      ? 'en'
      : this.config.i18n === 'zh-Hant' || this.formConfig.locale === 'zh-Hant'
        ? 'zh-Hant'
        : 'zh-CN'
  }

  private applyLocale(): void {
    this.root.setAttribute('lang', this.localeLanguage())
    this.retryButton.textContent = this.messages.retry
    this.previousPageButton.textContent = this.messages.previousPage
    this.nextPageButton.textContent = this.messages.nextPage
    this.rootSubmit.textContent = this.messages.submitComment
    this.sortMenu.setAttribute('aria-label', this.messages.ariaSort)
    this.sortTrigger.setAttribute('aria-label', `${this.messages.ariaSort}: ${this.sortTriggerLabel.textContent}`)
    this.pagination.setAttribute('aria-label', this.messages.paginationLabel)
    const errorTitle = this.serviceError.querySelector('h3')
    const errorBody = this.serviceError.querySelector('p')
    if (errorTitle) errorTitle.textContent = this.messages.serviceErrorTitle
    if (errorBody) errorBody.textContent = this.messages.serviceErrorBody
    const labels = this.rootForm.querySelectorAll<HTMLElement>('.ecoku-field-label')
    ;[this.messages.nickname, this.messages.email, this.messages.website].forEach((value, index) => {
      if (labels[index]) labels[index].textContent = value
    })
    const contentLabel = this.rootForm.querySelector('.ecoku-visually-hidden')
    if (contentLabel) contentLabel.textContent = this.messages.commentContent
    this.sortTriggerLabel.textContent = this.sort === 'oldest' ? this.messages.sortOldest : this.messages.sortNewest
  }

  private syncRootCaptcha(): void {
    const generation = ++this.captchaGeneration
    this.rootWidget?.remove()
    this.rootWidget = null
    this.rootCaptcha.replaceChildren()
    if (this.formConfig.captcha.provider === 'off') return
    void mountChallenge(this.rootCaptcha, this.formConfig.captcha, this.config.theme, this.localeLanguage() === 'en' ? 'en' : this.localeLanguage() === 'zh-Hant' ? 'zh-Hant' : 'zh-CN').then((widget) => {
      if (!widget) return
      if (this.destroyed || generation !== this.captchaGeneration) {
        widget.remove()
        return
      }
    this.rootWidget = widget
    }).catch(() => undefined)
  }

  private async syncReplyCaptcha(reply: ActiveReply): Promise<void> {
    const generation = ++reply.captchaGeneration
    reply.widget?.remove()
    reply.widget = null
    reply.captchaSlot.replaceChildren()
    if (this.formConfig.captcha.provider === 'off') return
    try {
      const widget = await mountChallenge(reply.captchaSlot, this.formConfig.captcha, this.config.theme, this.localeLanguage() === 'en' ? 'en' : this.localeLanguage() === 'zh-Hant' ? 'zh-Hant' : 'zh-CN')
      if (this.destroyed || this.activeReply !== reply || generation !== reply.captchaGeneration) {
        widget?.remove()
        return
      }
      reply.widget = widget
    } catch {
      if (generation === reply.captchaGeneration) reply.widget = null
    }
  }

  private syncSortUI(): void {
    const sort = this.sort ?? this.formConfig.defaultSort
    this.sortTriggerLabel.textContent = sort === 'oldest' ? this.messages.sortOldest : this.messages.sortNewest
    this.sortTrigger.setAttribute('aria-label', `${this.messages.ariaSort}: ${this.sortTriggerLabel.textContent}`)
    for (const option of this.sortOptions) option.setAttribute('aria-selected', String(option.dataset.sort === sort))
  }

  private async loadPage(targetPage: number, announce: boolean): Promise<void> {
    if (this.destroyed || this.listBusy) return
    const controller = this.beginListRequest()
    const version = this.requestVersion
    const revision = this.pageRevision
    this.setInitialLoading(this.comments.length === 0)

    try {
      const result = await fetchComments(this.config, Math.max(1, targetPage), this.sort, controller.signal)
      if (!this.isCurrentRequest(version, revision)) return
      this.comments = result.comments
      this.currentPage = Math.max(1, result.page)
      this.pageCount = result.pageCount
      this.rootTotal = result.rootTotal
      this.commentTotal = result.commentTotal
      this.applyTimeZone(result.timeZone)
      this.applyFormConfig(result.formConfig)
      this.hideServiceError()
      this.renderComments()
      if (announce) this.announce(this.messages.pageChanged)
    } catch (error) {
      if (isAbortError(error) || !this.isCurrentRequest(version, revision)) return
      this.showListFailure(error, this.comments.length === 0)
    } finally {
      if (version === this.requestVersion) {
        this.listBusy = false
        this.setSortDisabled(false)
        this.updatePagination()
      }
    }
  }

  private async goToPage(targetPage: number): Promise<void> {
    if (
      this.destroyed
      || this.listBusy
      || this.submissionBusy
      || targetPage < 1
      || targetPage > this.pageCount
      || targetPage === this.currentPage
    ) return
    await this.loadPage(targetPage, true)
  }

  private beginListRequest(): AbortController {
    this.listController?.abort()
    this.listController = new AbortController()
    this.requestVersion += 1
    this.listBusy = true
    this.setSortDisabled(true)
    this.updatePagination()
    return this.listController
  }

  private isCurrentRequest(version: number, revision: number): boolean {
    return !this.destroyed && version === this.requestVersion && revision === this.pageRevision
  }

  private setInitialLoading(clearView: boolean): void {
    this.hideServiceError()
    if (!clearView) return
    this.emptyState.hidden = true
    this.threadList.hidden = true
    this.pagination.hidden = true
  }

  private hideServiceError(): void {
    this.serviceError.hidden = true
    this.core.hidden = false
  }

  private showListFailure(error: unknown, initial: boolean): void {
    if (initial) {
      this.core.hidden = true
      this.serviceError.hidden = false
      this.retryButton.focus({ preventScroll: true })
      return
    }
    this.announce(this.listErrorMessage(error))
  }

  private listErrorMessage(error: unknown): string {
    if (error instanceof EcokuRequestError) {
      if (error.status === 403) return this.messages.list403
      if (error.status === 429) return this.messages.list429
    }
    return this.messages.listFailure
  }

  private renderComments(): void {
    this.closeReply(false)
    this.threadList.replaceChildren()
    const byParent = new Map<number, CommentData[]>()
    const roots: CommentData[] = []
    const byID = new Map(this.comments.map((comment) => [comment.id, comment]))
    const knownIds = new Set(byID.keys())
    for (const comment of this.comments) {
      if (comment.parent === 0) {
        roots.push(comment)
      } else if (knownIds.has(comment.parent)) {
        const siblings = byParent.get(comment.parent) || []
        siblings.push(comment)
        byParent.set(comment.parent, siblings)
      }
    }

    const rendered = new Set<number>()
    for (const root of roots) {
      const node = this.renderComment(root, 0, byParent, byID, new Set<number>(), rendered)
      if (node) this.threadList.append(node)
    }

    const visibleCommentTotal = Math.max(this.commentTotal, rendered.size)
    this.count.textContent = visibleCommentTotal > 0 ? this.messages.commentCount(visibleCommentTotal) : this.messages.noCommentCount
    const empty = rendered.size === 0
    this.emptyState.hidden = !empty
    this.threadList.hidden = empty
    this.updatePagination(empty)
    this.root.dataset.rootTotal = String(this.rootTotal)
  }

  private updatePagination(empty = this.comments.length === 0): void {
    const normalizedPageCount = Math.max(1, this.pageCount)
    const normalizedCurrentPage = Math.min(normalizedPageCount, Math.max(1, this.currentPage))
    this.pagination.hidden = empty || this.pageCount <= 1
    this.paginationStatus.textContent = `${normalizedCurrentPage}/${normalizedPageCount}`
    const busy = this.listBusy || this.submissionBusy
    this.previousPageButton.disabled = busy || normalizedCurrentPage <= 1
    this.nextPageButton.disabled = busy || normalizedCurrentPage >= normalizedPageCount
  }

  private renderComment(
    comment: CommentData,
    depth: number,
    byParent: Map<number, CommentData[]>,
    byID: Map<number, CommentData>,
    ancestors: Set<number>,
    rendered: Set<number>,
  ): HTMLElement | null {
    if (ancestors.has(comment.id) || rendered.has(comment.id)) return null
    rendered.add(comment.id)
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(comment.id)
    const children = byParent.get(comment.id) || []
    const article = createElement('article', `ecoku-comment-node${comment.deleted ? ' ecoku-deleted' : ''}`)
    article.setAttribute('role', 'listitem')
    article.setAttribute('aria-level', String(depth + 1))
    article.dataset.commentId = String(comment.id)
    article.dataset.depth = String(depth + 1)

    const row = createElement('div', 'ecoku-comment-row')
    row.id = `ecoku-comment-${comment.id}`
    row.style.setProperty('--ecoku-depth', String(Math.min(depth, 3)))
    const meta = createElement('header', 'ecoku-comment-meta')
    const metaMain = createElement('div', 'ecoku-comment-meta-main')
    const contentShell = createElement('div', 'ecoku-collapsible-content')
    const childrenContainer = createElement('div', 'ecoku-children')
    childrenContainer.setAttribute('role', 'group')

    if (comment.deleted) {
      metaMain.append(createElement('span', 'ecoku-comment-author', this.messages.deletedAuthor))
    } else {
      metaMain.append(this.renderAuthor(comment))
    }

    const timeLink = createElement('a', 'ecoku-comment-time')
    timeLink.href = `#${row.id}`
    const timeLabel = formatCommentTime(comment.created_at, this.timeZone)
    const zoneTitle = formatTimeZoneTitle(this.timeZone)
    const time = createElement('time', '', timeLabel)
    if (comment.created_at) time.dateTime = comment.created_at
    timeLink.title = zoneTitle
    timeLink.setAttribute('aria-label', `${timeLabel}, ${zoneTitle}`)
    timeLink.append(time)
    metaMain.append(timeLink)

    let collapse: HTMLButtonElement | null = null
    const foldedSummary = createElement('span', 'ecoku-folded-summary')
    foldedSummary.hidden = true
    if (children.length > 0) {
      collapse = createElement('button', 'ecoku-collapse-button', '[-]')
      collapse.type = 'button'
      collapse.title = this.messages.collapse
      collapse.setAttribute('aria-label', this.messages.collapse)
      collapse.setAttribute('aria-expanded', 'true')
      metaMain.append(collapse)
    }
    metaMain.append(foldedSummary)

    let replyContext: HTMLElement | null = null
    if (depth >= 3 && comment.parent !== 0) {
      const parent = byID.get(comment.parent)
      if (parent) {
        const replyTarget = createElement('a', 'ecoku-reply-context', this.messages.replyTo(parent.username))
        replyTarget.href = `#ecoku-comment-${parent.id}`
        replyTarget.title = this.messages.replyTarget
        replyContext = replyTarget
      } else {
        replyContext = createElement('span', 'ecoku-reply-context', this.messages.replyTo(this.messages.parentComment))
      }
      metaMain.append(replyContext)
    }

    let replySlot: HTMLElement | null = null
    let replyButton: HTMLButtonElement | null = null
    if (!comment.deleted) {
      const trigger = createElement('button', 'ecoku-text-action ecoku-reply-action', this.messages.reply)
      replyButton = trigger
      trigger.type = 'button'
      replySlot = createElement('div', 'ecoku-reply-slot')
      trigger.addEventListener('click', () => this.openReply(comment, trigger, replySlot as HTMLElement))
      metaMain.append(trigger)
    }

    meta.append(metaMain)

    const copy = createElement('div', 'ecoku-comment-copy')
    const paragraph = createElement('p')
    if (comment.deleted) paragraph.textContent = this.messages.deletedBody
    else renderSmojiContent(paragraph, comment.content, this.formConfig.smoji.enabled, this.formConfig.smoji.manifestUrl, this.formConfig.smoji.imageOrigin)
    copy.append(paragraph)
    contentShell.append(copy)
    if (replySlot) contentShell.append(replySlot)

    row.append(meta, contentShell)
    article.append(row)
    for (const child of children) {
      const childNode = this.renderComment(child, depth + 1, byParent, byID, nextAncestors, rendered)
      if (childNode) childrenContainer.append(childNode)
    }
    if (childrenContainer.childElementCount > 0) article.append(childrenContainer)

    if (collapse) {
      const descendantCount = childrenContainer.querySelectorAll('.ecoku-comment-node').length
      collapse.addEventListener('click', () => {
        const collapsing = collapse?.getAttribute('aria-expanded') === 'true'
        collapse?.setAttribute('aria-expanded', String(!collapsing))
        if (collapse) {
          collapse.textContent = collapsing ? '[+]' : '[-]'
          collapse.title = collapsing ? this.messages.expand : this.messages.collapse
          collapse.setAttribute('aria-label', collapse.title)
        }
        contentShell.hidden = collapsing
        childrenContainer.hidden = collapsing
        foldedSummary.hidden = !collapsing
        foldedSummary.textContent = collapsing ? this.messages.collapsed(descendantCount) : ''
        if (replyButton) replyButton.hidden = collapsing
        if (replyContext) replyContext.hidden = collapsing
        if (collapsing && this.activeReply?.parentId === comment.id) this.closeReply(false)
      })
    }
    return article
  }

  private openReply(comment: CommentData, trigger: HTMLButtonElement, slot: HTMLElement): void {
    if (this.destroyed || this.submissionBusy || comment.deleted) return
    if (this.activeReply?.parentId === comment.id) {
      const target = this.activeReply.identityGrid.hidden
        ? this.activeReply.textarea
        : this.firstInvalidIdentityControl(this.activeReply) ?? this.activeReply.textarea
      target.focus()
      return
    }
    if (this.activeReply && this.replyHasUnsavedInput(this.activeReply)
      && !window.confirm(this.messages.discardReplyDraft)) return
    this.closeReply(false)
    const form = createElement('form', 'ecoku-composer ecoku-reply-composer')
    form.noValidate = true
    const nickname = createElement('input', 'ecoku-input')
    const email = createElement('input', 'ecoku-input')
    const website = createElement('input', 'ecoku-input')
    this.configureInput(nickname, 'text', 'nickname', MAX_NICKNAME_LENGTH * 2)
    this.configureInput(email, 'email', 'email', 254)
    this.configureInput(website, 'url', 'url', 2048)
    nickname.required = true
    email.required = this.formConfig.emailRequired
    website.required = this.formConfig.websiteRequired
    const identityGrid = createElement('div', 'ecoku-identity-grid ecoku-reply-identity-grid')
    identityGrid.append(
      this.field(this.messages.nickname, nickname),
      this.field(this.messages.email, email),
      this.field(this.messages.website, website),
    )

    const currentIdentity = this.identity()
    this.setIdentityControls(nickname, email, website, currentIdentity)
    const textarea = createElement('textarea', 'ecoku-textarea')
    textarea.maxLength = this.formConfig.lengthLimit * 2
    textarea.rows = COMPOSER_ROWS
    textarea.placeholder = this.messages.replyPlaceholder
    const messageLabel = createElement('label', 'ecoku-message-field')
    const visuallyHidden = createElement('span', 'ecoku-visually-hidden', this.messages.submitReply)
    messageLabel.append(visuallyHidden, textarea)
    const error = createElement('p', 'ecoku-form-error')
    error.id = `ecoku-reply-error-${this.instanceId}-${comment.id}`
    error.setAttribute('role', 'alert')
    error.tabIndex = -1
    error.hidden = true
    textarea.setAttribute('aria-describedby', error.id)
    const footer = createElement('div', 'ecoku-composer-footer ecoku-reply-footer')
    const counter = createElement('span', 'ecoku-character-count', `0/${this.formConfig.lengthLimit}`)
    const end = createElement('div', 'ecoku-composer-end')
    const cancel = createElement('button', 'ecoku-secondary-button', this.messages.cancel)
    cancel.type = 'button'
    const submit = createElement('button', 'ecoku-primary-button', this.messages.submitReply)
    submit.type = 'submit'
    submit.disabled = true
    const smojiControl = this.createSmojiControl(textarea)
    const previewControl = this.createPreviewControl(textarea)
    end.append(smojiControl, previewControl.button, cancel, submit)
    footer.append(counter, end)
    const captchaSlot = createElement('div', 'ecoku-turnstile-slot ecoku-captcha-slot')
    form.append(identityGrid, messageLabel, previewControl.preview, captchaSlot, error, footer)
    slot.append(form)
    const reply: ActiveReply = {
      parentId: comment.id,
      trigger,
      form,
      nickname,
      email,
      website,
      identityGrid,
      textarea,
      captchaSlot,
      widget: null,
      captchaGeneration: 0,
      error,
      submit,
      smojiControl,
    }
    this.activeReply = reply
    void this.syncReplyCaptcha(reply)
    this.updateReplyIdentityMode(reply)
    for (const control of [nickname, email, website]) {
      control.addEventListener('input', () => {
        control.removeAttribute('aria-invalid')
        this.clearError(error, textarea)
        this.syncReplyIdentityToRoot(reply)
        this.updateReplyFormState(reply)
      })
    }
    textarea.addEventListener('input', () => {
      const length = codePointLength(textarea.value)
      counter.textContent = `${length}/${this.formConfig.lengthLimit}`
      this.updateReplyFormState(reply)
      this.clearError(error, textarea)
    })
    cancel.addEventListener('click', () => this.closeReply(true))
    form.addEventListener('submit', (event) => void this.handleReplySubmit(event))
    this.updateReplyFormState(reply)
    if (identityGrid.hidden) textarea.focus()
    else (this.firstInvalidIdentityControl(reply) ?? nickname).focus()
  }

  private closeReply(restoreFocus: boolean): void {
    if (!this.activeReply) return
    const { form, trigger, widget, smojiControl } = this.activeReply
    widget?.remove()
    this.smojiControls.delete(smojiControl)
    this.activeReply = null
    form.remove()
    if (restoreFocus && trigger.isConnected) trigger.focus()
  }

  private createSmojiControl(textarea: HTMLTextAreaElement): HTMLElement {
    const wrapper = createElement('div', 'ecoku-smoji-control')
    const trigger = createElement('button', 'ecoku-smoji-trigger', this.messages.sticker)
    const panel = createElement('div', 'ecoku-smoji-panel')
    trigger.type = 'button'
    trigger.setAttribute('aria-haspopup', 'dialog')
    trigger.setAttribute('aria-expanded', 'false')
    panel.id = `ecoku-smoji-${this.instanceId}-${this.smojiControls.size}`
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', this.messages.sticker)
    panel.tabIndex = -1
    trigger.setAttribute('aria-controls', panel.id)
    wrapper.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        event.preventDefault()
        this.closeSmojiControl(wrapper)
        trigger.focus()
      }
    })
    panel.hidden = true
    wrapper.hidden = !this.formConfig.smoji.enabled
    wrapper.append(trigger, panel)
    this.smojiControls.add(wrapper)

    const populate = (manifest: SmojiManifest): void => {
      const tabs = createElement('div', 'ecoku-smoji-tabs')
      const grid = createElement('div', 'ecoku-smoji-grid')
      tabs.setAttribute('role', 'tablist')
      tabs.setAttribute('aria-label', this.messages.stickerPack)
      grid.setAttribute('role', 'tabpanel')
      grid.id = `${panel.id}-grid`
      const showPack = (index: number): void => {
        grid.replaceChildren()
        manifest.packs[index].items.forEach((item) => {
          const button = createElement('button', 'ecoku-smoji-item')
          button.type = 'button'
          button.title = item.label
          const image = createElement('img')
          image.src = item.src
          image.alt = item.label
          image.loading = 'lazy'
          image.decoding = 'async'
          image.referrerPolicy = 'no-referrer'
          button.append(image)
          button.addEventListener('click', () => {
            const marker = smojiMarker(item)
            const start = textarea.selectionStart ?? textarea.value.length
            const end = textarea.selectionEnd ?? start
            textarea.setRangeText(marker, start, end, 'end')
            textarea.dispatchEvent(new Event('input', { bubbles: true }))
            this.closeSmojiControl(wrapper)
            textarea.focus()
          })
          grid.append(button)
        })
        grid.setAttribute('aria-labelledby', `${panel.id}-tab-${index}`)
        Array.from(tabs.children).forEach((tab, tabIndex) => {
          tab.setAttribute('aria-selected', String(tabIndex === index))
          ;(tab as HTMLButtonElement).tabIndex = tabIndex === index ? 0 : -1
        })
      }
      manifest.packs.forEach((pack, index) => {
        const tab = createElement('button', 'ecoku-smoji-tab', pack.label)
        tab.type = 'button'
        tab.setAttribute('role', 'tab')
        tab.id = `${panel.id}-tab-${index}`
        tab.setAttribute('aria-controls', grid.id)
        tab.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? manifest.packs.length - 1
            : (index + (event.key === 'ArrowLeft' ? -1 : 1) + manifest.packs.length) % manifest.packs.length
          showPack(next)
          ;(tabs.children[next] as HTMLButtonElement).focus()
        })
        tab.addEventListener('click', () => showPack(index))
        tabs.append(tab)
      })
      panel.replaceChildren(tabs, grid)
      panel.dataset.loaded = 'true'
      showPack(0)
    }

    trigger.addEventListener('click', async () => {
      const opening = panel.hidden
      if (opening) {
        for (const control of this.smojiControls) {
          if (control !== wrapper) this.closeSmojiControl(control)
        }
      }
      panel.hidden = !opening
      trigger.setAttribute('aria-expanded', String(opening))
      if (opening) panel.focus()
      if (!opening || panel.dataset.loaded === 'true') return
      panel.replaceChildren(createElement('p', 'ecoku-smoji-state', this.messages.loadingStickers))
      let pending: Promise<SmojiManifest> | null = null
      try {
        if (!this.smojiManifestPromise) {
          const controller = new AbortController()
          this.smojiManifestController = controller
          this.smojiManifestPromise = loadSmojiManifest(this.formConfig.smoji.manifestUrl, controller.signal, this.formConfig.smoji.imageOrigin)
            .finally(() => {
              if (this.smojiManifestController === controller) this.smojiManifestController = null
            })
        }
        pending = this.smojiManifestPromise
        const manifest = await pending
        if (!this.destroyed && pending === this.smojiManifestPromise && this.smojiControls.has(wrapper)) populate(manifest)
      } catch {
        if (pending !== this.smojiManifestPromise) return
        this.smojiManifestPromise = null
        if (!this.destroyed && this.smojiControls.has(wrapper)) panel.replaceChildren(createElement('p', 'ecoku-smoji-state', this.messages.stickerLoadFailed))
      }
    })
    return wrapper
  }

  private closeSmojiControl(control: HTMLElement): void {
    const panel = control.querySelector<HTMLElement>('.ecoku-smoji-panel')
    const trigger = control.querySelector<HTMLButtonElement>('.ecoku-smoji-trigger')
    if (!panel || !trigger || panel.hidden) return
    panel.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
  }

  private createPreviewControl(textarea: HTMLTextAreaElement): { button: HTMLButtonElement; preview: HTMLElement } {
    const button = createElement('button', 'ecoku-secondary-button ecoku-preview-trigger', this.messages.preview)
    const preview = createElement('div', 'ecoku-composer-preview')
    button.type = 'button'
    button.setAttribute('aria-pressed', 'false')
    preview.hidden = true
    preview.setAttribute('aria-label', this.messages.commentPreview)

    const render = (): void => {
      preview.replaceChildren()
      const content = textarea.value.trim()
      if (!content) {
        preview.textContent = this.messages.noPreview
        return
      }
      renderSmojiContent(preview, content, this.formConfig.smoji.enabled, this.formConfig.smoji.manifestUrl, this.formConfig.smoji.imageOrigin)
    }
    button.addEventListener('click', () => {
      const opening = preview.hidden
      preview.hidden = !opening
      button.setAttribute('aria-pressed', String(opening))
      if (opening) render()
    })
    textarea.addEventListener('input', () => {
      if (!preview.hidden) render()
    })
    return { button, preview }
  }

  private async handleRootSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (this.submissionBusy || this.destroyed) return
    const identityError = this.validateIdentity(true)
    if (identityError) {
      this.showRootIdentityError(identityError)
      return
    }
    const contentError = this.validateContent(this.rootContent.value)
    if (contentError) {
      this.showInlineError(this.rootError, this.rootContent, contentError)
      this.rootContent.focus()
      return
    }
    const identity = this.identity()
    const draft = this.createDraft(this.rootContent.value, 0, identity)
    await this.performSubmission(draft, identity, this.rootError, this.rootContent, this.rootSubmit, false)
  }

  private async handleReplySubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    const reply = this.activeReply
    if (!reply || this.submissionBusy || this.destroyed) return
    const identity = this.identityFromControls(reply.nickname, reply.email, reply.website)
    const identityError = this.validateIdentityControls(
      identity,
      reply.nickname,
      reply.email,
      reply.website,
      true,
    )
    if (identityError) {
      reply.error.textContent = identityError
      reply.error.hidden = false
      return
    }
    const contentError = this.validateContent(reply.textarea.value)
    if (contentError) {
      this.showInlineError(reply.error, reply.textarea, contentError)
      reply.textarea.focus()
      return
    }
    this.setIdentityControls(this.nickname, this.email, this.website, identity)
    this.updateRootFormState()
    const draft = this.createDraft(reply.textarea.value, reply.parentId, identity)
    await this.performSubmission(draft, identity, reply.error, reply.textarea, reply.submit, true)
  }

  private async performSubmission(
    draft: CommentDraft,
    identity: IdentityDraft,
    errorElement: HTMLParagraphElement,
    contentElement: HTMLTextAreaElement,
    submitButton: HTMLButtonElement,
    reply: boolean,
  ): Promise<void> {
    if (this.submissionBusy) return
    this.submissionBusy = true
    const revision = this.pageRevision
    const pageKey = this.config.pageKey
    this.submitController?.abort()
    this.submitController = new AbortController()
    this.clearError(errorElement, contentElement)
    this.setSubmissionControls(true, submitButton, reply)
    this.root.setAttribute('aria-busy', 'true')
    const widget = reply ? this.activeReply?.widget : this.rootWidget
    let challengeAttempted = false
    try {
      if (this.formConfig.captcha.provider !== 'off') {
        let token = ''
        try { token = await widget?.waitForToken() ?? '' } catch { token = '' }
        if (!token) {
          this.showInlineError(errorElement, contentElement, this.messages.challengeRequired)
          return
        }
        draft.captchaToken = token
        challengeAttempted = true
      }
      const submitted = await submitComment(this.config, draft, this.submitController.signal)
      if (this.destroyed || revision !== this.pageRevision || pageKey !== this.config.pageKey) return
      if (submitted.data.isBlogger || this.looksLikeBloggerProofAttempt(identity)) {
        if (submitted.data.isBlogger) {
          this.nickname.value = ''
          this.updateRootFormState()
        }
      } else {
        await saveVisitorIdentity(this.config.serverURL, this.config.siteId, identity)
      }
      if (reply) this.closeReply(false)
      else {
        this.rootContent.value = ''
        this.updateRootFormState()
      }
      this.announce(reply ? this.messages.replySubmitted : this.messages.submitted)
      await this.reload()
      if (!this.destroyed) {
        if (reply) {
          const refreshedTrigger = this.root.querySelector<HTMLButtonElement>(`[data-comment-id="${draft.parent}"] .ecoku-text-action`)
          refreshedTrigger?.focus({ preventScroll: true })
        } else {
          this.rootContent.focus({ preventScroll: true })
        }
      }
    } catch (error) {
      if (isAbortError(error) || this.destroyed || revision !== this.pageRevision) return
      this.showInlineError(errorElement, contentElement, this.submissionErrorMessage(error))
    } finally {
      if (challengeAttempted) widget?.reset()
      this.submissionBusy = false
      this.root.removeAttribute('aria-busy')
      this.setSubmissionControls(false, submitButton, reply)
      this.updateRootFormState()
    }
  }

  private createDraft(content: string, parent: number, identity: IdentityDraft): CommentDraft {
    const draft: CommentDraft = {
      username: identity.username,
      content: content.trim(),
      parent,
    }
    if (identity.email) draft.email = identity.email
    if (identity.url) draft.url = identity.url
    return draft
  }

  private setSubmissionControls(busy: boolean, submitButton: HTMLButtonElement, reply: boolean): void {
    this.nickname.disabled = busy
    this.email.disabled = busy
    this.website.disabled = busy
    this.rootContent.disabled = busy
    this.setSortDisabled(busy || this.listBusy)
    this.updatePagination()
    for (const action of this.root.querySelectorAll<HTMLButtonElement>('.ecoku-text-action')) {
      action.disabled = busy
    }
    if (this.activeReply) {
      this.activeReply.nickname.disabled = busy
      this.activeReply.email.disabled = busy
      this.activeReply.website.disabled = busy
      this.activeReply.textarea.disabled = busy
      for (const button of this.activeReply.form.querySelectorAll<HTMLButtonElement>('button')) {
        button.disabled = busy
      }
    }
    if (submitButton.isConnected) {
      submitButton.textContent = busy ? this.messages.submitting : (reply ? this.messages.submitReply : this.messages.submitComment)
      if (!busy && reply && this.activeReply) this.updateReplyFormState(this.activeReply)
      else if (!busy) this.updateRootFormState()
    }
  }

  private async refreshAfterSubmission(): Promise<void> {
    this.refreshController?.abort()
    const controller = new AbortController()
    this.refreshController = controller
    const revision = this.pageRevision
    const pageKey = this.config.pageKey
    try {
      const result = await fetchComments(this.config, Math.max(1, this.currentPage), this.sort, controller.signal)
      if (this.destroyed || revision !== this.pageRevision || pageKey !== this.config.pageKey) return
      this.comments = result.comments
      this.currentPage = Math.max(1, result.page)
      this.pageCount = result.pageCount
      this.rootTotal = result.rootTotal
      this.commentTotal = result.commentTotal
      this.applyTimeZone(result.timeZone)
      this.applyFormConfig(result.formConfig)
      this.hideServiceError()
      this.renderComments()
    } catch (error) {
      if (!isAbortError(error) && !this.destroyed && revision === this.pageRevision) {
        // Submission success remains authoritative. A failed refresh can be
        // retried independently without replacing the success announcement.
        this.updatePagination()
      }
    } finally {
      if (this.refreshController === controller) this.refreshController = null
    }
  }

  private identity(): IdentityDraft {
    return {
      username: this.nickname.value.trim(),
      email: this.email.value.trim(),
      url: this.website.value.trim(),
    }
  }

  private async restoreVisitorIdentity(): Promise<void> {
    const identity = await loadVisitorIdentity(this.config.serverURL, this.config.siteId)
    if (!identity || this.destroyed) return
    this.setIdentityControls(this.nickname, this.email, this.website, identity)
    this.updateRootFormState()
  }

  private identityFromControls(
    nickname: HTMLInputElement,
    email: HTMLInputElement,
    website: HTMLInputElement,
  ): IdentityDraft {
    return {
      username: nickname.value.trim(),
      email: email.value.trim(),
      url: website.value.trim(),
    }
  }

  private setIdentityControls(
    nickname: HTMLInputElement,
    email: HTMLInputElement,
    website: HTMLInputElement,
    identity: IdentityDraft,
  ): void {
    nickname.value = identity.username
    email.value = identity.email
    website.value = identity.url
  }

  private validateIdentityControls(
    identity: IdentityDraft,
    nickname: HTMLInputElement,
    email: HTMLInputElement,
    website: HTMLInputElement,
    focus: boolean,
  ): string | null {
    for (const control of [nickname, email, website]) control.removeAttribute('aria-invalid')
    if (!identity.username) {
      nickname.setAttribute('aria-invalid', 'true')
      if (focus) nickname.focus()
      return this.messages.nicknameRequired
    }
    if (codePointLength(identity.username) > MAX_NICKNAME_LENGTH) {
      nickname.setAttribute('aria-invalid', 'true')
      if (focus) nickname.focus()
      return this.messages.nicknameTooLong
    }
    const emailValid = this.looksLikeBloggerProofAttempt(identity)
      || (!this.formConfig.emailRequired && identity.email === '')
      || (identity.email !== '' && isEmailForClient(identity.email))
    if (!emailValid) {
      email.setAttribute('aria-invalid', 'true')
      if (focus) email.focus()
      return this.formConfig.emailRequired ? this.messages.emailRequiredInvalid : this.messages.emailInvalid
    }
    const websiteValid = this.looksLikeBloggerProofAttempt(identity)
      || (!this.formConfig.websiteRequired && identity.url === '')
      || (identity.url !== '' && Boolean(safeHTTPURL(identity.url)))
    if (!websiteValid) {
      website.setAttribute('aria-invalid', 'true')
      if (focus) website.focus()
      return this.formConfig.websiteRequired ? this.messages.websiteRequiredInvalid : this.messages.websiteInvalid
    }
    return null
  }

  private looksLikeBloggerProofAttempt(identity: IdentityDraft): boolean {
    return this.formConfig.bloggerProofEnabled
      && Boolean(identity.username)
      && identity.email === ''
      && identity.url === ''
  }

  private identityIsCompleteGuest(identity: IdentityDraft): boolean {
    return Boolean(identity.username)
      && codePointLength(identity.username) <= MAX_NICKNAME_LENGTH
      && ((!this.formConfig.emailRequired && identity.email === '')
        || (identity.email !== '' && isEmailForClient(identity.email)))
      && ((!this.formConfig.websiteRequired && identity.url === '')
        || (identity.url !== '' && Boolean(safeHTTPURL(identity.url))))
  }

  private identityIsValid(identity: IdentityDraft): boolean {
    if (this.looksLikeBloggerProofAttempt(identity)) {
      return codePointLength(identity.username) <= MAX_NICKNAME_LENGTH
    }
    return this.identityIsCompleteGuest(identity)
  }

  private firstInvalidIdentityControl(reply: ActiveReply): HTMLInputElement | null {
    const identity = this.identityFromControls(reply.nickname, reply.email, reply.website)
    if (!identity.username || codePointLength(identity.username) > MAX_NICKNAME_LENGTH) return reply.nickname
    if (this.looksLikeBloggerProofAttempt(identity)) return null
    if (!((!this.formConfig.emailRequired && identity.email === '')
      || (identity.email !== '' && isEmailForClient(identity.email)))) return reply.email
    if (!((!this.formConfig.websiteRequired && identity.url === '')
      || (identity.url !== '' && Boolean(safeHTTPURL(identity.url))))) return reply.website
    return null
  }

  private updateReplyIdentityMode(reply: ActiveReply): void {
    reply.identityGrid.hidden = this.identityIsCompleteGuest(
      this.identityFromControls(reply.nickname, reply.email, reply.website),
    )
  }

  private updateReplyFormState(reply: ActiveReply): void {
    const identity = this.identityFromControls(reply.nickname, reply.email, reply.website)
    const length = codePointLength(reply.textarea.value)
    const counter = reply.form.querySelector<HTMLElement>('.ecoku-character-count')
    if (counter) counter.textContent = `${length}/${this.formConfig.lengthLimit}`
    reply.submit.disabled = this.submissionBusy
      || !this.identityIsValid(identity)
      || !reply.textarea.value.trim()
      || length > this.formConfig.lengthLimit
  }

  private syncReplyIdentityToRoot(reply: ActiveReply): void {
    const identity = this.identityFromControls(reply.nickname, reply.email, reply.website)
    this.setIdentityControls(this.nickname, this.email, this.website, identity)
    this.updateRootFormState()
  }

  private replyHasUnsavedInput(reply: ActiveReply): boolean {
    return Boolean(reply.textarea.value.trim())
  }

  private validateIdentity(focus: boolean): string | null {
    return this.validateIdentityControls(
      this.identity(),
      this.nickname,
      this.email,
      this.website,
      focus,
    )
  }

  private validateContent(value: string): string | null {
    if (!value.trim()) return this.messages.contentRequired
    if (codePointLength(value.trim()) > this.formConfig.lengthLimit) return this.messages.contentTooLong(this.formConfig.lengthLimit)
    return null
  }

  private updateRootFormState(): void {
    const length = codePointLength(this.rootContent.value)
    this.characterCount.textContent = `${length}/${this.formConfig.lengthLimit}`
    this.rootSubmit.disabled = this.submissionBusy
      || !this.identityIsValid(this.identity())
      || !this.rootContent.value.trim()
      || length > this.formConfig.lengthLimit
  }

  private showRootIdentityError(message: string): void {
    this.rootError.textContent = message
    this.rootError.hidden = false
  }

  private showInlineError(error: HTMLParagraphElement, control: HTMLElement, message: string): void {
    error.textContent = message
    error.hidden = false
    control.setAttribute('aria-invalid', 'true')
    error.focus({ preventScroll: true })
  }

  private clearError(error: HTMLParagraphElement, control: HTMLElement): void {
    error.textContent = ''
    error.hidden = true
    control.removeAttribute('aria-invalid')
  }

  private submissionErrorMessage(error: unknown): string {
    if (!(error instanceof EcokuRequestError)) return this.messages.submitNetwork
    if (error.status === 400) {
      return error.message === this.messages.challengeRequired ? this.messages.challengeRequired : this.messages.submit400
    }
    if (error.status === 403) return this.messages.submit403
    if (error.status === 413) return this.messages.submit413
    if (error.status === 429) return this.messages.submit429
    if (error.status >= 500) return this.messages.submit500
    return error.status === 0 ? this.messages.submitNetwork : this.messages.submit400
  }

  private announce(message: string): void {
    this.statusLine.textContent = ''
    queueMicrotask(() => {
      if (!this.destroyed) this.statusLine.textContent = message
    })
  }

  private abortRequests(): void {
    this.requestVersion += 1
    this.listController?.abort()
    this.submitController?.abort()
    this.refreshController?.abort()
    this.listController = null
    this.submitController = null
    this.refreshController = null
    this.listBusy = false
    this.submissionBusy = false
  }
}
